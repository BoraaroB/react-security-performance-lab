import { API_ORIGIN, authHttp } from '@/config/http';
import type { LoginInput, RegisterInput } from './auth.schemas';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
};

// The API's start route: it sets the state + PKCE cookie and redirects to GitHub.
export const GITHUB_LOGIN_URL = `${API_ORIGIN}/api/auth/oauth/github`;

type AuthResponse = {
  accessToken: string;
  user: AuthUser;
};

type CsrfResponse = {
  csrfToken: string;
};

// Every POST needs a CSRF token. This call also sets the CSRF cookie the server compares it with.
// Temporary: step 21 keeps the token in memory instead of fetching it before every POST.
async function fetchCsrfToken(): Promise<string> {
  const { csrfToken } = await authHttp.request<CsrfResponse>('/api/auth/csrf');
  return csrfToken;
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const csrfToken = await fetchCsrfToken();
  return authHttp.request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: input,
    headers: { 'X-CSRF-Token': csrfToken },
  });
}

// A new account is logged in at once: the answer is the same as login's (access token + refresh cookie).
export async function register(input: RegisterInput): Promise<AuthResponse> {
  const csrfToken = await fetchCsrfToken();
  return authHttp.request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: input,
    headers: { 'X-CSRF-Token': csrfToken },
  });
}
