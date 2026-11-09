# Public Claude Quick Translate Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the English-first Quick Translate app and a public MCP connector so any Claude account can send text to a paired page using an eight-character code.

**Architecture:** Keep the current lightweight translation experience and add it to a Sites-hosted Vinext Worker. D1 stores short-lived channel state. A Claude-compatible Streamable HTTP endpoint exposes `display_text`; public access has no account login, and a random eight-character channel code is the per-page bearer secret. Push the source to the user's GitHub repository and publish the app publicly through Sites.

**Tech Stack:** Vinext, TypeScript/JavaScript, Cloudflare Workers, D1, `@modelcontextprotocol/server` 2.4.0, Node's built-in test runner, browser speech synthesis.

**Spec:** `docs/superpowers/specs/2026-11-09-claude-translate-display-design.md`

## Global Constraints

- All user-facing UI and setup documentation are in English.
- No Claude API calls, embedded Claude chat, Google Calendar access, or Anthropic Directory submission.
- No app login, OAuth, or connector-wide bearer token; the eight-character code is the channel access key.
- Channel codes use a cryptographic random source and an alphabet that omits visually ambiguous characters.
- Channel idle expiry is 24 hours; latest text expiry is 15 minutes; text is limited to 5000 characters.
- Do not log channel codes or text content.
- Do not push until the source and history have been checked for accidental secrets; then make `nguyenkieuthinh/ZBrowerMod` public and push the implementation.
- Publish the Sites app with public audience; the Claude MCP endpoint must use Streamable HTTP at `/mcp` and remain separate from Sites' ChatGPT plugin capability.

## Review Focus

- Invalid, blank, and over-limit text must fail without replacing the current valid text; verify tool input boundaries.
- Expired channels and messages must not be readable or writable; verify idle and message TTL paths.
- A wrong channel code must never reveal another channel's latest text; verify cross-channel isolation.
- Concurrent poll and tool calls must not display stale text after a newer update; verify ordering by update timestamp/sequence.
- Missing browser speech voices must leave the text visible and show a usable fallback; verify UI behavior when no matching voice exists.

---

### Task 1: Scaffold the public Sites app and D1 binding

**Files:**
- Create: `sites/quick-translate/` from the Sites Vinext starter
- Create: `sites/quick-translate/.openai/hosting.json`
- Create: `sites/quick-translate/package.json` and starter configuration

**Interfaces:**
- Consumes: existing root `index.html` as the translation UI reference.
- Produces: a Sites project configured for a server-backed Worker and D1 binding `DB`; no `mcp` Sites capability.

- [ ] Run the Sites project setup helper in the new subdirectory and register one Site; persist its returned `project_id` unchanged in `.openai/hosting.json`.
- [ ] Add D1 binding `DB` to the hosting manifest and retain the Vinext `sites()` build integration.
- [ ] Add a migration for `channels`, `channel_text`, and `rate_limits` tables; use schema-only SQL and generated migration metadata.
- [ ] Start dependency installation as soon as setup is ready, without changing dependency inputs while it runs.

### Task 2: Port the translation page and add English channel controls

**Files:**
- Modify: `sites/quick-translate/app/page.tsx`
- Modify: `sites/quick-translate/app/layout.tsx`
- Create: `sites/quick-translate/public/quick-translate.html`

**Interfaces:**
- Consumes: the existing translation/voice behavior in root `index.html`.
- Produces: a root redirect to the static quick-translate page, plus English UI with `createChannel(): Promise<{code: string}>`, `fetchLatestText(code: string): Promise<ChannelText | null>`, copyable code, live result updates, and existing translate/speech controls.

- [ ] Copy the current translator page into `public/quick-translate.html`, translate all UI copy to English, and preserve language selection, translation, voice settings, and speech synthesis behavior.
- [ ] Make `app/page.tsx` redirect `/` to `/quick-translate.html` and update page metadata to English in `app/layout.tsx`.
- [ ] Add a “Create channel” action that requests a code, displays it with a copy control, stores the code in localStorage, and starts same-origin polling.
- [ ] Render incoming text in the result pane without reloading; update the voice language from a valid supplied BCP 47 tag and retain manual speaker playback.
- [ ] Cover channel UI states (no code, loading, active, expired, copy failure) and verify the responsive page manually.

### Task 3: Implement channel API, D1 expiry, and public MCP tool

**Files:**
- Create: `sites/quick-translate/app/api/channels/route.ts`
- Create: `sites/quick-translate/app/api/channel/latest/route.ts`
- Create: `sites/quick-translate/app/mcp/route.ts`
- Create: `sites/quick-translate/lib/channel-store.js`
- Create: `sites/quick-translate/lib/mcp.ts`
- Create: `sites/quick-translate/lib/channel-store.test.js`
- Create: `sites/quick-translate/db/schema.ts` and generated migration files

**Interfaces:**
- Produces: `createChannel(db, now): Promise<string>`, `publishText(db, code, text, language, now): Promise<ChannelText>`, `readLatest(db, code, now): Promise<ChannelText | null>`, and MCP tool `display_text({channel_code, text, language?})`.
- D1 channel code alphabet: `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`; code length: 8 characters.

- [ ] Write `node:test` unit tests for secure code generation, uniqueness handling, input validation, TTL, and channel isolation; run `node --test lib/channel-store.test.js` and confirm expected initial failures.
- [ ] Implement D1 channel creation with cryptographically secure 8-character codes; retry collisions and expire channels after 24 hours of inactivity.
- [ ] Implement `POST /api/channels` and `POST /api/channel/latest` with the code in the JSON body (never in a URL); expire current text after 15 minutes and never return data for an unknown or expired code.
- [ ] Implement the `/mcp` Streamable HTTP handler with the official MCP TypeScript SDK and only the `display_text` tool.
- [ ] Validate text length (1–5000 characters), reject blank text and invalid BCP 47 language tags, use parameterized D1 statements, and avoid logging text/code.
- [ ] Add bounded rate limiting for channel creation and tool calls; ensure throttling a shared Claude egress IP does not block unrelated channel codes.
- [ ] Run `node --test lib/channel-store.test.js` and verify an MCP Inspector call updates only the matching channel.

### Task 4: Document local use and Claude custom connector setup

**Files:**
- Modify: `README.md`
- Create/modify: `sites/quick-translate/README.md`
- Create: local development env example with no real secrets

**Interfaces:**
- Produces: exact local start commands, required environment names, channel code lifecycle, public connector URL instructions, and data expiry/privacy notes.

- [ ] Document the local app start command and how to create a channel.
- [ ] Document adding the public `/mcp` URL as a custom connector in Claude and sharing the page's channel code with Claude.
- [ ] State that anyone with the code can use that channel, text expires after 15 minutes, and an app account is not required.
- [ ] Keep every user-facing page string and user instruction in English.

### Task 5: Verify, push publicly, and deploy

**Files:**
- Finalize: `.openai/hosting.json`, migrations, app routes, README, and root repository contents.

**Interfaces:**
- Produces: public GitHub source, public Sites URL, public `/mcp` endpoint, and a ready-to-add custom connector URL.

- [ ] Run the project build, focused tests, MCP Inspector checks, and a local browser/manual flow using two channel codes.
- [ ] Review all tracked files and Git history for secrets or personal data before making the repository public.
- [ ] Commit the completed implementation and push it to `nguyenkieuthinh/ZBrowerMod`; change repository visibility to public if it is still private.
- [ ] Package and publish the exact pushed Site source, then set the Site audience to public and wait for deployment success.
- [ ] Verify the deployed page, create a channel, call `display_text` against the public endpoint, confirm matching page update, and confirm a different code cannot read it.
- [ ] Report the public page URL and exact MCP connector URL and show the user how to add the custom connector in Claude.
