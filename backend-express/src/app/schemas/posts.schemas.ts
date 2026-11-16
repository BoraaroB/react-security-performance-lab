import { z } from 'zod';

// No control characters (NUL, ESC, newline, ...) and no invisible ones (zero-width space, right-to-left override).
// For the title: it is one line, and invisible characters can make it look like something else.
const NO_CONTROL_OR_INVISIBLE_CHARACTERS = /^[^\p{Cc}\p{Cf}]+$/u;

// No control characters, except the ones multi-line text needs: newline (\n), carriage return (\r), tab (\t).
// Invisible characters are allowed here: emoji such as 👩‍💻 are built with an invisible "zero-width joiner".
const NO_CONTROL_CHARACTERS_EXCEPT_LINE_BREAKS = /^(?:[^\p{Cc}]|[\n\r\t])*$/u;

// `.max()` counts UTF-16 units (an emoji counts as 2). One unit is at most 3 bytes in UTF-8, so 10,000 of them
// always fit the 32 kb JSON limit in app.ts.
const MAX_CONTENT_LENGTH = 10_000;

// Only `title` and `content`. Any other field in the body (`authorId`, `id`, ...) is stripped, so nobody can post
// in someone else's name (mass assignment). HTML is NOT removed: React escapes it when the post is shown (XSS).
export const createPostSchema = z.object({
  title: z
    .string()
    .trim()
    .normalize('NFC')
    .min(1)
    .max(200)
    .regex(NO_CONTROL_OR_INVISIBLE_CHARACTERS, 'Must not contain control or invisible characters'),
  content: z
    .string()
    .trim()
    .min(1)
    .max(MAX_CONTENT_LENGTH)
    .regex(NO_CONTROL_CHARACTERS_EXCEPT_LINE_BREAKS, 'Must not contain control characters'),
});

export type CreatePostInput = z.output<typeof createPostSchema>;

// Post IDs are random UUIDs (posts.repository.ts), so anything else is rejected before the lookup.
export const postIdParamsSchema = z.object({
  id: z.uuid(),
});

export type PostIdParams = z.output<typeof postIdParamsSchema>;
