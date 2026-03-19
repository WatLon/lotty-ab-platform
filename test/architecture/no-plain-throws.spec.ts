import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

interface ThrowViolation {
  filePath: string;
  line: number;
  column: number;
  expression: string;
}
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
    if (entry.name.endsWith('.d.ts')) continue;
    result.push(fullPath);
  }
  return result;
}
function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (true) {
    if (ts.isParenthesizedExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isAsExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isTypeAssertionExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isNonNullExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isSatisfiesExpression(current)) {
      current = current.expression;
      continue;
    }
    return current;
  }
}
function isDisallowedThrowExpression(expression: ts.Expression): boolean {
  const unwrapped = unwrapExpression(expression);
  if (ts.isObjectLiteralExpression(unwrapped)) return true;
  if (ts.isArrayLiteralExpression(unwrapped)) return true;
  if (ts.isStringLiteralLike(unwrapped)) return true;
  if (ts.isNoSubstitutionTemplateLiteral(unwrapped)) return true;
  if (ts.isTemplateExpression(unwrapped)) return true;
  if (ts.isNumericLiteral(unwrapped)) return true;
  if (ts.isBigIntLiteral(unwrapped)) return true;
  if (unwrapped.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (unwrapped.kind === ts.SyntaxKind.FalseKeyword) return true;
  if (unwrapped.kind === ts.SyntaxKind.NullKeyword) return true;
  return false;
}
function findThrowViolations(filePath: string): ThrowViolation[] {
  const sourceText = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const violations: ThrowViolation[] = [];
  function visit(node: ts.Node): void {
    if (ts.isThrowStatement(node) && node.expression) {
      if (isDisallowedThrowExpression(node.expression)) {
        const position = sourceFile.getLineAndCharacterOfPosition(node.expression.pos);
        violations.push({
          filePath,
          line: position.line + 1,
          column: position.character + 1,
          expression: node.expression.getText(sourceFile),
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return violations;
}
describe('throw contracts', () => {
  it('disallows throw literals and throw objects in src', () => {
    const files = collectTsFiles('src');
    const violations = files.flatMap((filePath) => findThrowViolations(filePath));
    expect(violations).toEqual([]);
  });
});
