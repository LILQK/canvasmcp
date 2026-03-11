import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { attachShutdownHandlers } from '../src/server.js';

describe('server shutdown lifecycle', () => {
  it('closes the browser session when stdin closes', async () => {
    const processEvents = new EventEmitter();
    const stdin = new EventEmitter();
    const closeServer = vi.fn().mockResolvedValue(undefined);
    const closeSession = vi.fn().mockResolvedValue(undefined);
    const exit = vi.fn();
    const log = vi.fn();

    attachShutdownHandlers(
      {
        server: {
          close: closeServer,
          server: {}
        },
        sessionManager: {
          close: closeSession
        } as never
      },
      {
        processEvents: processEvents as never,
        stdin: stdin as never,
        exit: exit as never,
        log
      }
    );

    stdin.emit('close');
    await new Promise((resolve) => setImmediate(resolve));

    expect(closeServer).toHaveBeenCalledTimes(1);
    expect(closeSession).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
    expect(log).toHaveBeenCalledWith('Shutting down canvas-local-mcp (stdin close).');
  });

  it('reuses the same shutdown sequence if multiple events arrive', async () => {
    const processEvents = new EventEmitter();
    const stdin = new EventEmitter();
    const closeServer = vi.fn().mockResolvedValue(undefined);
    const closeSession = vi.fn().mockResolvedValue(undefined);
    const exit = vi.fn();

    attachShutdownHandlers(
      {
        server: {
          close: closeServer,
          server: {}
        },
        sessionManager: {
          close: closeSession
        } as never
      },
      {
        processEvents: processEvents as never,
        stdin: stdin as never,
        exit: exit as never,
        log: vi.fn()
      }
    );

    stdin.emit('end');
    processEvents.emit('SIGTERM');
    await new Promise((resolve) => setImmediate(resolve));

    expect(closeServer).toHaveBeenCalledTimes(1);
    expect(closeSession).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });
});
