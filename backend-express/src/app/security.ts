// Glue: the app-wide encryptor, password hasher, access-token and CSRF-token services, configured from `config`. One instance each, shared by everyone.
import { createEncryptor } from '../lib/crypto/index.js';
import { createCsrfTokenService } from '../lib/csrf/index.js';
import { createAccessTokenService } from '../lib/jwt/index.js';
import { createPasswordHasher } from '../lib/password/index.js';
import { config } from './config.js';

export const encryptor = createEncryptor({ key: config.dataEncryptionKey });

// Default cost 12 (≈ 200 ms per hash). Raise it when servers get faster; needsRehash upgrades old hashes at login.
export const passwords = createPasswordHasher();

// Fixed issuer/audience: a token signed with the same secret for another service or purpose is rejected.
// Default TTL: 15 minutes.
export const accessTokens = createAccessTokenService({
  secret: config.jwtSecret,
  issuer: 'react-security-lab-api',
  audience: 'react-security-lab-web',
});

export const csrfTokens = createCsrfTokenService({ secret: config.csrfSecret });
