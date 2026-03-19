import { BucketCalculator } from '@/apps/decide-api/domain/bucket-calculator';

describe('BucketCalculator', () => {
  describe('calculate', () => {
    it('returns deterministic bucket for same inputs', () => {
      const a = BucketCalculator.calculate('user-1', 'exp-1');
      const b = BucketCalculator.calculate('user-1', 'exp-1');
      expect(a).toBe(b);
    });
    it('returns different buckets for different subjects', () => {
      const a = BucketCalculator.calculate('user-1', 'exp-1');
      const b = BucketCalculator.calculate('user-2', 'exp-1');
      expect(a).not.toBe(b);
    });
    it('returns different buckets for different experiments (independence)', () => {
      const a = BucketCalculator.calculate('user-1', 'exp-1');
      const b = BucketCalculator.calculate('user-1', 'exp-2');
      expect(a).not.toBe(b);
    });
    it('returns bucket in range 0-99', () => {
      for (let i = 0; i < 200; i++) {
        const bucket = BucketCalculator.calculate(`user-${i}`, `exp-${i % 5}`);
        expect(bucket).toBeGreaterThanOrEqual(0);
        expect(bucket).toBeLessThan(100);
      }
    });
    it('distributes roughly uniformly', () => {
      const counts = new Array(100).fill(0);
      const total = 10000;
      for (let i = 0; i < total; i++) {
        const bucket = BucketCalculator.calculate(`user-${i}`, 'exp-uniform');
        counts[bucket]++;
      }
      for (const count of counts) {
        expect(count).toBeGreaterThan(50);
        expect(count).toBeLessThan(150);
      }
    });
  });
  describe('isInAudience', () => {
    it('true when bucket < audiencePercent', () => {
      expect(BucketCalculator.isInAudience(0, 1)).toBe(true);
      expect(BucketCalculator.isInAudience(19, 20)).toBe(true);
      expect(BucketCalculator.isInAudience(99, 100)).toBe(true);
    });
    it('false when bucket >= audiencePercent', () => {
      expect(BucketCalculator.isInAudience(20, 20)).toBe(false);
      expect(BucketCalculator.isInAudience(50, 20)).toBe(false);
    });
  });
  describe('selectVariant', () => {
    it('selects variant by cumulative weight (50/50)', () => {
      const variants = [
        { id: 'control', weight: 50 },
        { id: 'treatment', weight: 50 },
      ];
      expect(BucketCalculator.selectVariant(0, variants)?.id).toBe('control');
      expect(BucketCalculator.selectVariant(49, variants)?.id).toBe('control');
      expect(BucketCalculator.selectVariant(50, variants)?.id).toBe('treatment');
      expect(BucketCalculator.selectVariant(99, variants)?.id).toBe('treatment');
    });
    it('selects variant with unequal weights (10/90)', () => {
      const variants = [
        { id: 'control', weight: 10 },
        { id: 'treatment', weight: 90 },
      ];
      expect(BucketCalculator.selectVariant(0, variants)?.id).toBe('control');
      expect(BucketCalculator.selectVariant(9, variants)?.id).toBe('control');
      expect(BucketCalculator.selectVariant(10, variants)?.id).toBe('treatment');
      expect(BucketCalculator.selectVariant(99, variants)?.id).toBe('treatment');
    });
    it('handles three variants (20/30/50)', () => {
      const variants = [
        { id: 'a', weight: 20 },
        { id: 'b', weight: 30 },
        { id: 'c', weight: 50 },
      ];
      expect(BucketCalculator.selectVariant(10, variants)?.id).toBe('a');
      expect(BucketCalculator.selectVariant(20, variants)?.id).toBe('b');
      expect(BucketCalculator.selectVariant(49, variants)?.id).toBe('b');
      expect(BucketCalculator.selectVariant(50, variants)?.id).toBe('c');
      expect(BucketCalculator.selectVariant(99, variants)?.id).toBe('c');
    });
    it('returns null if bucket beyond total weight', () => {
      const variants = [
        { id: 'a', weight: 30 },
        { id: 'b', weight: 30 },
      ];
      expect(BucketCalculator.selectVariant(60, variants)).toBeNull();
    });
  });
});
