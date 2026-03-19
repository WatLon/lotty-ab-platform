import { Operator } from './operators';

export interface TargetingConditionNode {
  attribute: string;
  op: Operator;
  value: unknown;
}

export interface TargetingAndNode {
  and: readonly TargetingAstNode[];
}

export interface TargetingOrNode {
  or: readonly TargetingAstNode[];
}

export interface TargetingNotNode {
  not: TargetingAstNode;
}

export type TargetingAstNode =
  | TargetingConditionNode
  | TargetingAndNode
  | TargetingOrNode
  | TargetingNotNode;
