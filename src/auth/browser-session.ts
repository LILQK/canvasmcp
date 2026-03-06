import type { BrowserContext, Page } from 'playwright';
import { CanvasAuthError } from '../canvas/errors.js';
import { CanvasService } from '../canvas/service.js';
import type { AppConfig } from '../config.js';
import type { ProfileResult } from '../canvas/types.js';
import { readAuthState } from './state.js';
import { launchPersistentCanvasContext } from './session.js';

const LOGIN_STABILITY_MS = 4000;

async function hasCanvasSessionCookie(page: Page, baseUrl: string): Promise<boolean> {
  const cookies = await page.context().cookies(baseUrl);
  return cookies.some((cookie) => cookie.name === 'canvas_session');
}

function getPageHostname(page: Page): string | null {
  try {
    return new URL(page.url()).hostname;
  } catch {
    return null;
  }
}

export interface AuthStatusResult extends Record<string, unknown> {
  isAuthenticated: boolean;
  profileAvailable: boolean;
  profile: ProfileResult | null;
  lastValidatedAt: string | null;
  profileDir: string;
  browserName: string;
  browserOpen: boolean;
}

export class BrowserSessionManager {
  private context: BrowserContext | null = null;
  private service: CanvasService | null = null;
  private authPromise: Promise<ProfileResult> | null = null;
  private readonly canvasHost: string;
  private stableCanvasSince: number | null = null;

  constructor(private readonly config: AppConfig) {
    this.canvasHost = new URL(config.canvasBaseUrl).hostname;
  }

  private async ensureContext(): Promise<BrowserContext> {
    if (this.context) {
      return this.context;
    }

    this.context = await launchPersistentCanvasContext(
      {
        profileDir: this.config.profileDir,
        browserExecutablePath: this.config.browserExecutablePath
      },
      false
    );

    return this.context;
  }

  private async ensureService(): Promise<CanvasService> {
    if (this.service) {
      return this.service;
    }

    const context = await this.ensureContext();
    const storageState = await context.storageState();
    this.service = new CanvasService({
      baseUrl: this.config.canvasBaseUrl,
      profileDir: this.config.profileDir,
      storageState,
      browserContext: context
    });

    return this.service;
  }

  async ensureAuthenticated(): Promise<ProfileResult> {
    if (this.authPromise) {
      return this.authPromise;
    }

    this.authPromise = this.runInteractiveLogin();
    try {
      return await this.authPromise;
    } finally {
      this.authPromise = null;
    }
  }

  private async runInteractiveLogin(): Promise<ProfileResult> {
    const context = await this.ensureContext();
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(this.config.canvasBaseUrl, { waitUntil: 'domcontentloaded' });

    console.error(
      [
        `Opened ${this.config.canvasBaseUrl} in ${this.config.browserName}.`,
        'Log in to your Canvas account if needed.',
        'If your identity provider asks to trust or remember this device, finish that prompt before returning to Canvas.',
        'Do not close this browser window while the MCP server is running.'
      ].join('\n')
    );

    const timeoutAt = Date.now() + 10 * 60 * 1000;
    while (Date.now() < timeoutAt) {
      const pages = context.pages();
      const activePage = pages[pages.length - 1] ?? page;
      const activeHost = getPageHostname(activePage);
      const hasOnlyCanvasPage = pages.length === 1 && activeHost === this.canvasHost;
      const hasCanvasSession =
        activeHost === this.canvasHost && (await hasCanvasSessionCookie(activePage, this.config.canvasBaseUrl));

      if (!hasOnlyCanvasPage || !hasCanvasSession) {
        this.stableCanvasSince = null;
        await activePage.waitForTimeout(3000);
        continue;
      }

      if (this.stableCanvasSince === null) {
        this.stableCanvasSince = Date.now();
        await activePage.waitForTimeout(LOGIN_STABILITY_MS);
        continue;
      }

      if (Date.now() - this.stableCanvasSince < LOGIN_STABILITY_MS) {
        await activePage.waitForTimeout(1000);
        continue;
      }

      try {
        const service = await this.ensureService();
        const profile = await service.getProfile();
        console.error(`Authenticated as ${profile.name} (${profile.loginId ?? 'unknown login'}).`);
        return profile;
      } catch (error) {
        if (!(error instanceof CanvasAuthError)) {
          throw error;
        }
      }

      this.stableCanvasSince = null;
      await activePage.waitForTimeout(5000);
    }

    throw new Error('Timed out waiting for a valid Canvas session during MCP startup.');
  }

  async getService(): Promise<CanvasService> {
    await this.ensureAuthenticated();
    return this.ensureService();
  }

  async getAuthStatus(): Promise<AuthStatusResult> {
    const state = await readAuthState(this.config.profileDir);

    try {
      const service = await this.getService();
      const profile = await service.getProfile();
      return {
        isAuthenticated: true,
        profileAvailable: true,
        profile,
        lastValidatedAt: new Date().toISOString(),
        profileDir: this.config.profileDir,
        browserName: this.config.browserName,
        browserOpen: this.context !== null
      };
    } catch (error) {
      if (!(error instanceof CanvasAuthError)) {
        throw error;
      }

      return {
        isAuthenticated: false,
        profileAvailable: state !== null,
        profile: null,
        lastValidatedAt: state?.lastValidatedAt ?? null,
        profileDir: this.config.profileDir,
        browserName: this.config.browserName,
        browserOpen: this.context !== null
      };
    }
  }

  async close(): Promise<void> {
    this.service = null;
    if (this.context) {
      const context = this.context;
      this.context = null;
      await context.close();
    }
  }
}
