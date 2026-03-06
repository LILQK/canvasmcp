import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BrowserSessionManager } from './auth/browser-session.js';
import { getConfig } from './config.js';
import { registerTools } from './tools/register.js';
import packageJson from '../package.json' with { type: 'json' };

export async function runServer(): Promise<void> {
  const config = getConfig();
  const sessionManager = new BrowserSessionManager(config);

  await sessionManager.ensureAuthenticated();

  const server = new McpServer({
    name: 'canvas-local-mcp',
    version: packageJson.version
  });

  registerTools(server, {
    sessionManager
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('canvas-local-mcp server running on stdio');

  const shutdown = async (): Promise<void> => {
    await sessionManager.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
}
