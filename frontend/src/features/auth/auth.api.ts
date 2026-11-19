import { API_ORIGIN } from '@/config/http';
import { ApiError } from '@/lib/http';
import { authHttp, refreshSession, setAccessToken } from './auth.http';
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

export async function login(input: LoginInput): Promise<AuthResponse> {
  const response = await authHttp.request<AuthResponse>('/api/auth/login', { method: 'POST', body: input });
  setAccessToken(response.accessToken);
  return response;
}

// A new account is logged in at once: the answer is the same as login's (access token + refresh cookie).
export async function register(input: RegisterInput): Promise<AuthResponse> {
  const response = await authHttp.request<AuthResponse>('/api/auth/register', { method: 'POST', body: input });
  setAccessToken(response.accessToken);
  return response;
}

// On page load the access token is gone (it lived only in memory), but the httpOnly refresh cookie may still be
// there. Asking for a new access token is also how we learn who is logged in.
export async function restoreSession(): Promise<AuthUser | null> {
  try {
    const response = await refreshSession();
    return response.user;
  } catch (error) {
    // 401 = no cookie, or an expired or revoked one: simply nobody is logged in, not an error.
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function logout(): Promise<void> {
  // The server revokes the refresh token and clears the cookie. If this throws, the token stays, so the user
  // still looks logged in and can try again; forgetting it only here would leave a live session behind.
  await authHttp.request('/api/auth/logout', { method: 'POST' });
  setAccessToken(undefined);
}
