import path from 'node:path';
import { homedir } from 'node:os';
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

  it('resolves the default profile dir in an OS-standard user location', () => {
    const expected =
      process.platform === 'win32'
        ? path.join(process.env.LOCALAPPDATA ?? path.join(homedir(), 'AppData', 'Local'), 'canvas-mcp', 'profile')
        : process.platform === 'darwin'
          ? path.join(homedir(), 'Library', 'Application Support', 'canvas-mcp', 'profile')
          : path.join(homedir(), '.config', 'canvas-mcp', 'profile');

    expect(resolveProfileDir('D:/workspace/project')).toBe(expected);
  });

  it('applies configured values', () => {
    const projectRoot = path.join(path.sep, 'tmp', 'workspace', 'project');
    const browserPath =
      process.platform === 'win32'
        ? 'C:\\Browsers\\Chrome\\chrome.exe'
        : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

    process.env.CANVAS_BASE_URL = 'https://aula.uoc.edu/';
    process.env.CANVAS_PROFILE_DIR = 'custom-profile';
    process.env.CANVAS_BROWSER_PATH = browserPath;

    expect(getConfig(projectRoot)).toEqual({
      canvasBaseUrl: 'https://aula.uoc.edu',
      profileDir: path.resolve(projectRoot, 'custom-profile'),
      browserExecutablePath: browserPath,
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
