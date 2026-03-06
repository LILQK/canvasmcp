import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getConfig, normalizeCanvasBaseUrl, resolveProfileDir } from '../src/config.js';

const originalBaseUrl = process.env.CANVAS_BASE_URL;
const originalProfileDir = process.env.CANVAS_PROFILE_DIR;
const originalBrowserPath = process.env.CANVAS_BROWSER_PATH;

describe('config', () => {
  afterEach(() => {
    process.env.CANVAS_BASE_URL = originalBaseUrl;
    process.env.CANVAS_PROFILE_DIR = originalProfileDir;
    process.env.CANVAS_BROWSER_PATH = originalBrowserPath;
  });

  it('resolves the default profile dir relative to the project root', () => {
    expect(resolveProfileDir('D:/workspace/project')).toBe(path.resolve('D:/workspace/project', '.canvas-profile'));
  });

  it('applies configured values', () => {
    process.env.CANVAS_BASE_URL = 'https://aula.uoc.edu/';
    process.env.CANVAS_PROFILE_DIR = 'custom-profile';
    process.env.CANVAS_BROWSER_PATH = 'C:/Browsers/Chrome/chrome.exe';

    expect(getConfig('D:/workspace/project')).toEqual({
      canvasBaseUrl: 'https://aula.uoc.edu',
      profileDir: path.resolve('D:/workspace/project', 'custom-profile'),
      browserExecutablePath: 'C:/Browsers/Chrome/chrome.exe',
      browserName: 'Configured browser'
    });
  });

  it('normalizes the base url to https without trailing slash', () => {
    expect(normalizeCanvasBaseUrl('https://aula.uoc.edu/')).toBe('https://aula.uoc.edu');
  });

  it('rejects non-https base urls', () => {
    expect(() => normalizeCanvasBaseUrl('http://aula.uoc.edu')).toThrow('CANVAS_BASE_URL must use https:');
  });
});
