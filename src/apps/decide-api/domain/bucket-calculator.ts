import murmur from 'murmurhash3js-revisited';

const encoder = new TextEncoder();
const BUCKET_RANGE = 100;

export class BucketCalculator {
  static calculate(subjectId: string, experimentId: string): number {
    const bytes = encoder.encode(`${subjectId}:${experimentId}`);
    return murmur.x86.hash32(bytes) % BUCKET_RANGE;
  }

  static isInAudience(bucket: number, audiencePercent: number): boolean {
    return bucket < audiencePercent;
  }

  static selectVariant<
    T extends {
      weight: number;
    },
  >(bucket: number, variants: readonly T[]): T | null {
    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.weight;
      if (bucket < cumulative) {
        return variant;
      }
    }
    return null;
  }
}
