// The app's "database": plain Maps in this process's memory. Everything is lost on restart, which is fine for a
// learning project. Only repositories touch these Maps, so a real database could replace them without changing routes.

/** A user row exactly as stored. `nameEncrypted` is AES-256-GCM ciphertext: a dump of the store does not show names. */
export interface UserRecord {
  id: string;
  email: string; // normalized (trimmed, lowercase), plain text: login looks users up by it
  nameEncrypted: string;
  passwordHash: string; // bcrypt; the password itself is never stored
  role: 'user' | 'admin';
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
  const posts = new Map<string, PostRecord>();

  return {
    users,
    userIdsByEmail,
    posts,
    /** Empties everything (e.g. between tests). */
    reset() {
      users.clear();
      userIdsByEmail.clear();
      posts.clear();
    },
  };
}

export type Store = ReturnType<typeof createStore>;
