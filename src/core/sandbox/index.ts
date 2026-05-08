import { access, mkdtemp, mkdir, rm, symlink } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const PARENT_SESSION_ENV_VARS = [
  'CLAUDECODE',
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_CODE_SSE_PORT',
  'CLAUDE_CODE_SESSION_ID',
  'CODEX_SESSION_ID',
  'CODEX_SANDBOX',
];

type HomeTemplateEntry = {
  source: string;
  target: string;
  type: 'symlink';
};

const DEFAULT_HOME_TEMPLATE: HomeTemplateEntry[] = [
  { source: '.gitconfig', target: '.gitconfig', type: 'symlink' },
  { source: '.ssh/known_hosts', target: '.ssh/known_hosts', type: 'symlink' },
];

export interface SandboxOptions {
  /** Enable temporary HOME isolation for the spawned process. */
  homeIsolation?: boolean;
  /** Preserve sandbox files for debugging. */
  keepTemp?: boolean;
  /** Override the task id used in temp directory naming. */
  taskId?: string;
}

export interface SandboxContext {
  env: NodeJS.ProcessEnv;
  root?: string;
  home?: string;
  cleanup: () => Promise<void>;
}

export function createSandboxEnv(
  baseEnv: NodeJS.ProcessEnv = process.env,
  envOverlay: Record<string, string | undefined> = {},
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...baseEnv };

  for (const key of PARENT_SESSION_ENV_VARS) {
    delete env[key];
  }

  for (const [key, value] of Object.entries(envOverlay)) {
    if (value === undefined) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }

  return env;
}

export async function createSandbox(
  envOverlay: Record<string, string | undefined> = {},
  options: SandboxOptions = {},
): Promise<SandboxContext> {
  const env = createSandboxEnv(process.env, envOverlay);

  if (!options.homeIsolation) {
    return { env, cleanup: async () => {} };
  }

  const taskId = sanitizeTaskId(options.taskId ?? 'task');
  const root = await mkdtemp(join(tmpdir(), `cli-switch-${taskId}-`));
  const home = join(root, 'home');
  await mkdir(home, { recursive: true });
  await applyHomeTemplate(home);
  env.HOME = home;

  return {
    env,
    root,
    home,
    cleanup: async () => {
      if (!options.keepTemp) {
        await rm(root, { recursive: true, force: true });
      }
    },
  };
}

async function applyHomeTemplate(home: string): Promise<void> {
  const realHome = homedir();

  for (const entry of DEFAULT_HOME_TEMPLATE) {
    const source = join(realHome, entry.source);
    const target = join(home, entry.target);

    try {
      await access(source);
      await mkdir(dirname(target), { recursive: true });
      await symlink(source, target);
    } catch {
      // Missing optional host files should not block agent startup.
    }
  }
}

function sanitizeTaskId(taskId: string): string {
  return taskId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || 'task';
}

// ─── Barrel exports for execution isolation (Phase 04) ───────

export {
  type ExecutionMode,
  type ExecutionModeConfig,
  parseExecutionMode,
  getPatchOnlyPromptSuffix,
  getExecutionModeConfig,
} from './execution-mode.js';

export {
  type PatchResult,
  type ApplyResult,
  collectPatches,
  extractDiffBlocks,
  applyPatch,
} from './patch-collector.js';
