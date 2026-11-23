// App glue: Zod settings that must be in place before a schema is created. Every module that creates a schema
// imports this first (not main.tsx: that would move ~11 kB of Zod into the entry chunk of every page).
import { config } from 'zod/v4/core';

// Zod builds fast parsers with `new Function` and probes for it when a schema is created. Our CSP has no
// 'unsafe-eval', so the probe fails (Zod falls back) but the browser still reports a CSP violation.
// jitless skips the probe; parsing a form is just as fast for us.
config({ jitless: true });
