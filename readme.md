# Pathomancer

Pathomancer is a lightweight utility for resolving file paths in complex projects and monorepos.  
It takes messy imports with relative paths, custom aliases, symlinks, or even Node's module resolution and returns **clean absolute paths**.

---

## Features

- 🚀 **Fast resolution** with built-in caching  
- 🧭 Automatically detects the **repo base directory**  
- 🎯 Supports multiple alias sources:
  - `tsconfig.json` (`compilerOptions.paths`)
  - `package.json` (`_moduleAliases` or `imports`)
  - `webpack.config.js` (`resolve.alias`)
  - `.babelrc` or `babel.config.js` (`module-resolver`)
  - `vite.config.js`
- 🔗 Handles symlinks (great for monorepos with PNPM/Yarn workspaces)
- 🔄 `refreshAliases()` method to reload config dynamically
- 🛡️ Falls back to Node's native `require.resolve`

---

## Installation

```bash
npm install pathomancer
# or
yarn add pathomancer
# or
pnpm add pathomancer
```

## Usage

```typescript
import { RepoPathResolver } from "pathomancer";

// Start from anywhere inside your repo
const resolver = new RepoPathResolver("/my/monorepo/packages/service-a");

// Resolve a relative path
console.log(resolver.resolve("./utils/helper"));
// -> /my/monorepo/packages/service-a/utils/helper.ts

// Resolve a TypeScript alias
console.log(resolver.resolve("@core/logger"));
// -> /my/monorepo/packages/core/src/logger.ts

// Resolve a node_modules dependency
console.log(resolver.resolve("lodash"));
// -> /my/monorepo/node_modules/lodash/index.js

```
