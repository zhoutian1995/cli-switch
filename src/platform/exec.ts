import { access } from 'node:fs/promises';
import path from 'node:path';
import { constants } from 'node:fs';

async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function findExecutable(names: string[]): Promise<string | null> {
  const pathValue = process.env.PATH;

  if (!pathValue) {
    return null;
  }

  const searchDirs = pathValue.split(path.delimiter).filter(Boolean);

  for (const name of names) {
    if (!name) {
      continue;
    }

    if (path.isAbsolute(name) || name.includes(path.sep)) {
      if (await isExecutable(name)) {
        return name;
      }

      continue;
    }

    for (const dir of searchDirs) {
      const candidate = path.join(dir, name);
      if (await isExecutable(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}
