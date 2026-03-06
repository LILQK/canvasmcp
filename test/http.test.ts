import { describe, expect, it } from 'vitest';
import { decodeCsrfToken, extractCsrfTokenFromStorageState } from '../src/canvas/http.js';

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
});
