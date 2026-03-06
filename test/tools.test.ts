import { describe, expect, it, vi } from 'vitest';
import type { BrowserSessionManager } from '../src/auth/browser-session.js';
import { registerTools } from '../src/tools/register.js';

class FakeServer {
  readonly tools = new Map<string, { config: unknown; handler: (...args: never[]) => Promise<unknown> }>();

  registerTool(name: string, config: unknown, handler: (...args: never[]) => Promise<unknown>): void {
    this.tools.set(name, { config, handler });
  }
}

describe('tool registration', () => {
  it('returns structured data for course listings', async () => {
    const fakeServer = new FakeServer();
    const fakeService = {
      listCurrentCourses: vi.fn().mockResolvedValue([
        {
          id: 10,
          name: 'Test Course',
          courseCode: '20.101',
          workflowState: 'available',
          termName: '2026',
          accountName: 'UOC',
          startAt: null,
          endAt: null
        }
      ])
    };
    const sessionManager = {
      getService: vi.fn().mockResolvedValue(fakeService)
    } as unknown as BrowserSessionManager;

    registerTools(fakeServer as never, { sessionManager });

    const tool = fakeServer.tools.get('list_current_courses');
    const result = (await tool?.handler({ includeHistorical: false } as never)) as {
      structuredContent: {
        courses: Array<{ id: number }>;
      };
    };

    expect(result.structuredContent.courses[0]?.id).toBe(10);
  });

  it('returns auth status with the declared structured shape', async () => {
    const fakeServer = new FakeServer();
    const sessionManager = {
      getAuthStatus: vi.fn().mockResolvedValue({
        isAuthenticated: true,
        profileAvailable: true,
        lastValidatedAt: '2026-03-06T10:00:00Z',
        profileDir: '.canvas-profile',
        browserName: 'Google Chrome',
        browserOpen: true,
        profile: {
          id: 1,
          name: 'Ethan',
          loginId: 'enavarrogut',
          primaryEmail: 'ethan@example.com',
          timeZone: 'Europe/Madrid',
          locale: 'es-ES'
        }
      })
    };

    registerTools(fakeServer as never, { sessionManager: sessionManager as never });

    const tool = fakeServer.tools.get('get_auth_status');
    const result = (await tool?.handler()) as {
      structuredContent: {
        browserName: string;
        browserOpen: boolean;
      };
    };

    expect(result.structuredContent.browserName).toBe('Google Chrome');
    expect(result.structuredContent.browserOpen).toBe(true);
  });

  it('returns a weekly digest payload', async () => {
    const fakeServer = new FakeServer();
    const sessionManager = {
      getWeeklyDigest: vi.fn(),
      getService: vi.fn().mockResolvedValue({
        getWeeklyDigest: vi.fn().mockResolvedValue({
          from: '2026-03-09T00:00:00Z',
          to: '2026-03-16T00:00:00Z',
          includeHistorical: false,
          items: [
            {
              classification: 'formal_deadline',
              courseId: 10,
              courseName: 'Test Course',
              title: 'Entrega final',
              sourceType: 'assignment',
              itemId: '55',
              htmlUrl: 'https://aula.uoc.edu/courses/10/assignments/55',
              relevantDate: {
                raw: '2026-03-12T10:00:00Z',
                localDateTime: '2026-03-12T11:00:00'
              },
              snippet: null,
              confidence: 'high',
              matchedTerms: []
            }
          ],
          sourcesChecked: ['assignments', 'announcements'],
          confidence: 'high',
          warnings: []
        })
      })
    };

    registerTools(fakeServer as never, { sessionManager: sessionManager as never });

    const tool = fakeServer.tools.get('get_weekly_digest');
    const result = (await tool?.handler({
      from: '2026-03-09T00:00:00Z',
      to: '2026-03-16T00:00:00Z',
      includeHistorical: false,
      includeSignals: true
    } as never)) as {
      structuredContent: {
        items: Array<{ classification: string }>;
      };
    };

    expect(result.structuredContent.items[0]?.classification).toBe('formal_deadline');
  });
});
