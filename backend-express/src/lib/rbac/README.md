# rbac

Role-based access control: `authorize('admin')` lets a request through only when the current user has one of the
listed roles, otherwise 403 `FORBIDDEN`. Authorization must happen on the server: hiding a button in the frontend
does not stop anyone from calling the URL directly.

## Dependencies
- npm: `express@^5`
- lib: `errors` (403 `FORBIDDEN` is an `AppError`)

## Usage

```ts
import { createAuthorize } from './lib/rbac/index.js';

// Once: tell the module where the current user's role is. Your auth middleware must set it first.
const authorize = createAuthorize({ getRole: (req) => req.user?.role });

// Per route or router: authenticate → load the user → check the role.
app.get('/api/admin/users', requireUser, authorize('admin'), listUsers);
adminRouter.use(requireUser, authorize('admin')); // every route in the router, including future ones
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `getRole` | `(req) => Role \| undefined` | – | Reads the current user's role. `undefined` = no user (a wiring mistake → 500) |
| `...allowedRoles` (`authorize`) | `Role[]` | – | At least one; an empty list throws `RbacConfigError` at startup |

## Notes
- **401 vs 403.** 401 = "who are you?" (no or bad token; log in). 403 = "I know who you are, and you may not do this".
  `authorize` only answers 403; authentication runs before it.
- **Deny by default.** No role, or a role not in the list → no access. No role hierarchy: list every allowed role.
- **Read the role fresh.** Take it from the user loaded on this request, not from a JWT claim, so a role change counts
  at once.
- **Roles are not ownership.** `authorize` answers "may this kind of user call this route?". "May THIS user change
  THIS post?" is a check in the service, with the resource loaded (see IDOR).
- `hasRole(role, allowedRoles)` in `core.ts` has no framework code: call it from a Nest guard.

## How to reuse
Copy `src/lib/rbac/` and `src/lib/errors/`. In an ESM project, import with the `.js` extension; in CommonJS (e.g.
NestJS) drop it.
