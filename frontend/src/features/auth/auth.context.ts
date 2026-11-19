import { createContext, useContext } from 'react';
import type { AuthUser } from './auth.api';
import type { LoginInput, RegisterInput } from './auth.schemas';

export type AuthContextValue = {
  // `null` = nobody is logged in. Only for the UI: the server checks every request on its own.
  user: AuthUser | null;
  // True until the session check on page load ends. Until then `user: null` does not mean "logged out".
  isRestoring: boolean;
  login: (input: LoginInput) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const auth = useContext(AuthContext);
  // Fail loudly: without the provider, every page would quietly look logged out.
  if (auth === null) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return auth;
}
