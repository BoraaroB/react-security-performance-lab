# env

Validates environment variables with Zod at startup. A bad config stops the server immediately ("fail fast")
instead of causing a security hole or a crash later.

## Dependencies
- npm: `zod@^4`
- Node 20.12+ (uses the built-in `process.loadEnvFile`, no `dotenv`)
- lib: none

## Usage

```ts
import { z } from 'zod';
import { EnvValidationError, loadEnvFile, parseEnv } from './lib/env/index.js';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  JWT_SECRET: z.string().min(32),
});

function loadConfig() {
  loadEnvFile(); // optional .env; real env vars win
  try {
    return parseEnv(schema, process.env); // typed: PORT is a number
  } catch (error) {
    if (error instanceof EnvValidationError) {
      console.error(error.message); // lists every invalid variable, without its value
      process.exit(1);
    }
    throw error;
  }
}

export const env = loadConfig();
```

## API

| Function | Description |
|---|---|
| `parseEnv(schema, source)` | Validates `source` and returns typed values. Throws `EnvValidationError`. |
| `loadEnvFile(path = '.env')` | Loads the file into `process.env` if it exists. Returns `true`/`false`. |

## How to reuse
Copy `src/lib/env/` and install `zod`. In an ESM project, import with the `.js` extension (`./lib/env/index.js`).
`parseEnv` is pure (it only reads what you pass in), so it is easy to unit-test with a plain object.
