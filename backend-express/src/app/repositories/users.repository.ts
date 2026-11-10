import { randomUUID } from 'node:crypto';
import type { Encryptor } from '../../lib/crypto/index.js';
import type { Store, UserRecord } from '../store.js';

export type Role = UserRecord['role'];

/**
 * A user as the rest of the app sees it: `name` is already decrypted. It still has `passwordHash`, so never send or
 * log a `User` as it is: map it to a public shape first.
 */
export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
}

/** The email is already registered. Catch it and answer exactly like the `findByEmail` check does. */
export class EmailTakenError extends Error {
  readonly code = 'EMAIL_TAKEN';
  constructor() {
    super('A user with this email already exists');
  }
}

export interface NewUser {
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
}

// Without one canonical form, "Ana@x.com" and "ana@x.com " could register as two different accounts.
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Table + column + row ID as the encryption context: a ciphertext copied into another user's row (or another
// encrypted column) fails to decrypt instead of showing the wrong person's data.
function nameContext(id: string): string {
  return `users.name:${id}`;
}

/** Data access for users. Encryption at rest happens here, so services and routes only ever see plain values. */
export function createUsersRepository(store: Store, encryptor: Encryptor) {
  // Returns a new object, so a caller changing it cannot change the stored row by accident.
  function toUser(record: UserRecord): User {
    const { nameEncrypted, ...rest } = record;
    return { ...rest, name: encryptor.decrypt(nameEncrypted, nameContext(record.id)) };
  }

  // A plain function, not `this.findById`: `this` breaks when a caller destructures the repository's methods.
  function findById(id: string): User | undefined {
    const record = store.users.get(id);
    return record && toUser(record);
  }

  return {
    /**
     * Throws `EmailTakenError` if the email is taken. This check is the real guard: a `findByEmail` check before it is
     * only a fast path, because two registrations with the same email can both pass it while they `await` the hash.
     */
    create(input: NewUser): User {
      const email = normalizeEmail(input.email);
      if (store.userIdsByEmail.has(email)) throw new EmailTakenError();
      const id = randomUUID(); // not guessable or countable, unlike 1, 2, 3...
      const record: UserRecord = {
        id,
        email,
        nameEncrypted: encryptor.encrypt(input.name, nameContext(id)),
        passwordHash: input.passwordHash,
        role: input.role,
        createdAt: new Date().toISOString(),
      };
      store.users.set(id, record);
      store.userIdsByEmail.set(email, id);
      return toUser(record);
    },

    findById,

    findByEmail(email: string): User | undefined {
      const id = store.userIdsByEmail.get(normalizeEmail(email));
      return id === undefined ? undefined : findById(id);
    },
  };
}

export type UsersRepository = ReturnType<typeof createUsersRepository>;
