import type { BrowserContext } from 'playwright';

export type BrowserStorageState = Awaited<ReturnType<BrowserContext['storageState']>>;
