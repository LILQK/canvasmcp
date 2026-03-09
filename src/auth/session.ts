import { chromium, type BrowserContext } from 'playwright';
import type { BrowserStorageState } from '../playwright-types.js';

const HEADED_VIEWPORT = { width: 1280, height: 900 } as const;
const HEADLESS_VIEWPORT = { width: 1440, height: 1024 } as const;

interface LaunchPersistentCanvasContextOptions {
  profileDir: string;
  browserExecutablePath?: string | null;
}

interface StorageStateOptions extends LaunchPersistentCanvasContextOptions {
  baseUrl?: string;
}

export async function launchPersistentCanvasContext(
  options: LaunchPersistentCanvasContextOptions,
  headless: boolean
): Promise<BrowserContext> {
  return chromium.launchPersistentContext(options.profileDir, {
    executablePath: options.browserExecutablePath ?? undefined,
    chromiumSandbox: true,
    headless,
    ignoreDefaultArgs: ['--enable-automation'],
    viewport: headless ? HEADLESS_VIEWPORT : HEADED_VIEWPORT,
    args: headless ? [] : [`--window-size=${HEADED_VIEWPORT.width},${HEADED_VIEWPORT.height}`]
  });
}

export async function getStorageState(options: StorageStateOptions): Promise<BrowserStorageState> {
  const context = await launchPersistentCanvasContext(options, true);

  try {
    if (options.baseUrl) {
      const page = context.pages()[0] ?? (await context.newPage());
      await page.goto(options.baseUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
    }

    return await context.storageState();
  } finally {
    await context.close();
  }
}
