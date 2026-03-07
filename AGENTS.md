# AGENTS.md

Agent-focused operating guide for this repository. This file complements [README.md](D:/_Storage/_Storage/_Proyectos/canvasmcp/README.md) with project context, exact commands, implementation notes, and current gotchas.

## Project Overview

- Project: Canvas LMS MCP server
- npm package: `@canvas-mcp/server`
- Current package version: `0.1.3`
- Repository: [LILQK/canvasmcp](https://github.com/LILQK/canvasmcp)
- npm page: [@canvas-mcp/server](https://www.npmjs.com/package/@canvas-mcp/server)
- Repository visibility: public
- License posture: MIT
- Runtime transport: `stdio`
- Auth strategy: live Playwright browser session kept open while the MCP server is running

The project started around UOC's Canvas instance, but runtime behavior is now intended to be Canvas-generic. The main runtime input is `CANVAS_BASE_URL`.

## Architecture

High-level flow:

1. MCP client starts the server over `stdio`
2. CLI entrypoint runs `canvasmcp run`
3. Server opens a persistent Playwright browser context
4. User completes login in the opened browser
5. MCP validates session by calling Canvas API on the configured Canvas host
6. Tools reuse that authenticated browser session for read-only API calls

Key files:

- [package.json](D:/_Storage/_Storage/_Proyectos/canvasmcp/package.json)
  Package metadata, npm publishing settings, scripts, and CLI bin.
- [src/cli.ts](D:/_Storage/_Storage/_Proyectos/canvasmcp/src/cli.ts)
  Minimal CLI dispatcher. Current supported command: `run`.
- [src/server.ts](D:/_Storage/_Storage/_Proyectos/canvasmcp/src/server.ts)
  MCP bootstrap over stdio. Version is synced from `package.json`.
- [src/config.ts](D:/_Storage/_Storage/_Proyectos/canvasmcp/src/config.ts)
  Environment parsing, project-root resolution, browser detection, HTTPS enforcement.
- [src/auth/browser-session.ts](D:/_Storage/_Storage/_Proyectos/canvasmcp/src/auth/browser-session.ts)
  Live browser/session orchestration and login wait loop.
- [src/auth/session.ts](D:/_Storage/_Storage/_Proyectos/canvasmcp/src/auth/session.ts)
  Playwright persistent-context launcher.
- [src/canvas/http.ts](D:/_Storage/_Storage/_Proyectos/canvasmcp/src/canvas/http.ts)
  Canvas HTTP client, same-origin hardening, pagination, request context handling.
- [src/canvas/service.ts](D:/_Storage/_Storage/_Proyectos/canvasmcp/src/canvas/service.ts)
  Canvas domain logic and tool-facing behavior.
- [src/tools/register.ts](D:/_Storage/_Storage/_Proyectos/canvasmcp/src/tools/register.ts)
  MCP tool registration and strict output schemas.

## Setup Commands

Install dependencies:

```bash
pnpm install
```

Run development server:

```bash
pnpm dev
```

Run compiled server:

```bash
pnpm start
```

Build:

```bash
pnpm build
```

The build always cleans `dist` first.

## Environment Configuration

Environment variables:

- `CANVAS_BASE_URL`
  Required in practice. Must use `https`. Example: `https://aula.uoc.edu`
- `CANVAS_PROFILE_DIR`
  Optional persistent browser profile path.
  If omitted, the server uses OS-default user locations:
  - Windows: `%LOCALAPPDATA%\canvas-mcp\profile`
  - macOS: `~/Library/Application Support/canvas-mcp/profile`
  - Linux: `~/.config/canvas-mcp/profile`
- `CANVAS_BROWSER_PATH`
  Optional explicit browser executable path.
  In normal usage this should not be needed: browser binaries are auto-detected, with fallback to Playwright Chromium.

Important rule:

- If multiple clients run at the same time, assign a different `CANVAS_PROFILE_DIR` for each one.

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

- Read-only only
- Optimized for student workload discovery
- `get_weekly_digest` is the best general answer for "what do I have next week?"

## Client Invocation

Published invocation that works on Windows:

```bash
npx -y --package @canvas-mcp/server canvasmcp run
```

Do not assume this will work on Windows:

```bash
npx -y @canvas-mcp/server run
```

That shorter form was tested and failed to resolve the bin reliably on Windows.

For local repo usage:

```bash
node dist/src/cli.js run
```

## Testing Instructions

Run all checks:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Packaging smoke test:

```bash
npm pack
```

Published-command smoke test:

```bash
npx -y --package @canvas-mcp/server canvasmcp run
```

Recommended manual smoke tests after auth, HTTP, or tool changes:

1. Start the MCP
2. Log in successfully
3. Verify:
   - `get_auth_status`
   - `get_profile`
   - `list_current_courses`
   - `get_weekly_digest`
4. Re-check any tool you changed directly

For security-related changes also verify:

- same-origin pagination still works
- login still works
- nothing writes unexpected output to `stdout`

## Code Style and Conventions

- TypeScript, NodeNext modules, ESM only
- Use strict schemas for MCP tool outputs
- Keep logs on `stderr`, never `stdout`, or you may break the MCP protocol
- Preserve the live-browser-session auth model unless explicitly redesigning auth
- Favor small, targeted regressions fixes over broad rewrites
- Do not assume UOC-specific URLs in runtime logic

## Security Notes

Current hardening already in code:

- `CANVAS_BASE_URL` must use `https`
- Canvas API requests are restricted to the configured origin
- pagination links on other origins are rejected
- HTML returned by Canvas is considered untrusted and should be sanitized by any UI rendering layer

Important implementation detail:

- When a live browser context exists, the code intentionally uses `browserContext.request`
- A previous hardening pass switched all requests to `request.newContext(...)` and caused regressions

## Login and Auth Notes

Current login logic in [src/auth/browser-session.ts](D:/_Storage/_Storage/_Proyectos/canvasmcp/src/auth/browser-session.ts):

- opens `CANVAS_BASE_URL`
- waits for `canvas_session` cookie
- waits until only one page remains and the active page is back on the configured Canvas host
- waits an additional stability window before API validation

This was added because some identity providers open temporary popups or extra tabs.

What is still not solved:

- Some identity-provider "trust this device" dialogs may still not persist correctly.
- The remembered-device flow is likely sensitive to Playwright/Chromium launch behavior.

## Known Quirks and Current Status

### `get_course_files`

This is not currently a confirmed session bug.

What was verified with the real user session:

- The endpoint `/api/v1/courses/:course_id/files` exists
- With the user's UOC session it returns `403 Forbidden`
- The body says the user is not authorized to perform that action

Interpretation:

- The route exists
- The user session is valid
- The issue is likely permissions on that endpoint for the current Canvas role, not expired auth

If working on this again:

- do not assume it is an auth failure
- prefer surfacing a permission error or fallback behavior over "session expired"

### Discussion topic `/view`

Canvas discussion topic `/view` responses are not stable across instances.

The code now handles both:

- array of entries
- object with `view` field containing entries

If discussion tools break again, inspect the exact response shape before changing mapping logic.

## Build, Packaging, and Release

Typical release flow:

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

Release notes:

- npm publishing requires OTP / 2FA
- package scope is owned by the `canvas-mcp` org
- package is public on npm
- repo is public on GitHub
- code license is MIT

## Client Documentation

README currently includes config examples for:

- Claude Desktop
- Cursor
- Windsurf
- Visual Studio Code
- Claude Code

If you change:

- package name
- CLI invocation
- environment variables
- client guidance

then update all README examples in one pass.

## Contributing and PR Expectations

- Keep changes scoped and testable
- Run `pnpm typecheck`, `pnpm test`, and `pnpm build` before committing
- If you touch auth, HTTP, or packaging, also run a manual smoke test
- For larger changes, prefer updating README and AGENTS.md together if user-facing behavior changes

## Suggested Next Fixes

Highest-priority follow-ups:

1. Decide whether `get_course_files` should:
   - return a permission error clearly, or
   - implement a fallback for student-visible attachments
2. Improve handling of trusted-device / remembered-device flows
3. Keep npm package version and published package aligned after each release
4. Update AGENTS.md whenever release flow, auth flow, or packaging conventions change
