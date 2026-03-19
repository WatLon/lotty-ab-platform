export abstract class ValueObject<TProps extends object> {
  protected readonly props: TProps;

  protected constructor(props: TProps) {
    this.props = deepFreeze(props);
  }

  equals(other: unknown): boolean {
    if (other === undefined || other === null) {
      return false;
    }

    if (!(other instanceof ValueObject)) {
      return false;
    }

    if (this === other) {
      return true;
    }

    return deepEqual(this.props, other.props);
  }
}

function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object' || obj instanceof ValueObject) {
    return obj;
  }

  if (Object.isFrozen(obj)) {
    return obj;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item) => {
      deepFreeze(item);
    });

    return Object.freeze(obj);
  }

  const record = obj as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    deepFreeze(record[key]);
  }

  return Object.freeze(obj);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  if (a === null || b === null || a === undefined || b === undefined) {
    return false;
  }

  if (a instanceof ValueObject) {
    return a.equals(b);
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }

    return a.every((item, index) => deepEqual(item, b[index]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const aKeys = Object.keys(aRecord);
    const bKeys = Object.keys(bRecord);

    if (aKeys.length !== bKeys.length) {
      return false;
    }

    return aKeys.every((key) => key in bRecord && deepEqual(aRecord[key], bRecord[key]));
  }

  return false;
}
