import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { EventEmitter } from 'node:events';
import { BrowserSessionManager } from './auth/browser-session.js';
import { getConfig } from './config.js';
import { registerTools } from './tools/register.js';
import packageJson from '../package.json' with { type: 'json' };

interface Closable {
  close(): Promise<void>;
}

interface ShutdownEventTarget {
  once(event: string, listener: (...args: unknown[]) => void): this;
  off(event: string, listener: (...args: unknown[]) => void): this;
}

interface ShutdownHooks {
  processEvents?: ShutdownEventTarget;
  stdin?: ShutdownEventTarget;
  exit?: (code: number) => never;
  log?: (message: string) => void;
}

export function attachShutdownHandlers(
  resources: {
    server: Closable & { server?: { onclose?: (() => void) | undefined } };
    sessionManager: BrowserSessionManager;
  },
  hooks: ShutdownHooks = {}
): { shutdown: (reason: string, exitCode?: number) => Promise<void> } {
  const processEvents = hooks.processEvents ?? process;
  const stdin = hooks.stdin ?? (process.stdin as EventEmitter as ShutdownEventTarget);
  const exit = hooks.exit ?? process.exit;
  const log = hooks.log ?? console.error;

  let shutdownPromise: Promise<void> | null = null;

  const onSigint = (): void => {
    void shutdown('SIGINT');
  };
  const onSigterm = (): void => {
    void shutdown('SIGTERM');
  };
  const onStdinEnd = (): void => {
    void shutdown('stdin end');
  };
  const onStdinClose = (): void => {
    void shutdown('stdin close');
  };
  const onDisconnect = (): void => {
    void shutdown('process disconnect');
  };
  const onUncaughtException = (error: unknown): void => {
    log(error instanceof Error ? error.stack ?? error.message : String(error));
    void shutdown('uncaughtException', 1);
  };
  const onUnhandledRejection = (error: unknown): void => {
    log(error instanceof Error ? error.stack ?? error.message : String(error));
    void shutdown('unhandledRejection', 1);
  };

  const detachHandlers = (): void => {
    processEvents.off('SIGINT', onSigint);
    processEvents.off('SIGTERM', onSigterm);
    processEvents.off('disconnect', onDisconnect);
    processEvents.off('uncaughtException', onUncaughtException);
    processEvents.off('unhandledRejection', onUnhandledRejection);
    stdin.off('end', onStdinEnd);
    stdin.off('close', onStdinClose);
  };

  const shutdown = async (reason: string, exitCode = 0): Promise<void> => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      detachHandlers();
      log(`Shutting down canvas-local-mcp (${reason}).`);

      try {
        await resources.server.close();
      } catch (error) {
        log(`Error while closing MCP transport: ${error instanceof Error ? error.message : String(error)}`);
      }

      try {
        await resources.sessionManager.close();
      } catch (error) {
        log(`Error while closing browser session: ${error instanceof Error ? error.message : String(error)}`);
      }
    })();

    try {
      await shutdownPromise;
    } finally {
      exit(exitCode);
    }
  };

  if (resources.server.server) {
    resources.server.server.onclose = () => {
      void shutdown('transport closed');
    };
  }

  processEvents.once('SIGINT', onSigint);
  processEvents.once('SIGTERM', onSigterm);
  processEvents.once('disconnect', onDisconnect);
  processEvents.once('uncaughtException', onUncaughtException);
  processEvents.once('unhandledRejection', onUnhandledRejection);
  stdin.once('end', onStdinEnd);
  stdin.once('close', onStdinClose);

  return { shutdown };
}

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
  attachShutdownHandlers({ server, sessionManager });
  console.error('canvas-local-mcp server running on stdio');
}
