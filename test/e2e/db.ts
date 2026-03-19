import { spawnSync } from 'node:child_process';
import argon2 from 'argon2';
import { PrismaService } from '@/shared/infrastructure/persistence';

interface TableRow {
  tablename: string;
}
interface CurrentSchemaRow {
  current_schema: string;
}
let migrationsApplied = false;
function normalizeDatabaseUrlForE2E(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);
    parsed.searchParams.delete('schema');
    return parsed.toString();
  } catch {
    return databaseUrl;
  }
}
export function applyMigrations(): void {
  if (migrationsApplied) {
    return;
  }
  const env = { ...process.env };
  if (typeof env.DATABASE_URL === 'string' && env.DATABASE_URL.length > 0) {
    env.DATABASE_URL = normalizeDatabaseUrlForE2E(env.DATABASE_URL);
  }
  const migrated = runPrismaCommand(['migrate', 'deploy'], env, { allowP3005: true });
  runPrismaCommand(['db', 'push', '--accept-data-loss'], env);
  if (!migrated) {
  }
  migrationsApplied = true;
}
function runPrismaCommand(
  args: string[],
  env: NodeJS.ProcessEnv,
  options?: {
    allowP3005?: boolean;
  },
): boolean {
  const result = spawnSync('bunx', ['prisma', ...args], {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
  });
  if (result.status === 0) {
    return true;
  }
  const stderr = result.stderr ?? '';
  const stdout = result.stdout ?? '';
  const output = `${stderr}\n${stdout}`;
  if (options?.allowP3005 && output.includes('Error: P3005')) {
    return false;
  }
  throw new Error(`Failed to run prisma ${args.join(' ')} for e2e: ${stderr || stdout}`.trim());
}
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "guardrail_rules" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP',
  );
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "guardrail_rules" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0',
  );
  const schemaRows = (await prisma.$queryRawUnsafe<CurrentSchemaRow[]>(
    'SELECT current_schema()',
  )) as CurrentSchemaRow[];
  const currentSchema = schemaRows[0]?.current_schema ?? 'public';
  const tables = (await prisma.$queryRawUnsafe<TableRow[]>(`SELECT tablename
     FROM pg_tables
     WHERE schemaname = '${currentSchema}'
       AND tablename <> '_prisma_migrations'`)) as TableRow[];
  if (tables.length === 0) {
    return;
  }
  const tableNames = tables.map((table) => `"${currentSchema}"."${table.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`);
  await seedBootstrapAdmin(prisma);
}
async function seedBootstrapAdmin(prisma: PrismaService): Promise<void> {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  if (!email || !password || !name) {
    throw new Error('BOOTSTRAP_ADMIN_* env vars are required for e2e reset seed');
  }
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await prisma.user.upsert({
    where: { email },
    update: {
      password: passwordHash,
      name,
      role: 'ADMIN',
    },
    create: {
      email,
      password: passwordHash,
      name,
      role: 'ADMIN',
    },
  });
}
