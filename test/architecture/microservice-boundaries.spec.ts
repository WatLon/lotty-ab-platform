import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function collectTsFiles(rootDir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const fullPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectTsFiles(fullPath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.ts')) continue;
    result.push(fullPath);
  }
  return result;
}
function collectTsFilesFromExistingDirs(dirs: string[]): string[] {
  return dirs.filter((dir) => existsSync(dir)).flatMap((dir) => collectTsFiles(dir));
}
function extractImports(filePath: string): string[] {
  const source = readFileSync(filePath, 'utf8');
  const result: string[] = [];
  const importFromRegex = /(?:import|export)\s+[^'"]*from\s+['"]([^'"]+)['"]/g;
  const importCallRegex = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of source.matchAll(importFromRegex)) {
    result.push(match[1]);
  }
  for (const match of source.matchAll(importCallRegex)) {
    result.push(match[1]);
  }
  return result;
}
function assertNoForbiddenImports(
  filePaths: string[],
  forbiddenPrefixes: string[],
): Array<{
  filePath: string;
  imported: string;
}> {
  const violations: Array<{
    filePath: string;
    imported: string;
  }> = [];
  for (const filePath of filePaths) {
    const imports = extractImports(filePath);
    for (const imported of imports) {
      if (forbiddenPrefixes.some((prefix) => imported.startsWith(prefix))) {
        violations.push({ filePath, imported });
      }
    }
  }
  return violations;
}
describe('microservice boundaries', () => {
  it('keeps decide runtime isolated from control-domain modules', () => {
    const decideDirs = [
      'src/apps/decide-api/application',
      'src/apps/decide-api/domain',
      'src/apps/decide-api/infrastructure',
      'src/apps/decide-api/presentation',
    ];
    const files = collectTsFilesFromExistingDirs(decideDirs);
    const violations = assertNoForbiddenImports(files, [
      '@/apps/control-api/domain/flag',
      '@/apps/control-api/domain/experiment',
      '@/apps/control-api/application/flag',
      '@/apps/control-api/application/experiment',
      '@/apps/control-api/infrastructure/flag',
      '@/apps/control-api/infrastructure/experiment',
      '@/apps/control-api/presentation/flag',
      '@/apps/control-api/presentation/experiment',
    ]);
    expect(violations).toEqual([]);
  });
  it('keeps contracts package framework/domain agnostic', () => {
    const contractFiles = collectTsFiles('src/contracts');
    const violations = assertNoForbiddenImports(contractFiles, [
      '@/shared/domain/',
      '@/shared/application/',
      '@/shared/infrastructure/',
      '@/shared/presentation/',
      '@/apps/',
      '@nestjs/',
      'nestjs',
      'prisma',
    ]);
    expect(violations).toEqual([]);
  });
  it('keeps ingest runtime isolated from decide/control domain modules', () => {
    const ingestDirs = [
      'src/apps/ingest-api/application',
      'src/apps/ingest-api/domain',
      'src/apps/ingest-api/infrastructure',
      'src/apps/ingest-api/presentation',
    ];
    const files = collectTsFilesFromExistingDirs(ingestDirs);
    const violations = assertNoForbiddenImports(files, [
      '@/apps/decide-api/application',
      '@/apps/decide-api/domain',
      '@/apps/control-api/domain/event-type',
      '@/apps/control-api/infrastructure/event-type',
      '@/apps/control-api/presentation/event-type',
    ]);
    expect(violations).toEqual([]);
  });
  it('keeps generic health controller service-agnostic', () => {
    const violations = assertNoForbiddenImports(
      ['src/shared/presentation/health/health.controller.ts'],
      [
        '@/apps/decide-api/application',
        '@/apps/ingest-api/application',
        '@/apps/control-api/application/experiment',
        '@/apps/control-api/application/flag',
      ],
    );
    expect(violations).toEqual([]);
  });
  it('keeps service composition modules separated by service responsibility', () => {
    const rules: Array<{
      file: string;
      forbidden: string[];
    }> = [
      {
        file: 'src/apps/decide-api/decide-api.module.ts',
        forbidden: [
          '@/apps/control-api/infrastructure/flag',
          '@/apps/control-api/infrastructure/experiment',
          '@/apps/control-api/infrastructure/event-type',
          '@/apps/control-api/infrastructure/user',
          '@/apps/control-api/infrastructure/approver-group',
          '@/apps/ingest-api/infrastructure',
        ],
      },
      {
        file: 'src/apps/ingest-api/ingest-api.module.ts',
        forbidden: [
          '@/apps/control-api/infrastructure/flag',
          '@/apps/control-api/infrastructure/experiment',
          '@/apps/control-api/infrastructure/event-type',
          '@/apps/control-api/infrastructure/user',
          '@/apps/control-api/infrastructure/approver-group',
          '@/apps/decide-api/infrastructure',
        ],
      },
      {
        file: 'src/apps/control-api/control-api.module.ts',
        forbidden: [
          '@/apps/decide-api/infrastructure',
          '@/apps/ingest-api/infrastructure',
          '@/apps/decide-api/infrastructure',
        ],
      },
      {
        file: 'src/apps/control-workers/control-workers.module.ts',
        forbidden: [
          '@/apps/ingest-api/infrastructure',
          '@/apps/decide-api/infrastructure',
          '@/apps/ingest-workers',
        ],
      },
      {
        file: 'src/apps/ingest-workers/ingest-workers.module.ts',
        forbidden: [
          '@/apps/control-api/infrastructure/experiment',
          '@/apps/decide-api/infrastructure',
          '@/apps/control-workers',
        ],
      },
    ];
    for (const rule of rules) {
      const violations = assertNoForbiddenImports([rule.file], rule.forbidden);
      expect(violations).toEqual([]);
    }
  });
  it('keeps decide/ingest/ingest-workers bootstrap free from direct prisma dependency', () => {
    const decideModule = readFileSync('src/apps/decide-api/decide-api.module.ts', 'utf8');
    const ingestModule = readFileSync('src/apps/ingest-api/ingest-api.module.ts', 'utf8');
    const ingestWorkersModule = readFileSync(
      'src/apps/ingest-workers/ingest-workers.module.ts',
      'utf8',
    );
    const decideKeepsPrismaDisabled = decideModule.includes("buildHttpAppImports('decide-api')");
    const ingestKeepsPrismaDisabled = ingestModule.includes("buildHttpAppImports('ingest-api')");
    const ingestWorkersKeepsPrismaDisabled = ingestWorkersModule.includes(
      "buildHttpAppImports('ingest-workers')",
    );
    expect(decideKeepsPrismaDisabled).toBe(true);
    expect(ingestKeepsPrismaDisabled).toBe(true);
    expect(ingestWorkersKeepsPrismaDisabled).toBe(true);
  });
  it('keeps service folders isolated from each other (except common)', () => {
    const services = [
      'control-api',
      'decide-api',
      'ingest-api',
      'control-workers',
      'ingest-workers',
    ] as const;
    const allowedServiceFamilies: Record<(typeof services)[number], string[]> = {
      'control-api': ['control-workers'],
      'control-workers': ['control-api'],
      'ingest-api': ['ingest-workers'],
      'ingest-workers': ['ingest-api'],
      'decide-api': [],
    };
    for (const service of services) {
      const files = collectTsFiles(`src/apps/${service}`);
      const forbidden = services
        .filter((candidate) => candidate !== service)
        .filter((candidate) => !allowedServiceFamilies[service].includes(candidate))
        .map((otherService) => `@/apps/${otherService}`);
      const violations = assertNoForbiddenImports(files, forbidden);
      expect(violations).toEqual([]);
    }
  });
});
