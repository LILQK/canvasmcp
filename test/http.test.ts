import { describe, expect, it } from 'vitest';
import { CanvasRequestError } from '../src/canvas/errors.js';
import { decodeCsrfToken, extractCsrfTokenFromStorageState, resolveCanvasApiUrl } from '../src/canvas/http.js';

describe('csrf helpers', () => {
  it('decodes csrf cookies', () => {
    expect(decodeCsrfToken('abc%3D123')).toBe('abc=123');
  });

  it('extracts the csrf token from storage state', () => {
    const token = extractCsrfTokenFromStorageState(
      {
        cookies: [
          {
            name: '_csrf_token',
            value: 'csrf%3Dvalue',
            domain: '.uoc.edu',
            path: '/',
            expires: -1,
            httpOnly: false,
            secure: true,
            sameSite: 'Lax'
          }
        ],
        origins: []
      },
      'https://aula.uoc.edu'
    );

    expect(token).toBe('csrf=value');
  });

  it('accepts relative API paths', () => {
    expect(resolveCanvasApiUrl('https://aula.uoc.edu', '/api/v1/users/self/profile')).toBe(
      'https://aula.uoc.edu/api/v1/users/self/profile'
    );
  });

  it('accepts absolute URLs on the configured origin', () => {
    expect(resolveCanvasApiUrl('https://aula.uoc.edu', 'https://aula.uoc.edu/api/v1/courses?per_page=50')).toBe(
      'https://aula.uoc.edu/api/v1/courses?per_page=50'
    );
  });

  it('preserves explicit query params for resolved URLs', () => {
    const params = new URLSearchParams([
      ['per_page', '100'],
      ['include[]', 'submission']
    ]);

    expect(resolveCanvasApiUrl('https://aula.uoc.edu', '/api/v1/courses/10/assignments', params)).toBe(
      'https://aula.uoc.edu/api/v1/courses/10/assignments?per_page=100&include%5B%5D=submission'
    );
  });

  it('rejects absolute URLs on other origins', () => {
    expect(() => resolveCanvasApiUrl('https://aula.uoc.edu', 'https://evil.example/api/v1/courses')).toThrowError(
      CanvasRequestError
    );
  });

  it('rejects pagination links on other origins', () => {
    expect(() =>
      resolveCanvasApiUrl('https://aula.uoc.edu', 'https://evil.example/api/v1/courses?page=2')
    ).toThrowError(CanvasRequestError);
  });
});
