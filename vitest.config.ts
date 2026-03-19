import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import ts from 'typescript';

const tsDecoratorMetadataPlugin = {
  name: 'ts-decorator-metadata',
  enforce: 'pre' as const,
  transform(source: string, id: string) {
    if (!id.endsWith('.ts') && !id.endsWith('.tsx')) {
      return null;
    }
    if (id.includes('/node_modules/')) {
      return null;
    }

    const transformed = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2023,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        sourceMap: true,
      },
      fileName: id,
      reportDiagnostics: false,
    });

    return {
      code: transformed.outputText,
      map: transformed.sourceMapText ? JSON.parse(transformed.sourceMapText) : null,
    };
  },
};

export default defineConfig({
  plugins: [
    tsDecoratorMetadataPlugin,
    tsconfigPaths({ ignoreConfigErrors: true }),  
  ],
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.spec.ts'],
    setupFiles: ['test/setup.ts'],
    reporters: process.env.CI          
      ? ['default', 'junit']
      : ['default'],
    outputFile: {                     
      junit: 'reports/unit.xml',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage/vitest',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
    },
  },
});
