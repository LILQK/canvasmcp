export class CanvasAuthError extends Error {
  constructor(message = 'Canvas session missing or expired. Restart the MCP server and log in again when the browser window opens.') {
    super(message);
    this.name = 'CanvasAuthError';
  }
}

export class CanvasRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'CanvasRequestError';
  }
}
