// Creates or completes local .env files: copies .env.example when .env is missing, then fills every EMPTY secret with
// a fresh random value. Existing values are never changed: a new encryption key would make old encrypted data unreadable.
// Secret values are never printed (terminal output ends up in CI logs and screenshots).
// Usage: node scripts/setup-env.mjs
import { randomBytes } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

// randomBytes reads the operating system's cryptographically secure generator. Never use Math.random() for
// secrets: it is not designed to be unpredictable, and its internal state can be recovered from a few outputs.
const secretsByProject = {
  'backend-express': {
    DATA_ENCRYPTION_KEY: () => randomBytes(32).toString('base64'), // 256-bit AES key
    JWT_SECRET: () => randomBytes(32).toString('base64url'), // 256-bit HMAC secret
  },
};

for (const [project, secrets] of Object.entries(secretsByProject)) {
  const envPath = join(root, project, '.env');
  if (!existsSync(envPath)) {
    copyFileSync(join(root, project, '.env.example'), envPath);
    console.log(`${project}/.env: created from .env.example`);
  }

  // Restrict the file BEFORE any secret is written into it (a copied .env.example is readable by everyone).
  chmodSync(envPath, 0o600);

  let text = readFileSync(envPath, 'utf8');
  let changed = false;
  for (const [name, generate] of Object.entries(secrets)) {
    // Also matches hand-edited forms (`export NAME=`, `NAME = value`): missing them would append a SECOND, new key
    // that may override the old one and make existing encrypted data unreadable.
    const line = new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=(.*)$`, 'm');
    const match = text.match(line);
    // `NAME=""` counts as empty: Node's .env loader reads it as an empty string.
    if (match && match[1].trim().replace(/^(['"])(.*)\1$/, '$2') !== '') {
      console.log(`${project}/.env: ${name} already set, kept`);
      continue;
    }
    const entry = `${name}=${generate()}`;
    // A function as the replacement, so `$` characters in a value are never treated as replacement patterns.
    text = match ? text.replace(line, () => entry) : `${text.trimEnd()}\n${entry}\n`;
    changed = true;
    console.log(`${project}/.env: ${name} generated`);
  }

  if (changed) {
    // Write a temp file, then rename it over .env: a crash or Ctrl-C mid-write must not truncate .env and lose an
    // existing key. The rename is atomic, so .env is always either the old or the new complete file.
    const tempPath = `${envPath}.tmp`;
    writeFileSync(tempPath, text, { mode: 0o600 });
    renameSync(tempPath, envPath);
  }
}
