import { Entity, ok, Result } from '@/shared/domain/common';
import { VariantName, VariantValue, VariantWeight } from '../value-objects';
import { VariantId } from '../value-objects/variant.id';

export interface VariantProps {
  name: VariantName;
  value: VariantValue;
  weight: VariantWeight;
  isControl: boolean;
}

export interface CreateVariantProps {
  name: VariantName;
  value: VariantValue;
  weight: VariantWeight;
  isControl: boolean;
}

export class Variant extends Entity<VariantProps, VariantId> {
  private constructor(props: VariantProps, id: VariantId) {
    super(props, id);
  }

  static create(props: CreateVariantProps): Result<Variant, never> {
    return ok(new Variant(props, VariantId.generate()));
  }

  static reconstitute(props: VariantProps, id: VariantId): Variant {
    return new Variant(props, id);
  }

  get name(): VariantName {
    return this.props.name;
  }

  get value(): VariantValue {
    return this.props.value;
  }

  get weight(): VariantWeight {
    return this.props.weight;
  }

  get isControl(): boolean {
    return this.props.isControl;
  }

  changeName(name: VariantName): void {
    this.props.name = name;
  }

  changeValue(value: VariantValue): void {
    this.props.value = value;
  }

  changeWeight(weight: VariantWeight): void {
    this.props.weight = weight;
  }

  setAsControl(isControl: boolean): void {
    this.props.isControl = isControl;
  }
}
