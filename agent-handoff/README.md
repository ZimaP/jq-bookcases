# JQ Bookcases — Agent Review Handoff

This branch is a persistent, review-only exchange channel between the local Codex producer and the ChatGPT owner-review agent.

## Non-negotiable scope

- JQ Bookcases only. Never place Project Table assets, geometry, code, or assumptions here.
- Keep this branch and its draft pull request open as a handoff channel. Do not merge it into `main`.
- This branch is evidence transport, not production authority and not deployment authority.
- Publish only owner-review evidence and sanitized validation reports.

## Producer protocol

1. Work in the authorized local JQ repository and preserve its dirty/protected baseline.
2. Use a separate temporary worktree or clean clone of this handoff branch so the working branch is not switched, cleaned, reset, stashed, or disturbed.
3. Create one immutable directory per review package:

   `agent-handoff/<phase-slug>/`

4. Include the decision-grade PNG views plus the minimum JSON/Markdown reports needed to interpret them.
5. Add `agent-handoff/<phase-slug>/manifest.json` containing:
   - project
   - phase
   - source repository
   - source branch and source HEAD
   - generation timestamp
   - preview/production boundary
   - exact file list
   - SHA-256 for every file
   - validation status
6. Update `agent-handoff/latest.json` in the same commit so the reviewer can discover the newest package without user copy/paste.
7. Commit only the handoff package and push this branch.
8. Do not claim owner approval. The owner-review agent records its decision in the draft PR conversation.

## Never upload here

- John Quinn emails, Gmail exports, or private correspondence
- original customer/source PDFs or files under `references/local/`
- credentials, tokens, secrets, environment files, or private customer data
- `.blend` scenes, caches, dependencies, build outputs, or large archives
- fabrication/CNC/boring/cut-list/install outputs unless the owner later authorizes a separate production review

## Reviewer protocol

1. Resolve `agent-handoff/latest.json` from this branch.
2. Fetch every declared artifact at the exact handoff commit SHA.
3. Verify hashes and visually inspect the PNG evidence.
4. Post the owner-review result or corrective instructions in the draft PR conversation.
5. Cite the exact reviewed commit SHA.
6. Never infer approval from computational validation alone.

## Current intended package

The first producer upload should be the sanitized Phase 1D-J owner-clay evidence:

- full orthographic front
- empty TV-opening proof
- eye-level three-quarter
- actual S2 section
- front registered overlay
- S2 registered overlay
- component-separation proof
- depth-plane evidence
- visual issue audit
- geometry delta
- validation report
- provenance manifest

The original local Phase 1D-I and Phase 1D-J directories remain protected and unchanged.
