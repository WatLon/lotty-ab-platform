import { AggregateRoot, ok, Result } from '@/shared/domain/common';
import { MetricId } from './metric.id';
import { MetricFormula } from './value-objects/metric-formula.vo';
import { MetricKey } from './value-objects/metric-key.vo';
import { MetricName } from './value-objects/metric-name.vo';

export interface MetricProps {
  key: MetricKey;
  name: MetricName;
  description: string | null;
  formula: MetricFormula;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface CreateMetricProps {
  key: MetricKey;
  name: MetricName;
  description: string | null;
  formula: MetricFormula;
}

export class Metric extends AggregateRoot<MetricProps, MetricId> {
  private constructor(props: MetricProps, id: MetricId) {
    super(props, id);
  }

  static create(props: CreateMetricProps): Result<Metric, never> {
    return ok(
      new Metric(
        {
          ...props,
          isArchived: false,
          createdAt: new Date(),
          updatedAt: null,
        },
        MetricId.generate(),
      ),
    );
  }

  static reconstitute(props: MetricProps, id: MetricId): Metric {
    return new Metric(props, id);
  }

  get key(): MetricKey {
    return this.props.key;
  }

  get name(): string {
    return this.props.name.value;
  }

  get description(): string | null {
    return this.props.description;
  }

  get formula(): MetricFormula {
    return this.props.formula;
  }

  get isArchived(): boolean {
    return this.props.isArchived;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date | null {
    return this.props.updatedAt;
  }

  changeName(name: MetricName): void {
    if (name.equals(this.props.name)) return;

    this.props.name = name;
    this.props.updatedAt = new Date();
  }

  changeDescription(description: string | null): void {
    if (description === this.props.description) return;

    this.props.description = description;
    this.props.updatedAt = new Date();
  }

  archive(): void {
    if (this.props.isArchived) return;

    this.props.isArchived = true;
    this.props.updatedAt = new Date();
  }
}
