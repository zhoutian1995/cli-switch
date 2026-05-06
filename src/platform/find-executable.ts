import { accessSync, constants } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';

function isExecutableSync(filePath: string): boolean {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Synchronously search PATH for an executable by name.
 */
export function findExecutableSync(names: string[]): string | null {
  const pathValue = process.env.PATH;
  if (!pathValue) {
    return null;
  }

  for (const name of names) {
    if (!name) continue;

    if (path.isAbsolute(name) || name.includes(path.sep)) {
      if (isExecutableSync(name)) return name;
      continue;
    }

    for (const directory of pathValue.split(path.delimiter)) {
      if (!directory) continue;
      const candidate = path.join(directory, name);
      if (isExecutableSync(candidate)) return candidate;
    }
  }

  return null;
}

/**
 * Asynchronously search PATH for an executable by name.
 */
export async function findExecutable(names: string[]): Promise<string | null> {
  const pathValue = process.env.PATH;
  if (!pathValue) {
    return null;
  }

  for (const name of names) {
    if (!name) continue;

    if (path.isAbsolute(name) || name.includes(path.sep)) {
      if (await isExecutable(name)) return name;
      continue;
    }

    for (const directory of pathValue.split(path.delimiter)) {
      if (!directory) continue;
      const candidate = path.join(directory, name);
      if (await isExecutable(candidate)) return candidate;
    }
  }

  return null;
}
