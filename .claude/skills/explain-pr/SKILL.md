---
name: explain-pr
description: Explains a finished PR (branch pr/NN-...) in plain language for learning and interview prep. Walks through the diff file by file, explains the security and performance concepts, and asks quiz questions. Use when the user asks "explain the PR", "what did you do", "I don't understand this", "objasni PR", "prepare me for the interview", or "quiz me".
---

# explain-pr: explain a PR for learning

The user has limited experience with security and optimization. Explain like a mentor, not like reference docs.

## Steps

1. Pick the PR: the number the user gave, or the current `pr/*` branch, or the latest merge on `main`.
2. Read `docs/prs/NN-...md` and the diff (`git diff main...pr/NN-...` or the merge commit's diff).
3. Explain, in order:
   - **The problem (1–2 sentences):** what an attacker could do, or what would be slow or leak, WITHOUT this code.
     Give a concrete scenario (e.g. "a malicious site sends a POST to your API while you are logged in").
   - **The solution, file by file:** only the key lines (quote 3–10 lines) and why they are written that way.
   - **What breaks if we remove X:** 1–2 examples, e.g. "without `algorithms: ['HS256']` ...".
   - **How it looks in another framework** (Express ↔ Nest ↔ plain Node), when relevant.
4. Quiz: 3 interview-style questions. Ask first; give the answers only after the user replies or says "answer".

## Style

- Use the user's chat language (Serbian if they write in Serbian). Short sentences, no needless jargon; define each technical term the first time.
- Link files as `[file.ts:12](path/file.ts#L12)`.
- Do not change code in this skill. If you spot a bug, report it and suggest fixing it in the next PR.
