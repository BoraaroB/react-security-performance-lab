import { API_ORIGIN } from '@/config/http';
import { authHttp, setAccessToken } from './auth.http';
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
