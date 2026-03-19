import { AggregateRoot, ConcurrencyError, err, Identity, ok, Result } from '@/shared/domain/common';
import { PersistenceMapper } from './persistence-mapper.interface';
import { PrismaTransactionClient, PrismaTransactionManager } from './prisma-transaction-manager';
export abstract class PrismaRepositoryBase<
  TDomain extends AggregateRoot<unknown, TId>,
  TRaw extends {
    version: number;
  },
  TId extends Identity,
  TSaveError extends Error = never,
> {
  private readonly versions = new WeakMap<object, number>();

  constructor(
    protected readonly txManager: PrismaTransactionManager,
    protected readonly mapper: PersistenceMapper<TDomain, TRaw>,
  ) {}

  protected get client(): PrismaTransactionClient {
    return this.txManager.getClient();
  }

  protected abstract get entityName(): string;

  protected async findOne(query: Promise<TRaw | null>): Promise<TDomain | null> {
    const raw = await query;
    if (!raw) return null;

    const entity = this.mapper.toDomain(raw);
    this.versions.set(entity, raw.version);
    return entity;
  }

  protected async findMany(query: Promise<TRaw[]>): Promise<TDomain[]> {
    const items = await query;
    return items.map((raw) => {
      const entity = this.mapper.toDomain(raw);
      this.versions.set(entity, raw.version);
      return entity;
    });
  }

  protected async persist(entity: TDomain): Promise<Result<void, ConcurrencyError | TSaveError>> {
    const currentVersion = this.versions.get(entity);
    if (currentVersion === undefined) {
      const createResult = await this.doCreate(entity, 0);
      if (createResult.isErr()) return err(createResult.error);

      this.versions.set(entity, 0);
      return ok(undefined);
    }
    const newVersion = currentVersion + 1;
    const updateResult = await this.doUpdate(entity, currentVersion, newVersion);
    if (updateResult.isErr()) return err(updateResult.error);

    const updated = updateResult.value;
    if (!updated) {
      return err(new ConcurrencyError(this.entityName, entity.id));
    }
    this.versions.set(entity, newVersion);
    return ok(undefined);
  }

  async save(entity: TDomain): Promise<Result<void, ConcurrencyError | TSaveError>> {
    const result = await this.persist(entity);
    if (result.isErr()) return result;

    await this.txManager.stageDomainEvents(entity.domainEvents);
    entity.clearEvents();
    return result;
  }

  protected abstract doCreate(entity: TDomain, version: number): Promise<Result<void, TSaveError>>;

  protected abstract doUpdate(
    entity: TDomain,
    currentVersion: number,
    newVersion: number,
  ): Promise<Result<boolean, TSaveError>>;
}
