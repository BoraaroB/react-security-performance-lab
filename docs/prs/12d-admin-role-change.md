# PR 12d: `PATCH /api/admin/users/:id/role`: admins change roles

## What and why
An admin can now make a user an admin, or make an admin a plain user. Two rules: **no self-demotion** (an admin
cannot change their own role) and **the caller must still be an admin at the moment of the write** (checked again,
not only by `requireAdmin` at the start of the request). Together they keep at least one admin in the app. Because the token has no role (step 08) and the user is loaded on every request (09c), a
demotion takes effect on the user's very next request. goal.md topic: "authentication and authorization".

## Changes
- `backend-express/src/app/store.ts`: `ROLES = ['user', 'admin'] as const` and `Role` built from it (second commit,
  see Review): the only list of roles.
- `backend-express/src/app/schemas/admin.schemas.ts` (new): `userIdParamsSchema` (`id` must be a UUID) and
  `changeRoleSchema` (`role`: `z.enum(ROLES)`; other fields are stripped).
- `backend-express/src/app/repositories/users.repository.ts`: `updateRole(id, role)`; `Role` is re-exported from `store.ts`.
- `backend-express/src/app/services/admin.service.ts`: `changeRole(currentAdmin, userId, role)` → `{ user, previousRole }`:
  unknown → 404 `NOT_FOUND`; own role → 409 `CANNOT_CHANGE_OWN_ROLE`; caller no longer an admin → 403 `FORBIDDEN`; else update.
- `backend-express/src/app/controllers/admin.controller.ts`: `changeRole` → 200 `{ user }`, plus an `info` log line
  "User role changed" with `adminId`, `userId`, `from`, `to` (IDs only), so a role change can be traced later.
- `backend-express/src/app/routes/admin.routes.ts`: `PATCH /users/:id/role` with `validate({ params, body })`.

**Why check the caller again?** `requireAdmin` runs at the start of the request, and `validate` is async, so other
requests can run in between. If admin A demotes admin B while B's request is waiting, B's request must not still
change roles. The re-check runs right before the write. It also keeps one admin: the caller is an admin at write time
and is not the target, so two admins demoting each other at the same time cannot leave none. In this in-memory store
the re-check and the write run without a pause; with a real database, they need one transaction.

**Why 409?** The request is valid and the caller is allowed to use the route; it conflicts with the current state
(its own role). A distinct code, so the frontend can show a precise message.

## How to test
`npm run dev` in `backend-express`, then the setup from PR 12b (`O`, `J`, `T`, `USER`) and `ADMIN` from PR 12c:
```bash
ID() { curl -s -H "Authorization: Bearer $ADMIN" localhost:4000/api/admin/users | node -pe "JSON.parse(require('fs').readFileSync(0)).users.find(u=>u.email==='$1').id"; }
ADMIN_ID=$(ID admin@example.com); USER_ID=$(ID user@example.com)
R() { curl -s -w " %{http_code}\n" -b jar.txt -H "$O" -H "$J" -H "X-CSRF-Token: $T" -H "Authorization: Bearer $1" \
  -X PATCH -d "$3" localhost:4000/api/admin/users/$2/role; }
R $USER $USER_ID '{"role":"admin"}'       # 403 FORBIDDEN (not an admin)
R $ADMIN $USER_ID '{"role":"root"}'       # 400 VALIDATION_ERROR
R $ADMIN $ADMIN_ID '{"role":"user"}'      # 409 CANNOT_CHANGE_OWN_ROLE
R $ADMIN $USER_ID '{"role":"admin"}'      # 200, role "admin"
R $USER $ADMIN_ID '{"role":"user"}'       # 200: the promoted user demotes the old admin (same token, no new login)
curl -s -H "Authorization: Bearer $ADMIN" localhost:4000/api/admin/users   # 403: demoted at once
```

## How to reuse in another project
Nothing new in `src/lib/`. The pattern: validate the ID and an allowlisted role → load the target → check the
rules (not yourself, caller still an admin) right before the write → write → log who changed whom.

## Verification
- `npm run typecheck` and `npm run build`: no errors.
- Smoke test (`tsx src/index.ts` + curl): user → 403 `FORBIDDEN`; no CSRF token → 403 `CSRF_INVALID`; `nope` as ID and
  `superadmin` as role → 400 with field details; unknown UUID → 404; self → 409 `CANNOT_CHANGE_OWN_ROLE`; promote with
  an extra `email` field → 200, email unchanged; the promoted user (same token) can list users and demote the old
  admin → 200; the old admin's token → 403 at once. Responses carry `no-store` and CORS headers; the log shows
  "User role changed" with `adminId`, `userId`, `from`, `to` (a no-op user → user shows `from: "user", to: "user"`).
- The race cannot be timed over HTTP, so a temporary script called the service directly: admins A and B, A demotes B,
  then B's stale request (B still passed as an admin) tries to demote A → 403 `FORBIDDEN`, and to promote a third user
  → 403 `FORBIDDEN`; one admin (A) left.

## Review
- **security-reviewer (low) → fixed:** the service trusted the caller's role from `requireAdmin`, but `validate` is
  async, so another admin could demote the caller before the write, and the stale request would still change a role.
  Now the caller is loaded again right before the write (403 if no longer an admin). That made the first version's
  `LAST_ADMIN` count (409) redundant, so it was removed with `countByRole`: simpler code, same guarantee.
- **code-reviewer (nit) + security-reviewer (low) → fixed:** the audit line was written for a no-op and did not show
  the old role. The service now returns `previousRole` and the line logs `from` and `to`.
- **code-reviewer (nit) → fixed (second commit, user's review):** the roles were written twice (`'user' | 'admin'` in
  `store.ts`, `z.enum(['user', 'admin'])` in the schema). Now `store.ts` has one `ROLES` array (`as const`); `Role` is
  `(typeof ROLES)[number]` and the schema uses `z.enum(ROLES)`. Not a TypeScript `enum`: it generates runtime code
  (not allowed with `erasableSyntaxOnly` / Node's type stripping), and a plain `'admin'` string would no longer be
  assignable to it. Re-checked: typecheck, build, `"root"` → 400 with the allowed options, `"admin"` → 200.

## Interview questions
1. **Why does a demotion work at once here, and what would change with the role inside the JWT?** The role is loaded
   from the store on every request. With a role claim in the token, the demoted admin would keep admin rights until
   the token expires (here up to 15 minutes), unless tokens were revoked or kept very short.
2. **Why check the caller's role again inside the service?** Time-of-check to time-of-use (TOCTOU): `requireAdmin`
   checked it at the start of the request, but another request can demote the caller before the write. Rules that
   depend on current state must be checked at write time (in one transaction with a real database).
3. **What else protects this endpoint?** `requireAdmin` (role from the loaded user), CSRF (PATCH is unsafe), Zod with
   an enum (no `"superadmin"`, extra fields stripped: mass assignment), a UUID check, and an audit log line.
