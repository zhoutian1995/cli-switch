import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');
const DIST = resolve(PROJECT_ROOT, 'dist/cmd/root.js');

describe('Task 1: 项目骨架', () => {
  // --- 编译产物 ---
  describe('dist 产物存在', () => {
    it('dist/cmd/root.js 存在且可执行', () => {
      expect(existsSync(DIST)).toBe(true);
      const stat = statSync(DIST);
      expect(stat.size).toBeGreaterThan(0);
    });
  });

  // --- package.json ---
  describe('package.json', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(PROJECT_ROOT, 'package.json'), 'utf8'),
    );

    it('name 为 cli-switch', () => {
      expect(pkg.name).toBe('cli-switch');
    });

    it('version 非空且为 semver 格式', () => {
      expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('main 指向 dist/index.js（库入口）', () => {
      expect(pkg.main).toBe('dist/index.js');
    });

    it('bin 包含 cli-switch', () => {
      expect(pkg.bin).toBeDefined();
      expect(pkg.bin['cli-switch']).toBeDefined();
    });

    it('依赖包含 commander', () => {
      expect(pkg.dependencies).toBeDefined();
      expect(pkg.dependencies.commander).toBeDefined();
    });

    it('devDependencies 包含 typescript', () => {
      expect(pkg.devDependencies).toBeDefined();
      expect(pkg.devDependencies.typescript).toBeDefined();
    });

    it('devDependencies 包含 vitest', () => {
      expect(pkg.devDependencies.vitest).toBeDefined();
    });

    it('scripts 包含 build / test / dev', () => {
      expect(pkg.scripts).toBeDefined();
      expect(pkg.scripts.build).toBeDefined();
      expect(pkg.scripts.test).toBeDefined();
      expect(pkg.scripts.dev).toBeDefined();
    });
  });

  // --- tsconfig.json ---
  describe('tsconfig.json', () => {
    const tsconfig = JSON.parse(
      readFileSync(resolve(PROJECT_ROOT, 'tsconfig.json'), 'utf8'),
    );

    it('strict 为 true', () => {
      expect(tsconfig.compilerOptions.strict).toBe(true);
    });

    it('outDir 为 dist', () => {
      expect(tsconfig.compilerOptions.outDir).toBe('dist');
    });

    it('rootDir 为当前目录', () => {
      expect(tsconfig.compilerOptions.rootDir).toBe('.');
    });

    it('target 至少为 ES2022', () => {
      expect(tsconfig.compilerOptions.target).toMatch(/^ES20(22|23)$/);
    });

    it('module 为 NodeNext 或 ESNext', () => {
      expect(tsconfig.compilerOptions.module).toMatch(/^(NodeNext|ESNext)$/);
    });

    it('declaration 为 true', () => {
      expect(tsconfig.compilerOptions.declaration).toBe(true);
    });

    it('include 包含 cmd/ 和 src/', () => {
      expect(tsconfig.include).toContain('cmd/**/*');
      expect(tsconfig.include).toContain('src/**/*');
    });

    it('exclude 包含 node_modules 和 dist', () => {
      expect(tsconfig.exclude).toContain('node_modules');
      expect(tsconfig.exclude).toContain('dist');
    });
  });

  // --- .gitignore ---
  describe('.gitignore', () => {
    it('存在', () => {
      expect(existsSync(resolve(PROJECT_ROOT, '.gitignore'))).toBe(true);
    });

    it('包含 node_modules/', () => {
      const gitignore = readFileSync(
        resolve(PROJECT_ROOT, '.gitignore'),
        'utf8',
      );
      expect(gitignore).toContain('node_modules/');
    });

    it('包含 dist/', () => {
      const gitignore = readFileSync(
        resolve(PROJECT_ROOT, '.gitignore'),
        'utf8',
      );
      expect(gitignore).toContain('dist/');
    });
  });

  // --- CLI 运行 ---
  describe('CLI 可运行性', () => {
    it('--version 输出版本号', () => {
      const output = execSync(`node ${DIST} --version`, {
        encoding: 'utf8',
        cwd: PROJECT_ROOT,
      }).trim();
      expect(output).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('--help 输出帮助信息', () => {
      const output = execSync(`node ${DIST} --help`, {
        encoding: 'utf8',
        cwd: PROJECT_ROOT,
      });
      expect(output).toContain('cli-switch');
      expect(output).toContain('resolve');
      expect(output).toContain('env');
      expect(output).toContain('auth');
      expect(output).toContain('doctor');
      expect(output).toContain('list');
    });

    it('未知命令返回非零退出码', () => {
      expect(() => {
        execSync(`node ${DIST} fake-command`, {
          encoding: 'utf8',
          cwd: PROJECT_ROOT,
        });
      }).toThrow();
    });
  });

  // --- 目录结构 ---
  describe('目录结构', () => {
    const requiredDirs = [
      'cmd',
      'src/types',
      'src/core/resolver',
      'src/core/auth',
      'src/core/doctor',
      'src/core/diagnostics',
      'src/adapters',
      'src/registry/builtins',
      'src/platform',
      'src/renderers',
      'schema',
      'test/unit',
      'test/integration',
      'test/e2e',
      'test/contract',
      'test/fixtures',
    ];

    for (const dir of requiredDirs) {
      it(`${dir}/ 存在`, () => {
        const full = resolve(PROJECT_ROOT, dir);
        expect(existsSync(full)).toBe(true);
        expect(statSync(full).isDirectory()).toBe(true);
      });
    }
  });

  // --- 不应存在的旧文件 ---
  describe('旧 Python 文件已清理', () => {
    const removedFiles = [
      'pyproject.toml',
      'requirements.txt',
      'SKILL.md',
      'install-pre-commit.sh',
      'install.sh',
      'wechat-qrcode.jpg',
    ];

    for (const file of removedFiles) {
      it(`${file} 不存在`, () => {
        expect(existsSync(resolve(PROJECT_ROOT, file))).toBe(false);
      });
    }

    it('src/cli_switch/ 不存在', () => {
      expect(existsSync(resolve(PROJECT_ROOT, 'src/cli_switch'))).toBe(false);
    });

    it('src/cli_switch.egg-info/ 不存在', () => {
      expect(
        existsSync(resolve(PROJECT_ROOT, 'src/cli_switch.egg-info')),
      ).toBe(false);
    });
  });

  // --- README ---
  describe('README', () => {
    it('README.md 存在', () => {
      expect(existsSync(resolve(PROJECT_ROOT, 'README.md'))).toBe(true);
    });

    it('README 包含 cli-switch 项目说明', () => {
      const readme = readFileSync(
        resolve(PROJECT_ROOT, 'README.md'),
        'utf8',
      );
      expect(readme).toContain('cli-switch');
      expect(readme).toContain('AI Agent');
    });
  });
});
