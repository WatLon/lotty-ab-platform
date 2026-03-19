import { Identity, StringId } from './identity';

export abstract class Entity<TProps, TId extends Identity = StringId> {
  protected readonly _id: TId;

  protected readonly props: TProps;

  protected constructor(props: TProps, id: TId) {
    this.props = props;
    this._id = id;
  }

  get id(): TId {
    return this._id;
  }
}
