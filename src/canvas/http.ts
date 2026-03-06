import { request, type APIRequestContext, type BrowserContext } from 'playwright';
import type { BrowserStorageState } from '../playwright-types.js';
import { CanvasAuthError, CanvasRequestError } from './errors.js';

interface CanvasHttpClientOptions {
  baseUrl: string;
  storageState: BrowserStorageState;
  browserContext?: BrowserContext;
}

function decodeCookieValue(rawValue: string | undefined): string | null {
  if (!rawValue) {
    return null;
  }

  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

export function decodeCsrfToken(rawValue: string | undefined): string | null {
  return decodeCookieValue(rawValue);
}

export function extractCsrfTokenFromStorageState(storageState: BrowserStorageState, baseUrl: string): string | null {
  const hostname = new URL(baseUrl).hostname;
  const cookie = storageState.cookies.find((candidate) => {
    if (candidate.name !== '_csrf_token') {
      return false;
    }

    return hostname.endsWith(candidate.domain.replace(/^\./, ''));
  });

  return decodeCookieValue(cookie?.value);
}

function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) {
    return null;
  }

  for (const segment of linkHeader.split(',')) {
    const [rawUrl, rawRel] = segment.split(';').map((part) => part.trim());
    if (rawRel === 'rel="next"') {
      return rawUrl.replace(/^<|>$/g, '');
    }
  }

  return null;
}

export class CanvasHttpClient {
  private readonly baseUrl: string;
  private readonly storageState: BrowserStorageState;
  private readonly browserContext?: BrowserContext;

  constructor(options: CanvasHttpClientOptions) {
    this.baseUrl = options.baseUrl;
    this.storageState = options.storageState;
    this.browserContext = options.browserContext;
  }

  private resolveUrl(pathOrUrl: string, searchParams?: URLSearchParams): string {
    if (pathOrUrl.startsWith('http')) {
      return pathOrUrl;
    }

    const base = new URL(this.baseUrl);
    const url = new URL(pathOrUrl, `${base.origin}/`);
    if (searchParams) {
      url.search = searchParams.toString();
    }

    return url.toString();
  }

  async withRequestContext<T>(callback: (api: APIRequestContext) => Promise<T>): Promise<T> {
    if (this.browserContext) {
      const csrfToken = decodeCookieValue(
        (await this.browserContext.cookies(this.baseUrl)).find((cookie) => cookie.name === '_csrf_token')?.value
      );

      if (csrfToken) {
        await this.browserContext.setExtraHTTPHeaders({ 'X-CSRF-Token': csrfToken });
      }
      return callback(this.browserContext.request);
    }

    const csrfToken = extractCsrfTokenFromStorageState(this.storageState, this.baseUrl);
    const api = await request.newContext({
      baseURL: this.baseUrl,
      storageState: this.storageState,
      extraHTTPHeaders: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined
    });

    try {
      return await callback(api);
    } finally {
      await api.dispose();
    }
  }

  async getJson<T>(api: APIRequestContext, pathOrUrl: string, searchParams?: URLSearchParams): Promise<T> {
    const response = await api.get(this.resolveUrl(pathOrUrl, searchParams));
    if (response.status() === 401 || response.status() === 403) {
      throw new CanvasAuthError();
    }

    if (!response.ok()) {
      throw new CanvasRequestError(`Canvas request failed: ${response.status()} ${response.statusText()}`, response.status(), await response.text());
    }

    return (await response.json()) as T;
  }

  async getPaginatedJson<T>(path: string, searchParams?: URLSearchParams, maxPages = 10): Promise<T[]> {
    return this.withRequestContext(async (api) => {
      const items: T[] = [];
      let nextUrl: string | null = this.resolveUrl(path, searchParams);
      let pageCount = 0;

      while (nextUrl && pageCount < maxPages) {
        const response = await api.get(nextUrl);
        if (response.status() === 401 || response.status() === 403) {
          throw new CanvasAuthError();
        }

        if (!response.ok()) {
          throw new CanvasRequestError(`Canvas request failed: ${response.status()} ${response.statusText()}`, response.status(), await response.text());
        }

        items.push(...((await response.json()) as T[]));
        nextUrl = parseNextLink(response.headers()['link'] ?? null);
        pageCount += 1;
      }

      return items;
    });
  }
}
