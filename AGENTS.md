# AGENTS.md

This file is the high-signal project briefing for coding agents working in this repository.

## Project Summary

- Project: Canvas LMS MCP server
- npm package: `@canvas-mcp/server`
- Current package version: `0.1.2`
- Repo: `https://github.com/LILQK/canvasmcp`
- npm page: `https://www.npmjs.com/package/@canvas-mcp/server`
- Runtime model: local MCP server over `stdio`
- Auth model: live Playwright browser session kept open while the MCP runs
- License posture: source-visible but proprietary / `UNLICENSED`

This project started around UOC's Canvas instance, but it is now intended to work with any Canvas LMS deployment that:
- uses HTTPS
- exposes the standard authenticated Canvas API
- grants a reusable browser session cookie after login

The main configurable input is `CANVAS_BASE_URL`.

## Architecture

Core flow:

1. Client starts the MCP over `stdio`
2. CLI entrypoint runs `canvasmcp run`
3. Server opens a persistent Playwright browser context
4. User logs into Canvas in that browser
5. MCP validates session by calling Canvas API
6. Tools reuse that authenticated browser session for read-only API calls

Main files:

- [package.json](D:/_Storage/_Storage/_Proyectos/canvasmcp/package.json)
  Package metadata, scripts, npm publish settings, CLI bin.
- [src/cli.ts](D:/_Storage/_Storage/_Proyectos/canvasmcp/src/cli.ts)
  Minimal CLI dispatcher. Current supported command: `run`.
- [src/server.ts](D:/_Storage/_Storage/_Proyectos/canvasmcp/src/server.ts)
  MCP bootstrap over stdio.
- [src/config.ts](D:/_Storage/_Storage/_Proyectos/canvasmcp/src/config.ts)
  Environment parsing, project root resolution, browser detection, HTTPS enforcement.
- [src/auth/browser-session.ts](D:/_Storage/_Storage/_Proyectos/canvasmcp/src/auth/browser-session.ts)
  Live browser/session orchestration and login wait loop.
- [src/auth/session.ts](D:/_Storage/_Storage/_Proyectos/canvasmcp/src/auth/session.ts)
  Playwright persistent context launcher.
- [src/canvas/http.ts](D:/_Storage/_Storage/_Proyectos/canvasmcp/src/canvas/http.ts)
  Canvas HTTP client, origin hardening, pagination.
- [src/canvas/service.ts](D:/_Storage/_Storage/_Proyectos/canvasmcp/src/canvas/service.ts)
  Canvas domain logic and tool-facing operations.
- [src/tools/register.ts](D:/_Storage/_Storage/_Proyectos/canvasmcp/src/tools/register.ts)
  MCP tool registration and output schemas.

## Supported Tools

Current tool surface:

- `get_auth_status`
- `get_profile`
- `list_current_courses`
- `get_course_announcements`
- `get_discussion_topic_detail`
- `get_course_assignments`
- `get_assignment_detail`
- `get_submission_status`
- `get_course_activity`
- `get_course_calendar_events`
- `get_user_todo`
- `get_course_modules`
- `get_module_items`
- `get_course_files`
- `get_grades_summary`
- `search_course_content`
- `get_weekly_digest`

Intent:

- read-only only
- optimized for student workflow discovery
- `get_weekly_digest` is the best tool for "what do I have next week?"

## Configuration

Environment variables:

- `CANVAS_BASE_URL`
  Required in practice. Must be HTTPS. Example: `https://aula.uoc.edu`
- `CANVAS_PROFILE_DIR`
  Optional persistent browser profile path. Use a separate value per client.
- `CANVAS_BROWSER_PATH`
  Optional explicit browser executable path.

Important rule:

- never share the same `CANVAS_PROFILE_DIR` across multiple clients at the same time

Good examples:

- Claude: `.canvas-profile-claude`
- Cursor: `.canvas-profile-cursor`
- Windsurf: `.canvas-profile-windsurf`

## Client Invocation

Published invocation that works on Windows:

```bash
npx -y --package @canvas-mcp/server canvasmcp run
```

Do not assume `npx -y @canvas-mcp/server run` works on Windows. It was tested and failed to resolve the bin reliably.

For local repo usage:

```bash
node dist/src/cli.js run
```

## Development Commands

Install:

```bash
pnpm install
```

Checks:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Dev server:

```bash
pnpm dev
```

Compiled server:

```bash
pnpm start
```

Package locally:

```bash
npm pack
```

## Release Flow

Typical release steps:

1. Update `package.json` version
2. Run:
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm build`
   - `npm pack`
3. Commit changes
4. Push to GitHub
5. Publish to npm:

```bash
npm publish --access public --otp=CODE
```

Notes:

- npm publishing requires OTP / 2FA
- package scope is owned by the `canvas-mcp` org
- package is public on npm, repo is public on GitHub, but code license is still restrictive

## Security Decisions Already Made

Current hardening already in code:

- `CANVAS_BASE_URL` must use `https`
- Canvas HTTP requests are restricted to the configured origin
- pagination links on other origins are rejected
- tool responses may include HTML from Canvas, which should be treated as untrusted by any UI layer

Important implementation detail:

- When a live browser context exists, the code intentionally uses `browserContext.request`
- A prior hardening attempt switched everything to `request.newContext(...)` and caused regressions

## Known Issues

Open known issues at the time this file was written:

1. `get_course_files`
   Still reported by the user as failing with:
   `Canvas session missing or expired. Restart the MCP server and log in again when the browser window opens.`

2. Trusted device / "remember this PC for 30 days"
   The underlying university identity provider flow may open an extra prompt/modal to name the device.
   That subflow is still unstable in this browser automation setup.

3. Server version string mismatch
   [src/server.ts](D:/_Storage/_Storage/_Proyectos/canvasmcp/src/server.ts) still declares MCP server version `0.1.0`.
   Package version is already `0.1.2`.
   If you touch release/versioning again, sync this.

## Login Flow Notes

Current login logic in [src/auth/browser-session.ts](D:/_Storage/_Storage/_Proyectos/canvasmcp/src/auth/browser-session.ts):

- opens `CANVAS_BASE_URL`
- waits for `canvas_session` cookie
- waits until only one page remains and the active page is back on the configured Canvas host
- waits an additional stability window before API validation

This was added because some SSO providers open temporary popups or extra tabs.

What is not solved yet:

- certain identity-provider "trust this device" dialogs may still not persist correctly

## Discussion View Quirk

Canvas discussion topic `/view` responses are not stable across instances.

The code now handles both:

- array of entries
- object with `view` field containing entries

If discussion tools break again, inspect the exact response shape first before changing mapping logic.

## Testing Guidance

Good smoke tests after any auth, HTTP, or tool change:

1. Start the MCP
2. Log in successfully
3. Verify:
   - `get_auth_status`
   - `get_profile`
   - `list_current_courses`
   - `get_weekly_digest`
4. Re-check any tool you changed directly

For security-related changes, also test:

- origin validation still allows normal Canvas pagination
- login still works
- no unexpected output is emitted on `stdout`

## Client Docs

README already contains config examples for:

- Claude Desktop
- Cursor
- Windsurf
- Visual Studio Code
- Claude Code

If you update invocation or package naming, update README examples everywhere in one pass.

## Coding Guidance For Agents

- Preserve the live-browser-session model unless explicitly redesigning auth.
- Prefer fixing regressions with minimal behavioral changes first.
- Be careful when hardening request logic: Canvas has endpoint-specific quirks.
- Do not assume UOC-specific URLs in runtime behavior.
- Keep logs on `stderr`, not `stdout`, or you may break the MCP protocol.
- If touching packaging, always test the actual published invocation pattern:
  `npx -y --package @canvas-mcp/server canvasmcp run`
- If touching versioning, keep package version, npm release, and docs aligned.

## Suggested Next Fixes

Highest-priority follow-ups:

1. Fix `get_course_files`
2. Sync internal MCP server version with package version
3. Commit and publish README/license changes if they are not yet released
4. Investigate a more browser-native auth flow if trusted-device persistence matters
