import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type { TaskIntent } from '../../types/agent.js';
import { TechDetector, type TechStack } from './tech-detector.js';

export interface ProjectContextInfo {
  techStack: TechStack;
  projectRoot: string;
  projectName: string;
  gitBranch: string;
  recentFiles: string[];
  entryPoints: string[];
}

const COMMON_ENTRY_POINTS = [
  'src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js',
  'src/app.ts', 'src/app.tsx', 'src/app.js', 'src/app.jsx',
  'index.ts', 'index.js', 'main.ts', 'main.py', 'app.py',
  'src/index.py', 'src/main.py', 'cmd/root.ts',
];

function tryExec(cmd: string, args: string[], cwd: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd, encoding: 'utf-8', timeout: 5000 }, (err, stdout) => {
      if (err) resolve(null);
      else resolve(stdout.trim() || null);
    });
  });
}

export class ProjectContextBuilder {
  constructor(private projectRoot: string) {}

  async build(): Promise<ProjectContextInfo> {
    const techStack = TechDetector.detectFrom(this.projectRoot);

    let projectName = this.projectRoot.split('/').pop() ?? 'unknown';
    const pkgJson = await tryExec('cat', ['package.json'], this.projectRoot);
    if (pkgJson) {
      try {
        const pkg = JSON.parse(pkgJson);
        if (pkg.name) projectName = pkg.name;
      } catch { /* ignore */ }
    }

    const gitBranch = (await tryExec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], this.projectRoot)) ?? '';

    let recentFiles: string[] = [];
    const status = await tryExec('git', ['diff', '--name-only', 'HEAD'], this.projectRoot);
    if (status) {
      recentFiles = status.split('\n').filter(Boolean).slice(0, 20);
    }

    const entryPoints = COMMON_ENTRY_POINTS.filter((f) =>
      existsSync(resolve(this.projectRoot, f)),
    );

    return {
      techStack,
      projectRoot: this.projectRoot,
      projectName,
      gitBranch,
      recentFiles,
      entryPoints,
    };
  }

  async buildSystemPrompt(intent: TaskIntent, techStack: TechStack): Promise<string> {
    const parts: string[] = [];

    const stackDesc: string[] = [];
    if (techStack.languages.length > 0) stackDesc.push(`Languages: ${techStack.languages.join(', ')}`);
    if (techStack.frameworks.length > 0) stackDesc.push(`Frameworks: ${techStack.frameworks.join(', ')}`);
    if (techStack.buildTools.length > 0) stackDesc.push(`Build: ${techStack.buildTools.join(', ')}`);
    if (techStack.testFramework) stackDesc.push(`Testing: ${techStack.testFramework}`);
    if (techStack.packageManager) stackDesc.push(`Package manager: ${techStack.packageManager}`);

    parts.push(`You are working on a project using ${stackDesc.join('. ') || 'unknown stack'}.`);
    parts.push(`The task type is "${intent.type}" with "${intent.complexity}" complexity.`);

    const gitBranch = await tryExec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], this.projectRoot);
    if (gitBranch) parts.push(`Current branch: ${gitBranch}.`);

    const entryPoints = COMMON_ENTRY_POINTS.filter((f) =>
      existsSync(resolve(this.projectRoot, f)),
    );
    if (entryPoints.length > 0) {
      parts.push(`Entry points: ${entryPoints.join(', ')}.`);
    }

    parts.push('Approach this as a senior developer would.');
    return parts.join(' ');
  }
}
