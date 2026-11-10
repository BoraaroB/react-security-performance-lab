import type { PasswordHasher } from '../lib/password/index.js';
import type { NewUser, UsersRepository } from './repositories/users.repository.js';

// Public demo accounts (also listed in docs/IMPLEMENTATION_PLAN.md), so anyone can try the app. Their passwords are
// known to the whole world, so they must never exist on a real server: config turns seeding off in production by default.
const DEMO_ACCOUNTS: (Omit<NewUser, 'passwordHash'> & { password: string })[] = [
  { email: 'admin@example.com', name: 'Admin Demo', password: 'Admin123!', role: 'admin' },
  { email: 'user@example.com', name: 'User Demo', password: 'User1234!', role: 'user' },
];

/** Creates the demo accounts that do not exist yet. Returns the emails it created. */
export async function seedDemoAccounts(users: UsersRepository, passwords: PasswordHasher): Promise<string[]> {
  const created: string[] = [];
  for (const { password, ...account } of DEMO_ACCOUNTS) {
    if (users.findByEmail(account.email)) continue;
    // Stored like any real account: only the bcrypt hash, never the password.
    users.create({ ...account, passwordHash: await passwords.hash(password) });
    created.push(account.email);
  }
  return created;
}
