# PR 12a: Role checks (`authorize`) + `GET /api/admin/users`

## What and why
Until now the API only knew *who* you are (authentication). This PR adds *what you may do* (authorization, goal.md:
"authentication and authorization"): `authorize('admin')` lets a request through only when the logged-in user has an
allowed role, otherwise 403 `FORBIDDEN`. The first route that uses it is `GET /api/admin/users`. The role is read
from the user loaded from the store on this request (the token has no role), so a demoted admin loses access at once.
Step 12 is split (user's choice): 12a roles + admin list, 12b posts list/create, 12c delete with ownership, 12d change role.

## Changes
- `backend-express/src/lib/rbac/core.ts`: `hasRole(role, allowedRoles)` (deny by default, exact match) and `RbacConfigError`.
- `backend-express/src/lib/rbac/express.ts`: `createAuthorize({ getRole })` → `authorize(...roles)` middleware.
  No roles → throws at startup; no user on the request (wiring mistake) → 500; wrong role → 403.
- `backend-express/src/lib/rbac/index.ts`, `README.md`: public API and usage.
- `backend-express/src/app/repositories/users.repository.ts`: `findAll()`.
- `backend-express/src/app/services/admin.service.ts`, `controllers/admin.controller.ts`: `listUsers` → public user shape.
- `backend-express/src/app/routes/admin.routes.ts`: `Cache-Control: no-store`, then `requireAdmin` for the WHOLE
  router (future admin routes are protected by default), then `GET /users`.
- `backend-express/src/app/app.ts`: `requireAdmin = [...requireUser, authorize('admin')]`, router mounted at `/api/admin`.

## How to test
`npm run dev` in `backend-express`, then:
```bash
O='Origin: http://localhost:5173'
T=$(curl -s -c jar.txt localhost:4000/api/auth/csrf | node -pe 'JSON.parse(require("fs").readFileSync(0)).csrfToken')
login() { curl -s -b jar.txt -c jar.txt -H "$O" -H "X-CSRF-Token: $T" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"$2\"}" localhost:4000/api/auth/login | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken'; }
ADMIN=$(login admin@example.com 'Admin123!'); USER=$(login user@example.com 'User1234!')
curl -i localhost:4000/api/admin/users                                  # 401 UNAUTHORIZED
curl -i -H "Authorization: Bearer $USER" localhost:4000/api/admin/users  # 403 FORBIDDEN
curl -i -H "Authorization: Bearer $ADMIN" localhost:4000/api/admin/users # 200 { users: [...] }
```

## How to reuse in another project
Copy `src/lib/rbac/` and `src/lib/errors/`, install `express`.
```ts
const authorize = createAuthorize({ getRole: (req) => req.user?.role });
adminRouter.use(requireUser, authorize('admin'));
```

## Verification
- `npm run typecheck` and `npm run build`: no errors. `src/lib/rbac` imports only `lib/errors` from
  outside its folder (listed in its README).
- Smoke test (`tsx src/index.ts` + curl): no token → 401 + `WWW-Authenticate: Bearer`; user → 403; admin → 200 with
  both seeded users (no `passwordHash`); all three with `Cache-Control: no-store`. `GET /api/admin/nope` → 403 for a
  user, 404 for an admin.
- Temporary script: `authorize()` with no roles → `RbacConfigError`; no user on the request → `next(Error)` (500);
  `hasRole(undefined, ['admin'])` and `hasRole('admin', [])` → `false`.

## Review
code-reviewer and security-reviewer: no authorization bypass or fail-open path found (mount order, router-wide
guard, case-insensitive paths, fresh role per request, public user shape, `no-store` on 401/403 all checked).
- Fixed: `authorize` copied the role list with a comment saying it protects against the caller changing its array.
  Wrong: a rest parameter (`...allowedRoles`) is always a new array. Copy and comment removed.
- Fixed: the verification line said `lib/rbac` imports nothing from outside; it imports `lib/errors` (allowed, in the README).
- Fixed: a known gap in `PROGRESS.md` still said "Step 12" for the post size limit; now "Step 12b".
- Postponed (both reviewers, low): `GET /api/admin/users` has no pagination; every call decrypts every name.
  Harmless with the in-memory demo; added to "Known gaps".

## Interview questions
1. **401 vs 403?** 401: the server does not know who you are (no or invalid token), log in. 403: it knows, and you are
   not allowed; logging in again does not help.
2. **Why not put the role in the JWT?** It is a snapshot from login: a demoted admin keeps admin rights until the token
   expires. Loading the user per request makes a role change count at once (one primary-key lookup).
3. **The admin button is hidden in the frontend. Is that enough?** No. Anyone can call the URL with curl; every check
   that protects data must run on the server. Hiding the button is only UX.
