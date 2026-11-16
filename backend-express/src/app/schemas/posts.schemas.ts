import { z } from 'zod';

// `.max()` counts UTF-16 code units. One unit is at most 3 bytes in UTF-8, so 10,000 units are at most ~30 kb and
// still fit the 32 kb JSON limit in app.ts. A bigger limit here needs a bigger limit there, or a long (valid) post
// gets 413 PAYLOAD_TOO_LARGE instead of a VALIDATION_ERROR the form can show.
const MAX_CONTENT_LENGTH = 10_000;

// Only `title` and `content`. A sent `authorId`, `id` or `createdAt` is stripped (z.object), and the service sets
// them itself, so nobody can post in someone else's name (mass-assignment protection).
// No HTML stripping: the text is stored as typed and escaped when it is shown (React does that), which is the XSS
// defense. Changing input text "to be safe" breaks real content (e.g. a post about `<script>` tags).
export const createPostSchema = z.object({
  // One line: no control or invisible characters (newline, zero-width space, right-to-left override, ...).
  title: z
    .string()
    .trim()
    .normalize('NFC')
    .min(1)
    .max(200)
    .regex(/^[^\p{Cc}\p{Cf}]+$/u, 'Must not contain control or invisible characters'),
  // Multi-line text: newline, carriage return and tab are the only control characters allowed. Others (NUL, ESC
  // terminal sequences, ...) have no place in a post, and JSON encodes each as `\u00XX` (6 bytes), so a few thousand
  // would hit the 32 kb limit (413) before this check. Invisible format characters (`\p{Cf}`) ARE allowed here, unlike
  // in the title: emoji such as 👩‍💻 need the zero-width joiner, and a post body is not used to identify anyone.
  content: z
    .string()
    .trim()
    .min(1)
    .max(MAX_CONTENT_LENGTH)
    .regex(/^(?:[^\p{Cc}]|[\n\r\t])*$/u, 'Must not contain control characters'),
});

export type CreatePostInput = z.output<typeof createPostSchema>;
