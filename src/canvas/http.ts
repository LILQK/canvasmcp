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

export function resolveCanvasApiUrl(baseUrl: string, pathOrUrl: string, searchParams?: URLSearchParams): string {
  const base = new URL(baseUrl);
  const isAbsolute = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(pathOrUrl);
  const url = isAbsolute ? new URL(pathOrUrl) : new URL(pathOrUrl, `${base.origin}/`);

  if (url.origin !== base.origin) {
    throw new CanvasRequestError(`Canvas request blocked for unexpected origin: ${url.origin}`, 400, {
      allowedOrigin: base.origin,
      blockedUrl: url.toString()
    });
  }

  if (searchParams) {
    url.search = searchParams.toString();
  }

  return url.toString();
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
    return resolveCanvasApiUrl(this.baseUrl, pathOrUrl, searchParams);
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

    const storageState = this.storageState;
    const csrfToken = extractCsrfTokenFromStorageState(storageState, this.baseUrl);
    const api = await request.newContext({
      baseURL: this.baseUrl,
      storageState,
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
        const response = await api.get(this.resolveUrl(nextUrl));
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
