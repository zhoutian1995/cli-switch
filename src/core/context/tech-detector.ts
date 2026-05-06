import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface TechStack {
  languages: string[];
  frameworks: string[];
  buildTools: string[];
  packageManager: string;
  testFramework: string;
  nodeVersion?: string;
  hasDocker: boolean;
  hasCI: boolean;
}

const KNOWN_FRAMEWORKS: Record<string, string[]> = {
  react: ['react'],
  'react-dom': ['react'],
  vue: ['vue'],
  svelte: ['svelte'],
  angular: ['@angular/core'],
  next: ['next'],
  nuxt: ['nuxt'],
  express: ['express'],
  fastify: ['fastify'],
  koa: ['koa'],
  nest: ['@nestjs/core'],
  hono: ['hono'],
};

const KNOWN_BUILD_TOOLS: Record<string, string> = {
  vite: 'vite.config',
  webpack: 'webpack.config',
  rollup: 'rollup.config',
  esbuild: 'esbuild',
  turbopack: 'turbopack',
};

const KNOWN_TEST_FRAMEWORKS: Record<string, string[]> = {
  vitest: ['vitest'],
  jest: ['jest'],
  mocha: ['mocha'],
  pytest: ['pytest'],
};

function tryReadFile(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export class TechDetector {
  constructor(private projectRoot: string) {}

  detect(): TechStack {
    const languages: string[] = [];
    const frameworks: string[] = [];
    const buildTools: string[] = [];
    let packageManager = '';
    let testFramework = '';
    let nodeVersion: string | undefined;
    let hasDocker = false;
    let hasCI = false;

    // package.json
    const pkgContent = tryReadFile(resolve(this.projectRoot, 'package.json'));
    if (pkgContent) {
      languages.push('javascript');
      let pkg: Record<string, unknown>;
      try {
        pkg = JSON.parse(pkgContent);
      } catch {
        pkg = {};
      }

      const allDeps = new Set<string>([
        ...Object.keys((pkg.dependencies as Record<string, string>) ?? {}),
        ...Object.keys((pkg.devDependencies as Record<string, string>) ?? {}),
      ]);

      if (allDeps.has('typescript')) languages.push('typescript');

      for (const [name, depPatterns] of Object.entries(KNOWN_FRAMEWORKS)) {
        if (depPatterns.some((d) => allDeps.has(d))) {
          frameworks.push(name);
        }
      }

      for (const [name, patterns] of Object.entries(KNOWN_TEST_FRAMEWORKS)) {
        if (patterns.some((d) => allDeps.has(d))) {
          testFramework = name;
        }
      }

      if (allDeps.has('esbuild')) buildTools.push('esbuild');

      // Package manager
      if (existsSync(resolve(this.projectRoot, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
      else if (existsSync(resolve(this.projectRoot, 'yarn.lock'))) packageManager = 'yarn';
      else packageManager = 'npm';
    }

    // tsconfig.json → typescript already detected above, but check if not via package.json
    if (existsSync(resolve(this.projectRoot, 'tsconfig.json')) && !languages.includes('typescript')) {
      languages.push('typescript');
    }

    // Python
    if (existsSync(resolve(this.projectRoot, 'pyproject.toml')) || existsSync(resolve(this.projectRoot, 'requirements.txt'))) {
      languages.push('python');
      const reqContent = tryReadFile(resolve(this.projectRoot, 'requirements.txt'));
      if (reqContent) {
        const lines = reqContent.split('\n').map((l) => l.toLowerCase());
        if (lines.some((l) => l.startsWith('pytest'))) testFramework = testFramework || 'pytest';
        if (lines.some((l) => l.startsWith('fastapi') || l.startsWith('flask') || l.startsWith('django'))) {
          for (const l of lines) {
            if (l.startsWith('fastapi')) frameworks.push('fastapi');
            else if (l.startsWith('flask')) frameworks.push('flask');
            else if (l.startsWith('django')) frameworks.push('django');
          }
        }
      }
    }

    // Rust
    if (existsSync(resolve(this.projectRoot, 'Cargo.toml'))) {
      languages.push('rust');
    }

    // Go
    if (existsSync(resolve(this.projectRoot, 'go.mod'))) {
      languages.push('go');
    }

    // Node version
    const nodeVersionFile =
      tryReadFile(resolve(this.projectRoot, '.node-version')) ??
      tryReadFile(resolve(this.projectRoot, '.nvmrc'));
    if (nodeVersionFile) {
      nodeVersion = nodeVersionFile.trim();
    }

    // Docker
    hasDocker =
      existsSync(resolve(this.projectRoot, 'Dockerfile')) ||
      existsSync(resolve(this.projectRoot, 'docker-compose.yml')) ||
      existsSync(resolve(this.projectRoot, 'docker-compose.yaml'));

    // CI
    hasCI =
      existsSync(resolve(this.projectRoot, '.github', 'workflows')) ||
      existsSync(resolve(this.projectRoot, '.gitlab-ci.yml')) ||
      existsSync(resolve(this.projectRoot, 'Jenkinsfile'));

    // Build tools from config files
    for (const [name, prefix] of Object.entries(KNOWN_BUILD_TOOLS)) {
      if (name === 'esbuild') continue; // handled above
      const extensions = ['.ts', '.js', '.mjs', '.mts'];
      if (extensions.some((ext) => existsSync(resolve(this.projectRoot, `${prefix}${ext}`)))) {
        buildTools.push(name);
      }
    }

    // Test config files
    if (!testFramework) {
      const testConfigExtensions = ['.ts', '.js', '.mjs', '.mts', '.json'];
      for (const ext of testConfigExtensions) {
        if (existsSync(resolve(this.projectRoot, `vitest.config${ext}`))) { testFramework = 'vitest'; break; }
        if (existsSync(resolve(this.projectRoot, `jest.config${ext}`))) { testFramework = 'jest'; break; }
      }
    }

    return {
      languages: [...new Set(languages)],
      frameworks: [...new Set(frameworks)],
      buildTools: [...new Set(buildTools)],
      packageManager,
      testFramework,
      nodeVersion,
      hasDocker,
      hasCI,
    };
  }

  static detectFrom(projectRoot: string): TechStack {
    return new TechDetector(projectRoot).detect();
  }
}
