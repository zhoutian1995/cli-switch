import { execFileSync } from 'node:child_process';

export interface GitGuardConfig {
  /** Protected branches that agents cannot directly modify */
  protectedBranches: string[];
  /** Branch name prefix for agent work */
  branchPrefix: string;
  /** Auto-commit before agent execution */
  checkpointBeforeRun: boolean;
  /** Require clean working tree before agent run */
  requireCleanTree: boolean;
}

export interface GitCheckpoint {
  branch: string;
  commitHash: string;
  timestamp: string;
}

const DEFAULT_CONFIG: GitGuardConfig = {
  protectedBranches: ['main', 'master', 'release'],
  branchPrefix: 'agent/',
  checkpointBeforeRun: true,
  requireCleanTree: false,
};

export class GitGuard {
  private config: GitGuardConfig;

  constructor(config?: Partial<GitGuardConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private git(args: string[], cwd?: string): string {
    try {
      return execFileSync('git', args, {
        cwd,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
    } catch {
      return '';
    }
  }

  private isGitRepo(cwd?: string): boolean {
    return this.git(['rev-parse', '--is-inside-work-tree'], cwd) === 'true';
  }

  getCurrentBranch(cwd?: string): string {
    return this.git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  }

  isProtectedBranch(branch: string): boolean {
    return this.config.protectedBranches.includes(branch);
  }

  createAgentBranch(taskDescription: string, cwd?: string): string {
    if (!this.isGitRepo(cwd)) return '';

    const sanitized = taskDescription
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
    const ts = Date.now();
    const branchName = `${this.config.branchPrefix}${sanitized}-${ts}`;

    this.git(['checkout', '-b', branchName], cwd);

    return branchName;
  }

  checkpoint(message: string, cwd?: string): GitCheckpoint | null {
    if (!this.isGitRepo(cwd)) return null;

    const branch = this.getCurrentBranch(cwd);
    // Stage everything and commit (including untracked)
    this.git(['add', '-A'], cwd);
    this.git(['commit', '-m', `checkpoint: ${message}`, '--allow-empty'], cwd);
    const commitHash = this.git(['rev-parse', 'HEAD'], cwd);

    if (!commitHash) return null;

    return { branch, commitHash, timestamp: new Date().toISOString() };
  }

  getDiffSince(checkpoint: GitCheckpoint, cwd?: string): string {
    if (!this.isGitRepo(cwd)) return '';
    return this.git(['diff', `${checkpoint.commitHash}..HEAD`], cwd);
  }

  commitAgentChanges(checkpoint: GitCheckpoint, cwd?: string): string | null {
    if (!this.isGitRepo(cwd)) return null;

    const status = this.git(['status', '--porcelain'], cwd);
    if (!status) return null; // no changes

    this.git(['add', '-A'], cwd);
    const msg = `agent changes on ${checkpoint.branch}`;
    this.git(['commit', '-m', msg], cwd);
    return this.git(['rev-parse', 'HEAD'], cwd) || null;
  }

  validateChanges(cwd?: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!this.isGitRepo(cwd)) {
      return { valid: true, issues: [] }; // no git repo = skip validation
    }

    const diff = this.git(['diff', 'HEAD'], cwd) + this.git(['diff', '--cached'], cwd);

    // Also check for untracked files
    const untracked = this.git(['ls-files', '--others', '--exclude-standard'], cwd);
    const hasAnyChanges = diff.length > 0 || untracked.length > 0;

    if (!hasAnyChanges) return { valid: true, issues: [] };

    // Check diff size
    const lines = diff.split('\n');
    if (lines.length > 10000) {
      issues.push(`Diff too large: ${lines.length} lines (max 10000)`);
    }

    // Check for binary files
    const binaryMatch = this.git(['diff', '--name-only', '--diff-filter=ACMR'], cwd);
    if (binaryMatch) {
      const files = binaryMatch.split('\n').filter(Boolean);
      for (const f of files) {
        const isBinary = this.git(['diff', '--numstat', 'HEAD', '--', f], cwd);
        // Binary files show as "-\t-\tfilename"
        if (isBinary.startsWith('-\t-')) {
          issues.push(`Binary file detected: ${f}`);
        }
      }
    }

    // Check for protected files (tracked + untracked + staged)
    const protectedPatterns = ['.env', '.env.local', '.env.production', 'credentials', 'secrets'];
    const trackedChanges = this.git(['diff', '--name-only', 'HEAD'], cwd);
    const stagedChanges = this.git(['diff', '--cached', '--name-only'], cwd);
    const untrackedFiles = this.git(['ls-files', '--others', '--exclude-standard'], cwd);
    const changedFiles = [trackedChanges, stagedChanges, untrackedFiles].join('\n');
    for (const pattern of protectedPatterns) {
      if (changedFiles.split('\n').some((f) => f.includes(pattern))) {
        issues.push(`Protected file modified: contains "${pattern}"`);
      }
    }

    // Secret detection (basic)
    const secretPatterns = [
      /sk-[a-zA-Z0-9]{20,}/,
      /sk-or-[a-zA-Z0-9]+/,
      /sk-ant-[a-zA-Z0-9]+/,
      /password\s*[:=]\s*['"][^'"]{4,}/i,
      /-----BEGIN\s+(RSA |EC )?PRIVATE KEY-----/,
    ];
    for (const pat of secretPatterns) {
      if (pat.test(diff)) {
        issues.push(`Potential secret detected in diff (pattern: ${pat.source.slice(0, 30)})`);
        break;
      }
    }

    return { valid: issues.length === 0, issues };
  }

  restore(checkpoint: GitCheckpoint, cwd?: string): void {
    if (!this.isGitRepo(cwd)) return;
    this.git(['add', '-A'], cwd);
    this.git(['stash'], cwd); // stash any uncommitted changes first
    this.git(['checkout', checkpoint.branch], cwd);
    this.git(['reset', '--hard', checkpoint.commitHash], cwd);
  }

  listAgentBranches(cwd?: string): string[] {
    if (!this.isGitRepo(cwd)) return [];
    const branches = this.git(['branch', '--list', `${this.config.branchPrefix}*`], cwd);
    return branches
      .split('\n')
      .map((b) => b.replace(/^\*?\s+/, '').trim())
      .filter(Boolean);
  }

  cleanupOldBranches(olderThanDays: number, cwd?: string): string[] {
    if (!this.isGitRepo(cwd)) return [];

    const branches = this.listAgentBranches(cwd);
    const cutoff = Date.now() - olderThanDays * 86_400_000;
    const cleaned: string[] = [];

    for (const branch of branches) {
      const match = branch.match(/-(\d+)$/);
      if (match) {
        const ts = parseInt(match[1], 10);
        if (ts < cutoff) {
          this.git(['branch', '-D', branch], cwd);
          cleaned.push(branch);
        }
      }
    }

    return cleaned;
  }
}
