# Canvas LMS MCP

[![npm version](https://img.shields.io/npm/v/%40canvas-mcp%2Fserver)](https://www.npmjs.com/package/@canvas-mcp/server)
[![npm downloads](https://img.shields.io/npm/dm/%40canvas-mcp%2Fserver)](https://www.npmjs.com/package/@canvas-mcp/server)
[![GitHub stars](https://img.shields.io/github/stars/LILQK/canvasmcp?style=social)](https://github.com/LILQK/canvasmcp)
[![GitHub issues](https://img.shields.io/github/issues/LILQK/canvasmcp)](https://github.com/LILQK/canvasmcp/issues)
[![License](https://img.shields.io/badge/license-UNLICENSED-red)](./LICENSE)

Local MCP server for Canvas LMS instances. It runs over `stdio`, keeps a live browser session open while the MCP is running, and exposes a read-only tool surface for deadlines, announcements, modules, files, grades, and weekly planning.

## Highlights

- Works with Canvas LMS web sessions and the standard Canvas API.
- Supports weekly planning, assignments, announcements, modules, files, grades, and content search.
- Runs locally over `stdio` and opens a live browser session for authentication.
- Published on npm as [`@canvas-mcp/server`](https://www.npmjs.com/package/@canvas-mcp/server).

UOC is only an example Canvas deployment. Replace the base URL with your university Canvas URL.

## Does My University Use Canvas?

One quick way to check is:

1. Go to [Canvas login discovery](https://www.instructure.com/canvas/login).
2. Select `Students and Educators`.
3. Search for your university name.
4. If your institution appears, it is using Canvas.

## Requirements

- Node.js 20+
- A local Chromium-based browser. The login flow prefers an installed browser such as Chrome, Edge, Brave, Vivaldi, or Opera; it falls back to Playwright Chromium if none is detected.

## Runtime Notes

- This MCP uses the standard Canvas web session and Canvas API.
- It should work with many Canvas-based institutions, but the login experience can vary because each university may use different SSO or identity-provider flows.
- The current implementation is not hardcoded to UOC anymore; it opens whatever `CANVAS_BASE_URL` you configure and validates the session against that Canvas host.
- The main compatibility requirement is that, after login, the Canvas instance exposes the standard authenticated API and sets a reusable Canvas session cookie in the browser session.

## Package Usage

Run the published package directly with `npx`:

```bash
npx -y --package @canvas-mcp/server canvasmcp run
```

When the server starts it opens a browser window automatically, waits for a valid Canvas session, and then keeps that window open while the MCP server is running. Do not close that browser window during use.

## MCP Client Config

Use a dedicated `CANVAS_PROFILE_DIR` per client so multiple AI tools do not fight over the same browser profile.

Replace `CANVAS_BASE_URL` with your university Canvas URL.

### Claude Desktop

```json
{
  "mcpServers": {
    "canvasmcp": {
      "command": "npx",
      "args": [
        "-y",
        "--package",
        "@canvas-mcp/server",
        "canvasmcp",
        "run"
      ],
      "env": {
        "CANVAS_BASE_URL": "https://canvas.your-university.edu",
        "CANVAS_BROWSER_PATH": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "CANVAS_PROFILE_DIR": "D:\\canvasmcp\\.canvas-profile-claude"
      }
    }
  }
}
```

### Cursor

```json
{
  "mcpServers": {
    "canvasmcp": {
      "command": "npx",
      "args": [
        "-y",
        "--package",
        "@canvas-mcp/server",
        "canvasmcp",
        "run"
      ],
      "env": {
        "CANVAS_BASE_URL": "https://canvas.your-university.edu",
        "CANVAS_BROWSER_PATH": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "CANVAS_PROFILE_DIR": "D:\\canvasmcp\\.canvas-profile-cursor"
      }
    }
  }
}
```

### Windsurf

Windsurf uses `~/.codeium/windsurf/mcp_config.json`.

```json
{
  "mcpServers": {
    "canvasmcp": {
      "command": "npx",
      "args": [
        "-y",
        "--package",
        "@canvas-mcp/server",
        "canvasmcp",
        "run"
      ],
      "env": {
        "CANVAS_BASE_URL": "https://canvas.your-university.edu",
        "CANVAS_BROWSER_PATH": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "CANVAS_PROFILE_DIR": "D:\\canvasmcp\\.canvas-profile-windsurf"
      }
    }
  }
}
```

Source: [Windsurf MCP docs](https://docs.windsurf.com/windsurf/cascade/mcp)

### Visual Studio Code

VS Code supports MCP servers through `mcp.json`. Add this to your user or workspace config:

```json
{
  "servers": {
    "canvasmcp": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "--package",
        "@canvas-mcp/server",
        "canvasmcp",
        "run"
      ],
      "env": {
        "CANVAS_BASE_URL": "https://canvas.your-university.edu",
        "CANVAS_BROWSER_PATH": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "CANVAS_PROFILE_DIR": "D:\\canvasmcp\\.canvas-profile-vscode"
      }
    }
  }
}
```

Source: [VS Code MCP docs](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)

### Claude Code

Claude Code can add local stdio servers from the CLI. On Windows, the official docs note that `npx` often needs a `cmd /c` wrapper.

```bash
claude mcp add-json canvasmcp "{\"type\":\"stdio\",\"command\":\"cmd\",\"args\":[\"/c\",\"npx\",\"-y\",\"--package\",\"@canvas-mcp/server\",\"canvasmcp\",\"run\"],\"env\":{\"CANVAS_BASE_URL\":\"https://canvas.your-university.edu\",\"CANVAS_BROWSER_PATH\":\"C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe\",\"CANVAS_PROFILE_DIR\":\"D:\\\\canvasmcp\\\\.canvas-profile-claudecode\"}}"
```

Source: [Claude Code MCP docs](https://code.claude.com/docs/en/mcp)

## Available Tools

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

`get_weekly_digest` is the preferred tool for “what do I have next week?” style questions because assignments alone are often incomplete in many Canvas courses.

## Configuration

`CANVAS_BASE_URL`

- Canvas base URL for your institution.
- Example: `https://aula.uoc.edu`
- Must use `https`.

`CANVAS_PROFILE_DIR`

- Optional path to the Playwright persistent profile. Relative values are resolved from the project root.
- Use a different value per client, for example `.canvas-profile-claude`, `.canvas-profile-cursor`, `.canvas-profile-windsurf`.

`CANVAS_BROWSER_PATH`

- Optional path to a specific browser executable if autodetection does not pick the browser you want.

## Local Development

Install dependencies:

```bash
pnpm install
```

Create local config if needed:

```bash
copy .env.example .env
```

Start the MCP server in development:

```bash
pnpm dev
```

Build and run the compiled server:

```bash
pnpm build
pnpm start
```

Run checks:

```bash
pnpm typecheck
pnpm test
```

## Contributing

Issues and pull requests are welcome for bug reports, fixes, and compatibility improvements.

By contributing, you agree that your contributions may be used in this project under the repository license and ownership terms. If you want to propose a larger change, open an issue first so the approach can be discussed before implementation.

## Security Notes

- Tool responses may include `html` fields returned by Canvas. Treat that HTML as untrusted content and sanitize it before rendering in any client UI.
- The MCP only follows Canvas API requests on the configured `CANVAS_BASE_URL` origin.

