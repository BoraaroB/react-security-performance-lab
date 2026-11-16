// Everything GitHub-specific lives in this file; core.ts (PKCE, state, code exchange) stays the same for every provider.
import { z } from 'zod';
import { OAuthError, type OAuthProfile } from '../core.js';

// `createOAuthClient({ ...GITHUB_ENDPOINTS, scopes: GITHUB_SCOPES, clientId, clientSecret, redirectUri })`.
export const GITHUB_ENDPOINTS = {
  authorizeUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
};

// The public profile needs no scope. `user:email` (read-only) adds /user/emails: the public profile email is often
// hidden, and only /user/emails says whether an address is verified.
export const GITHUB_SCOPES = ['user:email'];

const GITHUB_API = 'https://api.github.com';
const TIMEOUT_MS = 10_000;

// 254 = the longest deliverable address, as in our register schema.
const emailSchema = z.email().max(254);

// `id` never changes. `login` (the username) can be renamed and then taken by someone else, so it is never the key.
const userSchema = z.object({
  id: z.number().int().positive(),
  login: z.string().min(1),
  name: z.string().nullable(),
});
// `email` is only a string here: one odd secondary address must not fail the whole list. Only the address we use
// is checked as an email (below).
const emailsSchema = z.array(
  z.object({
    email: z.string(),
    primary: z.boolean(),
    verified: z.boolean(),
  }),
);

async function getGithubJson(path: string, accessToken: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${GITHUB_API}${path}`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${accessToken}` },
      // The token must go only to api.github.com, never be re-sent to wherever a redirect points.
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new OAuthError('GitHub API could not be reached', { cause: error });
  }
  if (!response.ok) throw new OAuthError(`GitHub API ${path} answered HTTP ${response.status}`);
  return response.json().catch(() => null);
}

/** Reads who logged in. Needs a token with the `user:email` scope. Throws `OAuthError`. */
export async function fetchGithubProfile(accessToken: string): Promise<OAuthProfile> {
  const userData = await getGithubJson('/user', accessToken);
  const emailsData = await getGithubJson('/user/emails', accessToken);
  const user = userSchema.safeParse(userData);
  const emails = emailsSchema.safeParse(emailsData);
  if (!user.success || !emails.success) throw new OAuthError('Unexpected GitHub API response');

  // Only the primary AND verified address: anyone can add an unverified address that belongs to someone else.
  const primary = emails.data.find((entry) => entry.primary && entry.verified);
  if (!primary) throw new OAuthError('GitHub account has no verified primary email');
  const email = emailSchema.safeParse(primary.email);
  if (!email.success) throw new OAuthError('GitHub primary email is not a valid address');

  return {
    provider: 'github',
    providerUserId: String(user.data.id),
    email: email.data,
    name: user.data.name ?? user.data.login,
  };
}
