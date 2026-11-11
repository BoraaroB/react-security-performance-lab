# Fix: the access token carries only the user ID

## What and why
PR #15 (step 08) was merged with `role` inside the access token. The follow-up commit that removes it was pushed
after the merge, so it never reached `main`. This PR brings it in. A role in the token is a snapshot from login:
a demoted admin would keep admin rights until the token expires (up to 15 minutes). With only `sub`, the app loads
the current user (and role) by ID on each protected request (step 09), so a role change or a deleted account applies
at once. Topic: S2 (JWT, authorization).

## Changes
- `backend-express/src/lib/jwt/core.ts`: `AccessTokenClaims` = `{ sub }`; `sign({ sub })` signs an empty payload with `subject`; `verify` returns `{ sub }`.
- `backend-express/src/lib/jwt/index.ts`, `README.md`: wording, and a note on why only the ID (and when roles in tokens are normal: microservices, RFC 9068).
- `backend-express/src/app/routes/demo.ts`: the tamper example changes `sub` to another user's ID (acting as that user) instead of `role`.
- `docs/prs/08-jwt-access-token.md`, `docs/PROGRESS.md`, `docs/IMPLEMENTATION_PLAN.md`: decision "no role in the token", step 08 ✅.

## How to test
```bash
cd backend-express && npm run dev
curl -s localhost:4000/api/demo/jwt   # payload has no "role"; verify.subChangedToOtherUser → TOKEN_INVALID
curl -s localhost:4000/api/demo/jwt/protected -H "Authorization: Bearer <token>"   # 200 {"auth":{"sub":"demo-user-id"}}
```

## How to reuse in another project
Same as step 08: copy `src/lib/jwt/`. Sign with `accessTokens.sign({ sub: user.id })` and load the user by
`req.auth.sub` after `authenticate`.

## Verification
- `npm run typecheck` and `npm run build`: pass.
- curl: payload without `role`; valid token → 200 `{"auth":{"sub":"demo-user-id"}}`; `subChangedToOtherUser`, `algNone`,
  `otherAudience` → `TOKEN_INVALID`; no header → 401 + `WWW-Authenticate: Bearer`.
- Temporary script: no `exp`, other secret, HS512 → `TOKEN_INVALID`; 1 s token after 2 s → `TOKEN_EXPIRED`; config errors as before.

## Review
The same code change was reviewed on `pr/08-jwt-access-token` (commit 897a22b): security-reviewer no findings;
code-reviewer three doc nits, all fixed (see `docs/prs/08-jwt-access-token.md`). Re-run on this branch:
- **security-reviewer:** no findings.
- **code-reviewer:** two doc nits, both fixed: this "Review" section was still a placeholder; and the step 08
  description now says at the top that PR #15 was merged with `role` and the `sub`-only version landed here.

## Interview questions
1. **Role in the JWT or not?** In a monolith: only `sub`, load the user per request (cheap primary-key lookup; role
   changes apply at once). In microservices behind an identity provider: roles/scopes in a short-lived token, because
   services cannot reach the user database; sensitive actions are re-checked.
2. **Does loading the user by `sub` make the token revocable?** No. It gets current user data, but after a logout the
   token still passes `authenticate` until `exp`. Only a deny-list (state) or a short TTL limits that.
