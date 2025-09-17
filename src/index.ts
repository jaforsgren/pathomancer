import fs from "fs";
import path from "path";

export interface AliasMap {
  [alias: string]: string[];
}

export class RepoPathResolver {
  private baseDir: string;
  private aliases: AliasMap = {};
  private cache = new Map<string, string>(); // Path resolution cache

  constructor(startDir: string = process.cwd()) {
    this.baseDir = this.findRepoBase(startDir);
    this.loadAliases();
  }

  private findRepoBase(startDir: string): string {
    let current = path.resolve(startDir);

    while (true) {
      if (
        fs.existsSync(path.join(current, "tsconfig.json")) ||
        fs.existsSync(path.join(current, "package.json")) ||
        fs.existsSync(path.join(current, ".git"))
      ) {
        return current;
      }

      const parent = path.dirname(current);
      if (parent === current) {
        throw new Error("Repo base directory not found");
      }
      current = parent;
    }
  }

  public refreshAliases() {
    this.aliases = {};
    this.cache.clear();
    this.loadAliases();
  }

  private loadAliases() {
    this.loadFromTsconfig();
    this.loadFromPackageJson();
    this.loadFromWebpackConfig();
    this.loadFromBabelConfig();
    this.loadFromViteConfig(); // <-- Added for Vite
  }

  private loadFromTsconfig() {
    const tsconfigPath = path.join(this.baseDir, "tsconfig.json");
    if (!fs.existsSync(tsconfigPath)) return;

    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf-8"));
    const paths = tsconfig.compilerOptions?.paths || {};
    for (const [alias, targets] of Object.entries(paths)) {
      const normalizedAlias = alias.replace(/\*$/, "");
      this.aliases[normalizedAlias] = (targets as string[]).map(t =>
        path.resolve(this.baseDir, tsconfig.compilerOptions?.baseUrl || ".", t.replace(/\*$/, ""))
      );
    }
  }

  private loadFromPackageJson() {
    const pkgPath = path.join(this.baseDir, "package.json");
    if (!fs.existsSync(pkgPath)) return;

    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const moduleAliases = pkg._moduleAliases || pkg.imports || {};
    for (const [alias, target] of Object.entries(moduleAliases)) {
      this.aliases[alias] = [path.resolve(this.baseDir, String(target))];
    }
  }

  private loadFromWebpackConfig() {
    const webpackConfigPath = path.join(this.baseDir, "webpack.config.js");
    if (!fs.existsSync(webpackConfigPath)) return;

    try {
      const webpackConfig = require(webpackConfigPath);
      const resolveAliases = webpackConfig.resolve?.alias || {};
      for (const [alias, target] of Object.entries(resolveAliases)) {
        this.aliases[alias] = [path.resolve(this.baseDir, String(target))];
      }
    } catch (err) {
      console.warn("Could not load webpack.config.js aliases:", err);
    }
  }

  private loadFromBabelConfig() {
    const babelrcPath = path.join(this.baseDir, ".babelrc");
    const babelConfigJsPath = path.join(this.baseDir, "babel.config.js");

    let config: any = null;

    if (fs.existsSync(babelrcPath)) {
      config = JSON.parse(fs.readFileSync(babelrcPath, "utf-8"));
    } else if (fs.existsSync(babelConfigJsPath)) {
      try {
        config = require(babelConfigJsPath);
      } catch (err) {
        console.warn("Could not load babel.config.js:", err);
      }
    }

    if (config && config.plugins) {
      const moduleResolver = config.plugins.find((p: any) =>
        Array.isArray(p) && p[0] === "module-resolver"
      );

      if (moduleResolver) {
        const aliasConfig = moduleResolver[1]?.alias || {};
        for (const [alias, target] of Object.entries(aliasConfig)) {
          this.aliases[alias] = [path.resolve(this.baseDir, String(target))];
        }
      }
    }
  }

  private loadFromViteConfig() {
    const viteConfigPath = path.join(this.baseDir, "vite.config.js");
    if (!fs.existsSync(viteConfigPath)) return;

    try {
      const viteConfig = require(viteConfigPath);

      if (!viteConfig.resolve?.alias) return;

      const aliases = viteConfig.resolve.alias;

      if (Array.isArray(aliases)) {
        // Array of { find, replacement }
        for (const { find, replacement } of aliases) {
          if (typeof find === "string" && typeof replacement === "string") {
            this.aliases[find] = [path.resolve(this.baseDir, replacement)];
          }
        }
      } else if (typeof aliases === "object") {
        // Object style alias
        for (const [alias, target] of Object.entries(aliases)) {
          this.aliases[alias] = [path.resolve(this.baseDir, String(target))];
        }
      }
    } catch (err) {
      console.warn("Could not load vite.config.js aliases:", err);
    }
  }

  /**
   * Resolve a path to an absolute filesystem path.
   */
  public resolve(importPath: string, fromDir: string = this.baseDir): string {
    const cacheKey = `${fromDir}:${importPath}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    let resolvedPath: string;

    // 1. Relative or absolute path
    if (importPath.startsWith(".") || importPath.startsWith("/")) {
      resolvedPath = path.resolve(fromDir, importPath);
      this.cache.set(cacheKey, resolvedPath);
      return resolvedPath;
    }

    // 2. Alias resolution
    for (const [alias, targets] of Object.entries(this.aliases)) {
      if (importPath === alias || importPath.startsWith(alias + "/")) {
        const remainder = importPath.slice(alias.length).replace(/^\//, "");
        for (const target of targets) {
          const candidate = path.resolve(target, remainder);
          if (
            fs.existsSync(candidate) ||
            fs.existsSync(candidate + ".ts") ||
            fs.existsSync(candidate + ".js") ||
            fs.existsSync(candidate + "/index.ts") ||
            fs.existsSync(candidate + "/index.js")
          ) {
            this.cache.set(cacheKey, candidate);
            return candidate;
          }
        }
      }
    }

    // 3. Fallback to node_modules
    try {
      resolvedPath = require.resolve(importPath, { paths: [fromDir, this.baseDir] });
      this.cache.set(cacheKey, resolvedPath);
      return resolvedPath;
    } catch {
      throw new Error(`Cannot resolve module path: ${importPath}`);
    }
  }
}

export type TrailMixResolver = InstanceType<typeof RepoPathResolver>;
