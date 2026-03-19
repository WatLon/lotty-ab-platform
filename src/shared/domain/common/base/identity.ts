export interface Identity {
  equals(other: unknown): boolean;
  toString(): string;
}

export abstract class StringId implements Identity {
  protected abstract readonly _brand: string;

  constructor(public readonly value: string) {}

  equals(other: unknown): boolean {
    if (!(other instanceof StringId)) return false;

    return this._brand === other._brand && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
