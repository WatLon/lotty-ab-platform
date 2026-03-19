export interface PersistenceMapper<TDomain, TRaw> {
  toDomain(raw: TRaw): TDomain;
}
