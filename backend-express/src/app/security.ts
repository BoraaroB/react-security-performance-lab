// Glue: the app-wide encryptor and password hasher, configured from `config`. One instance each, shared by everyone.
import { createEncryptor } from '../lib/crypto/index.js';
import { createPasswordHasher } from '../lib/password/index.js';
import { config } from './config.js';

export const encryptor = createEncryptor({ key: config.dataEncryptionKey });

// Default cost 12 (≈ 200 ms per hash). Raise it when servers get faster; needsRehash upgrades old hashes at login.
export const passwords = createPasswordHasher();
