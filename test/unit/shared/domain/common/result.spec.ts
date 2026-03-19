import { describe, expect, it } from 'vitest';
import { err, ok, Result } from '@/shared/domain/common';

describe('Result helpers', () => {
  it('supports Ok helpers', () => {
    const value = ok(2);
    expect(value.isOk()).toBe(true);
    expect(value.isErr()).toBe(false);
    expect(value.map((v) => v * 2).match({ ok: (v) => v, err: () => 0 })).toBe(4);
    expect(value.mapErr((e: string) => e.toUpperCase()).match({ ok: (v) => v, err: () => 0 })).toBe(
      2,
    );
    expect(value.flatMap((v) => ok(v + 1)).match({ ok: (v) => v, err: () => 0 })).toBe(3);
    expect(value.unwrapOr(999)).toBe(2);
    expect(value.match({ ok: (v) => v + 10, err: () => 0 })).toBe(12);
  });
  it('supports Err helpers', () => {
    const value = err('boom') as Result<number, string>;
    expect(value.isOk()).toBe(false);
    expect(value.isErr()).toBe(true);
    expect(value.map((v: number) => v * 2).match({ ok: (v) => v, err: () => 0 })).toBe(0);
    expect(value.mapErr((e) => `mapped:${e}`).match({ ok: () => '', err: (e) => e })).toBe(
      'mapped:boom',
    );
    expect(value.flatMap((v: number) => ok(v + 1)).match({ ok: (v) => v, err: () => 0 })).toBe(0);
    expect(value.unwrapOr(777)).toBe(777);
    expect(value.match({ ok: () => 'ok', err: (e) => e })).toBe('boom');
  });
  it('exposes result type guards', () => {
    const success = ok('x');
    const failure = err(new Error('x'));
    expect(Result.isResult(success)).toBe(true);
    expect(Result.isResult(failure)).toBe(true);
    expect(Result.isResult({})).toBe(false);
    expect(Result.isOk(success)).toBe(true);
    expect(Result.isErr(success)).toBe(false);
    expect(Result.isOk(failure)).toBe(false);
    expect(Result.isErr(failure)).toBe(true);
  });
  it('combines tuple results and short-circuits on first error', () => {
    const combined = Result.combine([ok(1), ok('a'), ok(true)]);
    const failed = Result.combine([ok(1), err('stop'), ok(true)]);
    expect(combined.isOk()).toBe(true);
    if (combined.isOk()) {
      expect(combined.value[0]).toBe(1);
      expect(combined.value[1]).toBe('a');
      expect(combined.value[2]).toBe(true);
    }
    expect(failed.isErr()).toBe(true);
    if (failed.isErr()) {
      expect(failed.error).toBe('stop');
    }
  });
  it('combines record results and collects all errors', () => {
    const success = Result.combineAll({
      a: ok(1),
      b: ok('ok'),
    });
    const failed = Result.combineAll({
      a: err('a'),
      b: ok('ok'),
      c: err('c'),
    });
    expect(success.isOk()).toBe(true);
    if (success.isOk()) {
      expect(success.value.a).toBe(1);
      expect(success.value.b).toBe('ok');
    }
    expect(failed.isErr()).toBe(true);
    if (failed.isErr()) {
      expect(failed.error).toEqual(['a', 'c']);
    }
  });
  it('wraps throwables with fromThrowable', () => {
    const success = Result.fromThrowable(() => 42);
    const failed = Result.fromThrowable(
      () => {
        throw new Error('bad');
      },
      (e) => (e instanceof Error ? e.message : 'unknown'),
    );
    expect(success.isOk()).toBe(true);
    if (success.isOk()) {
      expect(success.value).toBe(42);
    }
    expect(failed.isErr()).toBe(true);
    if (failed.isErr()) {
      expect(failed.error).toBe('bad');
    }
  });
  it('validates optional values', () => {
    const undefinedResult = Result.validateOptional(undefined, (value: number) => ok(value * 2));
    const definedResult = Result.validateOptional(5, (value: number) => ok(value * 2));
    const definedError = Result.validateOptional(5, (_value: number) => err('bad'));
    expect(undefinedResult.isOk()).toBe(true);
    if (undefinedResult.isOk()) {
      expect(undefinedResult.value).toBeUndefined();
    }
    expect(definedResult.isOk()).toBe(true);
    if (definedResult.isOk()) {
      expect(definedResult.value).toBe(10);
    }
    expect(definedError.isErr()).toBe(true);
    if (definedError.isErr()) {
      expect(definedError.error).toBe('bad');
    }
  });
  it('unwrapOk returns value and throws for forced Err path', () => {
    expect(Result.unwrapOk(ok('done'))).toBe('done');
    const impossible = err('fail') as unknown as Result<string, never>;
    expect(() => Result.unwrapOk(impossible)).toThrow(
      'Unreachable: infallible Result contained Err',
    );
  });
});
