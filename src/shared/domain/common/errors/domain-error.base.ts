export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = this.constructor.name;
  }

  toPlain(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
    };
  }
}
