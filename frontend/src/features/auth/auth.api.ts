import { authHttp } from '@/config/http';
import type { LoginInput } from './auth.schemas';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
};

type AuthResponse = {
  accessToken: string;
  user: AuthUser;
};

type CsrfResponse = {
  csrfToken: string;
};

export async function login(input: LoginInput): Promise<AuthResponse> {
  // Every POST needs a CSRF token. This call also sets the CSRF cookie the server compares it with.
  // Temporary: step 21 keeps the token in memory instead of fetching it before every POST.
  const { csrfToken } = await authHttp.request<CsrfResponse>('/api/auth/csrf');
  return authHttp.request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: input,
    headers: { 'X-CSRF-Token': csrfToken },
  });
}
