# Canvas UOC Local MCP

Local MCP server for `https://aula.uoc.edu` built on the Canvas LMS API v1. It runs over `stdio`, keeps a live browser session open while the MCP is running, and exposes a read-only tool surface for deadlines, announcements, modules, files, grades, and weekly planning.

## Requirements

- Node.js 24+
- `pnpm`
- A local Chromium-based browser. The login flow now prefers an installed browser such as Chrome, Edge, Brave, Vivaldi, or Opera; it falls back to Playwright Chromium if none is detected.

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create your local config:

   ```bash
   copy .env.example .env
   ```

2. Start the MCP server:

   ```bash
   pnpm dev
   ```

When the server starts it opens a browser window automatically, waits for a valid UOC Canvas session, and then keeps that window open while the MCP server is running. Do not close that browser window during use.

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

`get_weekly_digest` is the preferred tool for “what do I have next week?” style questions because assignments alone are often incomplete in UOC courses.

## Local Development

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

## MCP Client Example

Example `mcpServers` entry for a local client that supports `stdio`:

```json
{
  "mcpServers": {
    "canvas-uoc-local": {
      "command": "pnpm",
      "args": ["start"],
      "cwd": "D:\\_Storage\\_Storage\\_Proyectos\\canvasmcp"
    }
  }
}
```

## Configuration

`CANVAS_BASE_URL`

- Default: `https://aula.uoc.edu`

`CANVAS_PROFILE_DIR`

- Optional path to the Playwright persistent profile. Relative values are resolved from the project root.

`CANVAS_BROWSER_PATH`

- Optional path to a specific browser executable if autodetection does not pick the browser you want.
