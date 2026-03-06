import { config as loadDotEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

loadDotEnv({ quiet: true });

const DEFAULT_BASE_URL = 'https://aula.uoc.edu';
const DEFAULT_PROFILE_DIR = '.canvas-profile';

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
    return path.resolve(projectRoot, DEFAULT_PROFILE_DIR);
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

  for (const candidate of getWindowsBrowserCandidates()) {
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

export function getConfig(projectRoot = resolveProjectRoot()): AppConfig {
  const browser = resolveBrowserExecutable(projectRoot);

  return {
    canvasBaseUrl: (process.env.CANVAS_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    profileDir: resolveProfileDir(projectRoot),
    browserExecutablePath: browser.browserExecutablePath,
    browserName: browser.browserName
  };
}
