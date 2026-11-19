import { z } from 'zod';

// Mirrors the server's createPostSchema (backend-express/src/app/schemas/posts.schemas.ts), only for quick feedback:
// the server validates again. HTML is allowed in the text: React shows it as text, it never runs (XSS).

// One-line title: no control characters, and no invisible ones that could make it look like something else.
const NO_CONTROL_OR_INVISIBLE_CHARACTERS = /^[^\p{Cc}\p{Cf}]+$/u;
// Multi-line content: line breaks and tabs are allowed (and invisible joiners, which some emoji need).
const NO_CONTROL_CHARACTERS_EXCEPT_LINE_BREAKS = /^(?:[^\p{Cc}]|[\n\r\t])*$/u;

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 10_000;

export const createPostSchema = z.object({
  title: z
    .string()
    .trim()
    // Before the length check, like the server: "é" pasted as "e" + accent counts as 1 character, not 2.
    .normalize('NFC')
    .min(1, 'Enter a title')
    .max(MAX_TITLE_LENGTH, `At most ${MAX_TITLE_LENGTH} characters`)
    .regex(NO_CONTROL_OR_INVISIBLE_CHARACTERS, 'Must not contain control or invisible characters'),
  content: z
    .string()
    .trim()
    .min(1, 'Write something')
    .max(MAX_CONTENT_LENGTH, `At most ${MAX_CONTENT_LENGTH} characters`)
    .regex(NO_CONTROL_CHARACTERS_EXCEPT_LINE_BREAKS, 'Must not contain control characters'),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
