import fs from 'node:fs/promises';
import path from 'node:path';

export interface AuthStateRecord {
  lastValidatedAt: string | null;
  lastKnownUserId: number | null;
  lastKnownLoginId: string | null;
}

const AUTH_STATE_FILE = 'auth-state.json';

export function getAuthStatePath(profileDir: string): string {
  return path.join(profileDir, AUTH_STATE_FILE);
}

export async function readAuthState(profileDir: string): Promise<AuthStateRecord | null> {
  try {
    const raw = await fs.readFile(getAuthStatePath(profileDir), 'utf8');
    return JSON.parse(raw) as AuthStateRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export async function writeAuthState(profileDir: string, state: AuthStateRecord): Promise<void> {
  await fs.mkdir(profileDir, { recursive: true });
  await fs.writeFile(getAuthStatePath(profileDir), JSON.stringify(state, null, 2));
}
