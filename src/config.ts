import { config as loadDotEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

loadDotEnv({ quiet: true });

const DEFAULT_BASE_URL = 'https://aula.uoc.edu';
const PROFILE_DIR_NAME = 'canvas-mcp';
const PROFILE_SUBDIR = 'profile';

export interface AppConfig {
  canvasBaseUrl: string;
  profileDir: string;
  browserExecutablePath: string | null;
  browserName: string;
}

interface BrowserCandidate {
  name: string;
  path: string;
}

export function resolveProjectRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);

  // In source mode we live under <root>/src, while compiled builds live under <root>/dist/src.
  if (path.basename(currentDir) === 'src') {
    const parentDir = path.dirname(currentDir);
    if (path.basename(parentDir) === 'dist') {
      return path.dirname(parentDir);
    }

    return parentDir;
  }

  return path.resolve(currentDir, '..');
}

export function resolveProfileDir(projectRoot = resolveProjectRoot()): string {
  const configured = process.env.CANVAS_PROFILE_DIR?.trim();
  if (!configured) {
    if (process.platform === 'win32') {
      const localAppData = process.env.LOCALAPPDATA;
      const base = localAppData && localAppData.trim().length > 0 ? localAppData : path.join(homedir(), 'AppData', 'Local');
      return path.join(base, PROFILE_DIR_NAME, PROFILE_SUBDIR);
    }

    if (process.platform === 'darwin') {
      return path.join(homedir(), 'Library', 'Application Support', PROFILE_DIR_NAME, PROFILE_SUBDIR);
    }

    return path.join(homedir(), '.config', PROFILE_DIR_NAME, PROFILE_SUBDIR);
  }

  return path.isAbsolute(configured) ? configured : path.resolve(projectRoot, configured);
}

function getWindowsBrowserCandidates(): BrowserCandidate[] {
  const programFiles = process.env.PROGRAMFILES;
  const programFilesX86 = process.env['PROGRAMFILES(X86)'];
  const localAppData = process.env.LOCALAPPDATA;

  return [
    { name: 'Google Chrome', path: [programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'].filter(Boolean).join(path.sep) },
    { name: 'Google Chrome', path: [programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'].filter(Boolean).join(path.sep) },
    { name: 'Google Chrome', path: [localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'].filter(Boolean).join(path.sep) },
    { name: 'Microsoft Edge', path: [programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'].filter(Boolean).join(path.sep) },
    { name: 'Microsoft Edge', path: [programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'].filter(Boolean).join(path.sep) },
    { name: 'Microsoft Edge', path: [localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'].filter(Boolean).join(path.sep) },
    { name: 'Brave', path: [programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'].filter(Boolean).join(path.sep) },
    { name: 'Brave', path: [programFilesX86, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'].filter(Boolean).join(path.sep) },
    { name: 'Brave', path: [localAppData, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'].filter(Boolean).join(path.sep) },
    { name: 'Vivaldi', path: [programFiles, 'Vivaldi', 'Application', 'vivaldi.exe'].filter(Boolean).join(path.sep) },
    { name: 'Vivaldi', path: [programFilesX86, 'Vivaldi', 'Application', 'vivaldi.exe'].filter(Boolean).join(path.sep) },
    { name: 'Opera', path: [localAppData, 'Programs', 'Opera', 'opera.exe'].filter(Boolean).join(path.sep) },
    { name: 'Opera GX', path: [localAppData, 'Programs', 'Opera GX', 'opera.exe'].filter(Boolean).join(path.sep) }
  ].filter((candidate) => candidate.path.length > 0);
}

function getMacBrowserCandidates(): BrowserCandidate[] {
  const userApplications = path.join(homedir(), 'Applications');

  return [
    { name: 'Google Chrome', path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
    { name: 'Google Chrome', path: path.join(userApplications, 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome') },
    { name: 'Microsoft Edge', path: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' },
    { name: 'Microsoft Edge', path: path.join(userApplications, 'Microsoft Edge.app', 'Contents', 'MacOS', 'Microsoft Edge') },
    { name: 'Brave', path: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser' },
    { name: 'Brave', path: path.join(userApplications, 'Brave Browser.app', 'Contents', 'MacOS', 'Brave Browser') },
    { name: 'Vivaldi', path: '/Applications/Vivaldi.app/Contents/MacOS/Vivaldi' },
    { name: 'Vivaldi', path: path.join(userApplications, 'Vivaldi.app', 'Contents', 'MacOS', 'Vivaldi') },
    { name: 'Opera', path: '/Applications/Opera.app/Contents/MacOS/Opera' },
    { name: 'Opera', path: path.join(userApplications, 'Opera.app', 'Contents', 'MacOS', 'Opera') }
  ];
}

function getLinuxBrowserCandidates(): BrowserCandidate[] {
  return [
    { name: 'Google Chrome', path: '/usr/bin/google-chrome-stable' },
    { name: 'Google Chrome', path: '/usr/bin/google-chrome' },
    { name: 'Chromium', path: '/usr/bin/chromium-browser' },
    { name: 'Chromium', path: '/usr/bin/chromium' },
    { name: 'Chromium', path: '/snap/bin/chromium' },
    { name: 'Microsoft Edge', path: '/usr/bin/microsoft-edge-stable' },
    { name: 'Microsoft Edge', path: '/usr/bin/microsoft-edge' },
    { name: 'Brave', path: '/usr/bin/brave-browser' },
    { name: 'Vivaldi', path: '/usr/bin/vivaldi-stable' },
    { name: 'Vivaldi', path: '/usr/bin/vivaldi' },
    { name: 'Opera', path: '/usr/bin/opera' }
  ];
}

function getBrowserCandidates(): BrowserCandidate[] {
  if (process.platform === 'win32') {
    return getWindowsBrowserCandidates();
  }

  if (process.platform === 'darwin') {
    return getMacBrowserCandidates();
  }

  return getLinuxBrowserCandidates();
}

export function resolveBrowserExecutable(projectRoot = resolveProjectRoot()): {
  browserExecutablePath: string | null;
  browserName: string;
} {
  const configuredPath = process.env.CANVAS_BROWSER_PATH?.trim();
  if (configuredPath) {
    const resolved = path.isAbsolute(configuredPath) ? configuredPath : path.resolve(projectRoot, configuredPath);
    return {
      browserExecutablePath: resolved,
      browserName: 'Configured browser'
    };
  }

  for (const candidate of getBrowserCandidates()) {
    if (existsSync(candidate.path)) {
      return {
        browserExecutablePath: candidate.path,
        browserName: candidate.name
      };
    }
  }

  return {
    browserExecutablePath: null,
    browserName: 'Playwright Chromium'
  };
}

export function normalizeCanvasBaseUrl(rawValue: string): string {
  const url = new URL(rawValue.trim());
  if (url.protocol !== 'https:') {
    throw new Error(`CANVAS_BASE_URL must use https: ${url.toString()}`);
  }

  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/+$/, '');
}

export function getConfig(projectRoot = resolveProjectRoot()): AppConfig {
  const browser = resolveBrowserExecutable(projectRoot);

  return {
    canvasBaseUrl: normalizeCanvasBaseUrl(process.env.CANVAS_BASE_URL?.trim() || DEFAULT_BASE_URL),
    profileDir: resolveProfileDir(projectRoot),
    browserExecutablePath: browser.browserExecutablePath,
    browserName: browser.browserName
  };
}
