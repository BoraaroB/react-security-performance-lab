// The app's "database": plain Maps in this process's memory. Everything is lost on restart, which is fine for a
// learning project. Only repositories touch these Maps, so a real database could replace them without changing routes.

// The only list of roles: the type below and the Zod schema (admin.schemas.ts) are both built from it.
// A plain array with `as const`, not a TypeScript `enum`: plain strings like 'admin' still type-check, and nothing is
// generated at runtime.
export const ROLES = ['user', 'admin'] as const;
export type Role = (typeof ROLES)[number]; // 'user' | 'admin'

/** A user row exactly as stored. `nameEncrypted` is AES-256-GCM ciphertext: a dump of the store does not show names. */
export interface UserRecord {
  id: string;
  email: string; // normalized (trimmed, lowercase), plain text: login looks users up by it
  nameEncrypted: string;
  passwordHash: string | null; // bcrypt; the password itself is never stored. null: an OAuth-only account
  role: Role;
  createdAt: string; // ISO 8601
}

/** A post row exactly as stored. Not encrypted: every logged-in user can read posts anyway. */
export interface PostRecord {
  id: string;
  authorId: string; // the logged-in user who created it
  title: string;
  content: string; // as the user typed it; the frontend escapes it when it shows it (XSS)
  createdAt: string; // ISO 8601
}

export function createStore() {
  const users = new Map<string, UserRecord>();
  // A second Map as an index: finding a user by email is one lookup instead of a scan over all users.
  const userIdsByEmail = new Map<string, string>();
  // "Log in with GitHub" links: `<provider>:<providerUserId>` → user ID. Like an `oauth_identities` table.
  const userIdsByOAuthIdentity = new Map<string, string>();
  const posts = new Map<string, PostRecord>();

  return {
    users,
    userIdsByEmail,
    userIdsByOAuthIdentity,
    posts,
    /** Empties everything (e.g. between tests). */
    reset() {
      users.clear();
      userIdsByEmail.clear();
      userIdsByOAuthIdentity.clear();
      posts.clear();
    },
  };
}

export type Store = ReturnType<typeof createStore>;
