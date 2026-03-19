export type Result<T, E = Error> = Ok<T, E> | Err<T, E>;

export class Ok<T, E = never> {
  readonly _tag = 'ok' as const;

  constructor(public readonly value: T) {}

  isOk(): this is Ok<T, E> {
    return true;
  }

  isErr(): this is Err<T, E> {
    return false;
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    return ok(fn(this.value));
  }

  mapErr<F>(_fn: (error: E) => F): Result<T, F> {
    return ok(this.value);
  }

  flatMap<U, F>(fn: (value: T) => Result<U, F>): Result<U, E | F> {
    return fn(this.value);
  }

  unwrapOr(_defaultValue: T): T {
    return this.value;
  }

  match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): U {
    return handlers.ok(this.value);
  }
}

export class Err<T = never, E = Error> {
  readonly _tag = 'err' as const;

  constructor(public readonly error: E) {}

  isOk(): this is Ok<T, E> {
    return false;
  }

  isErr(): this is Err<T, E> {
    return true;
  }

  map<U>(_fn: (value: T) => U): Result<U, E> {
    return err(this.error);
  }

  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    return err(fn(this.error));
  }

  flatMap<U, F>(_fn: (value: T) => Result<U, F>): Result<U, E | F> {
    return err(this.error);
  }

  unwrapOr(defaultValue: T): T {
    return defaultValue;
  }

  match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): U {
    return handlers.err(this.error);
  }
}

export const ok = <T>(value: T): Result<T, never> => new Ok(value);
export const err = <E>(error: E): Result<never, E> => new Err(error);

export function unwrapOrThrow<T, E>(result: Result<T, E>): T {
  if (result.isErr()) {
    throw result.error;
  }

  return result.value;
}

type ExtractOk<T> = T extends Result<infer U, unknown> ? U : never;
type ExtractErr<T> = T extends Result<unknown, infer E> ? E : never;

export namespace Result {
  export const ok = <T>(value: T): Result<T, never> => new Ok(value);
  export const err = <E>(error: E): Result<never, E> => new Err(error);

  export function isResult(value: unknown): value is Result<unknown, unknown> {
    return value instanceof Ok || value instanceof Err;
  }

  export function combine<T extends Result<unknown, unknown>[]>(
    results: [...T],
  ): Result<{ [K in keyof T]: ExtractOk<T[K]> }, ExtractErr<T[number]>> {
    const values: unknown[] = [];
    for (const result of results) {
      if (result.isErr()) return err(result.error as ExtractErr<T[number]>);

      values.push(result.value);
    }

    return ok(values as { [K in keyof T]: ExtractOk<T[K]> });
  }

  export function combineAll<T extends Record<string, Result<unknown, unknown>>>(
    results: T,
  ): Result<{ [K in keyof T]: ExtractOk<T[K]> }, ExtractErr<T[keyof T]>[]> {
    const values: Record<string, unknown> = {};
    const errors: unknown[] = [];
    for (const key of Object.keys(results)) {
      const result = results[key];
      if (result.isErr()) errors.push(result.error);
      else values[key] = result.value;
    }
    if (errors.length > 0) return err(errors as ExtractErr<T[keyof T]>[]);

    return ok(values as { [K in keyof T]: ExtractOk<T[K]> });
  }

  export function validateOptional<T, U, E>(
    value: T | undefined,
    validate: (v: T) => Result<U, E>,
  ): Result<U | undefined, E> {
    if (value === undefined) return ok(undefined);

    return validate(value);
  }

  export function validateNullable<T extends {}, U, E>(
    value: T | null,
    validate: (v: T) => Result<U, E>,
  ): Result<U | null, E>;
  export function validateNullable<T extends {}, U, E>(
    value: T | null | undefined,
    validate: (v: T) => Result<U, E>,
  ): Result<U | null | undefined, E>;
  export function validateNullable<T extends {}, U, E>(
    value: T | null | undefined,
    validate: (v: T) => Result<U, E>,
  ): Result<U | null | undefined, E> {
    if (value === undefined) return ok(undefined);
    if (value === null) return ok(null);

    return validate(value);
  }

  export function validateArray<T extends {}, U, E>(
    values: readonly T[],
    validate: (v: T) => Result<U, E>,
  ): Result<U[], E>;
  export function validateArray<T extends {}, U, E>(
    values: readonly T[] | undefined,
    validate: (v: T) => Result<U, E>,
  ): Result<U[] | undefined, E>;
  export function validateArray<T extends {}, U, E>(
    values: readonly T[] | undefined,
    validate: (v: T) => Result<U, E>,
  ): Result<U[] | undefined, E> {
    if (values === undefined) return ok(undefined);

    const parsed: U[] = [];
    for (const value of values) {
      const result = validate(value);
      if (result.isErr()) return err(result.error);

      parsed.push(result.value);
    }
    return ok(parsed);
  }

  export function fromThrowable<T, E = Error>(
    fn: () => T,
    errorFn: (e: unknown) => E = (e) => e as E,
  ): Result<T, E> {
    try {
      return ok(fn());
    } catch (e: unknown) {
      return err(errorFn(e));
    }
  }

  export function unwrapOk<T>(result: Result<T, never>): T {
    if (result.isOk()) return result.value;

    throw new Error('Unreachable: infallible Result contained Err');
  }

  export function isOk<T, E>(value: Result<T, E>): value is Ok<T, E> {
    return value instanceof Ok;
  }

  export function isErr<T, E>(value: Result<T, E>): value is Err<T, E> {
    return value instanceof Err;
  }
}
