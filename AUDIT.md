# BHARASENA pre-migration audit

Audit date: 5 October 2026  
Scope: the contents of `A:/44` compared with the pasted BHARASENA full-stack brief.  
This document describes the starting point. It does not treat the static prototype as a production release.

## Snapshot

The folder is a static, client-rendered prototype. It contains `index.html`, `styles.css`, a legacy `script.js`, one JavaScript interaction module (`src/experience.js`), event constants (`src/data/event.js`), and visual assets. A TypeScript copy at `src/scripts/experience.ts` is now present, but it is not referenced by the HTML and has no TypeScript project around it. There is no Astro application, package manifest, server, database, admin route, test suite, deployment configuration, or Git repository in this folder.

The visual direction is substantially aligned with “Three Night in Tribrata”: warm black/oxblood/champagne colours, curtains, chandelier, marble, the Budi Doremi photo, Indonesian copy, and no military or alcohol imagery. The content handoff correctly leaves venue, schedule, access, dress code, contact, and artist timing unpublished.

## Evidence collected

The following checks were run from `A:/44`:

| Check | Result |
| --- | --- |
| `Get-ChildItem -Recurse -File` | Only the static files and assets listed above were present. |
| `Test-Path package.json; ...` for Astro, TypeScript, Docker, data, and `src/scripts/experience.ts` | No package/config/build/deployment files were present at the first audit snapshot; the TypeScript copy was subsequently added by the migration work, but remains unreferenced. |
| `node --check src\\experience.js` | Passes syntax parsing. This is not a typecheck or browser test. |
| `node --check script.js` | Passes syntax parsing. The selectors target an older page and the file is not imported by the current HTML. |
| `git status --short` | Fails with “not a git repository”. |
| Search for admin/API/healthz/CSRF/CSP/database/message endpoints | No implementation found. |

No npm, browser, Docker, Lighthouse, or application test command can be run from this snapshot because the corresponding project configuration and dependencies do not exist.

## Findings

### P0 — the required production application does not exist yet

1. **No runnable project scaffold.** There is no `package.json`/lockfile, Astro config, TypeScript config, ESLint/Prettier config, `.nvmrc`, or scripts. Therefore the first five completion checks (`npm ci`, lint, typecheck, unit tests, and build) cannot even start. The root cause is that the folder is still a flat static handoff, not an Astro server project.
2. **No server or database.** All content lives in `src/data/event.js` and is bundled into the browser. There is no SQLite schema/migration runner, `src/lib/db.ts`, seed process, UTC persistence, or health check. Every B-1 and B-5 data requirement is missing.
3. **No admin/auth/moderation workflow.** `/admin`, account creation, password hashing, sessions, CSRF, audit log, CRUD, gallery upload, and preview time are absent. Panitia cannot change content without editing files and redeploying, so the central operational acceptance criterion is not met.
4. **No Dinding Pesan.** The HTML has no message form, approved neon messages, moderation state, or server protections (Zod validation, honeypot/time trap, HMAC IP hash, token bucket, profanity/link/email/phone filters). This is an entire required feature, not a styling gap.
5. **No deployment/quality pipeline.** Dockerfile, compose file, Caddy example, CI, Dependabot, backup script, and tests are absent. `npm audit`, E2E, and the Docker `/healthz` check cannot be demonstrated.

### P1 — static implementation conflicts with server-side requirements

6. **Unrestricted time preview and device-clock countdown.** `src/data/event.js:106-112` accepts `?now=` for every visitor. `src/experience.js:27-33` reads that value and `currentTime()` otherwise calls `new Date()` in the browser. The brief requires `?now=` only for a logged-in admin preview and a server-supplied `serverNow` for public countdowns. In the current design an unauthenticated visitor can change phase/live presentation and the clock, and a skewed device clock changes the countdown.
7. **Secrets cannot be protected by this architecture.** `envelopes` and placeholder rundown data are currently null/placeholder, but there is no server boundary that could withhold a future `body` or unreleased artist schedule. Putting real values in this static module would ship them to every client even when the UI is sealed.
8. **The required one-file TypeScript interaction is not wired.** `index.html:13` imports `src/experience.js`; the new `src/scripts/experience.ts` copy is not referenced, and there is no bundler/compiler configuration. The duplicate files can drift and the browser cannot consume `.ts` directly in a production build.
9. **Legacy `script.js` is stale and contradictory.** It queries `[data-header]`, `.menu-button`, `#site-nav`, `.site-nav`, and `#event-status`, none of which exist in the current HTML. Its tab code checks `panel.dataset.panel` while current panels use `data-day` (`script.js:49-60`). It is not imported, but leaving it in the project creates two incompatible interaction implementations and makes future maintenance unsafe.
10. **The static page is not reliable when opened with `file://`.** The ES module imports another local module (`src/experience.js` → `src/data/event.js`). Browsers commonly block this module graph under `file://` due to module CORS/security rules. The brief explicitly calls out this failure mode; a local HTTP dev server/build is required.
11. **The seal gate CSS does not match the generated DOM.** `src/experience.js:268-280` creates `.seal-card` and `.seal-wax`, while `styles.css:241-246` styles `.gate-card` and `.gate-seal`. Only the outer overlay and generic heading rules apply; the card width, panel treatment, wax seal, and progress ring styling do not. This is a concrete visual regression in the first interaction.
12. **Interactive controls are hidden from assistive technology.** `index.html:40` sets `aria-hidden="true"` on `.ballroom`, whose descendant `.chandelier` contains five focusable crystal `<button>` elements (`index.html:44`). A screen reader is instructed to ignore the entire subtree while keyboard users can still reach the controls. The decorative layers should be hidden individually and the interactive chandelier kept in the accessibility tree.
13. **The live rundown hooks have no source data.** The JavaScript looks for `data-live-status`, `data-live-progress`, and `data-session-start` (`src/experience.js:57-156`), but the HTML contains only a plain `#live-status` sentence and all `rundown` sessions are placeholders. Until database-backed non-placeholder sessions are rendered, live phase/progress cannot be exercised or verified.

### P2 — SEO, performance, and maintainability gaps

14. **Fonts are fetched from Google at runtime.** `index.html:9-11` uses Google Fonts instead of self-hosted font files. This adds a third-party dependency, can delay text rendering, and conflicts with the brief’s self-host/performance and strict-CSP goals.
15. **Sharing/SEO metadata is incomplete.** The document has `lang="id"`, title, and description, but no canonical URL, favicon, Open Graph/Twitter card, 1200×630 preview image, or conditional Event JSON-LD. Those are explicit launch requirements.
16. **No server-rendered content path exists.** The prototype is one static HTML file. Future DB content cannot be rendered into SEO-readable Astro pages or short-cache API responses without replacing the page architecture.
17. **No upload pipeline exists.** Gallery is an empty JavaScript array (`src/data/event.js:71-72`); the three public frames are placeholders. There is no size/magic-byte check, Sharp re-encoding, EXIF removal, responsive WebP/AVIF generation, outside-public storage, or media route.
18. **No security headers or structured error handling.** There is no middleware for CSP/HSTS/frame policy/permissions policy, no request ID or JSON logging, no 404/500 page, environment validation, proxy policy, graceful shutdown, or rate-limit state. The static page also has no way to enforce server-side output escaping or parameterized SQL because no server exists.
19. **No project-level documentation or release evidence.** README setup instructions, architecture ADRs, progress log, backup/restore instructions, and a final QA record are absent. `CONTENT_CHECKLIST.md` is useful for the content handoff but is not synchronized with an admin source of truth.

## What is already good and should be preserved

- The public copy is Bahasa Indonesia and keeps the supplied identity, dates, school, battalion name, and Budi Doremi credit.
- Unknown venue/contact/schedule values are presented as sealed or pending information rather than invented event facts.
- The invitation name is rendered with `textContent` and the canvas export stays in the browser, which aligns with the no-PII invitation requirement.
- The interaction module has guards for missing elements, a reduced-motion branch, a low-end mode, a shared requestAnimationFrame loop, keyboard paths for the seal/crystals/tabs, and an accessible skip link. These are good foundations to carry into the Astro/TypeScript implementation after server data is introduced.

## Migration order recommended by this audit

1. Scaffold the pinned Node/Astro/TypeScript toolchain and make a minimal HTTP page build; remove or quarantine the legacy `script.js`.
2. Add env validation, SQLite migrations, `src/lib/db.ts`, seed data, server time/phase helpers, and a `/healthz` endpoint before migrating UI data.
3. Implement crypto sessions, CSRF, headers, request IDs, and `/admin` before adding any mutable content route.
4. Move the public scenes into server-rendered Astro components. Only send opened envelope/artist fields and a `serverNow`; keep admin `?now=` handling server-side.
5. Add the Dinding Pesan validation/moderation path and tests, then gallery upload/media serving.
6. Wire `src/scripts/experience.ts` as the sole browser interaction module and fix the `.seal-card`/ARIA issues during migration.
7. Add unit/E2E tests, Docker/CI/backup documentation, then run the full acceptance matrix at the required viewports.

The next audit should be rerun after scaffolding so every completion item has a command, output, and environment documented instead of being inferred from file presence.
