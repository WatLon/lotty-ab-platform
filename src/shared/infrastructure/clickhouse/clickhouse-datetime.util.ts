export function toClickHouseDateTime64Utc(value: Date): string {
  return value.toISOString().replace('T', ' ').replace('Z', '');
}
