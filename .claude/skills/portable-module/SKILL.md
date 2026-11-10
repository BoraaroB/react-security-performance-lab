---
name: portable-module
description: Rules for writing portable (copy-paste) code in this project. Modules have no dependency on global config, take settings through parameters, keep the core separate from the framework adapter, and ship a README with a usage example. Load before writing any module in src/lib, src/hooks or src/components (frontend, backend-express, backend-nest).
---

# portable-module: code you can copy into a new project

Portability test: **copy the folder into an empty project, install the listed npm packages, and it works.**

## Rules

1. **One module = one folder** with `index.ts` (public API) and `README.md`.
   - Backend: `src/lib/<module>/`
   - Frontend: `src/lib/<module>/`, `src/hooks/<hook>/` or `src/components/<group>/<Component>/`
2. **No imports from outside the module folder.** Allowed: npm packages, Node/browser built-ins, and another `lib`
   module only if the README lists it as a dependency. Never import `config`, `app/`, `features/`, the store, or routes.
3. **No `process.env` or `import.meta.env` inside a module.** All settings come in through factory parameters:
   ```ts
   // ✅ portable
   export function createJwtService(options: JwtOptions) { ... }
   // ❌ tied to this project
   import { config } from '../../config.js';
   ```
   Reading env vars and calling the factories happens in glue code (`src/app/` on the backend, `src/config/` on the frontend).
4. **Keep the core separate from the framework.** Logic (signing, checking, computing) lives in `core.ts` and knows nothing
   about Express, Nest or React. A thin adapter lives in its own file: `express.ts` (middleware), or a Nest guard/pipe that calls the core.
   The same core then works in Express, Nest, Fastify, ...
5. **Explicit types** for options and return values. Options have sensible, **secure** defaults
   (e.g. `secure: true`, a short TTL).
6. **Errors:** a module throws its own error class, or `AppError` from `lib/errors` when it lists that dependency.
   Messages are in English with a stable `code`.
7. **No hidden global state.** If a module holds state (cache, store), it is created through a factory and can be reset.
   Timers use `.unref()` (backend) or have a cleanup (frontend).
8. **ESM imports** in `backend-express` use the `.js` extension (`./core.js`). Frontend and Nest omit it.
   The README mentions this difference.
9. **English only**: code, comments, README.

## `README.md` template for a module

```markdown
# <module-name>

One sentence: what it solves and why that matters for security or performance.

## Dependencies
- npm: `package@^X`
- lib: `errors` (or "none")

## Usage
(5–15 lines of code: creating and wiring it)

## Options
| Option | Type | Default | Description |

## How to reuse
Copy `src/lib/<module>/` and install the dependencies. (Note about ESM `.js` extensions, if relevant.)
```

## Comment at the top of `index.ts`

Short: what the module does and **what it protects against or what it speeds up**. Do not repeat the README.

## Self-check before committing

```bash
# there must be no imports that leave the module folder (except allowed lib dependencies)
grep -rnE "from '\.\./\.\./|from \"\.\./\.\./|process\.env|import\.meta\.env" src/lib src/hooks src/components
```
Every hit must be justified (e.g. `lib/errors` listed in the README) or fixed.
