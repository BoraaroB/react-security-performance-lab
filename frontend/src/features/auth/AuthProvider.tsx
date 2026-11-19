import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authApi from './auth.api';
import type { AuthUser } from './auth.api';
import { AuthContext } from './auth.context';
import type { LoginInput, RegisterInput } from './auth.schemas';

// Holds who is logged in, so the header and (in step 21c) the route guards can read it with `useAuth()`.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    // StrictMode runs this effect twice in development. The first run is cancelled here, and both runs share
    // ONE refresh request (single flight in auth.http.ts), so the refresh token is never sent twice.
    let isCancelled = false;

    async function restore() {
      let restoredUser: AuthUser | null = null;
      try {
        restoredUser = await authApi.restoreSession();
      } catch {
        // Network error or 5xx: show the app as logged out. The cookie is not touched, so a reload tries again.
      }
      if (isCancelled) {
        return;
      }
      setUser(restoredUser);
      setIsRestoring(false);
    }

    void restore();
    return () => {
      isCancelled = true;
    };
  }, []);

  // useCallback + useMemo: every component that calls useAuth() re-renders when this value is a new object.
  const login = useCallback(async (input: LoginInput) => {
    const response = await authApi.login(input);
    setUser(response.user);
    return response.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const response = await authApi.register(input);
    setUser(response.user);
    return response.user;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isRestoring, login, register, logout }),
    [user, isRestoring, login, register, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
