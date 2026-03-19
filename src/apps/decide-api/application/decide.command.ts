export interface DecideCommand {
  subjectId: string;
  attributes: Record<string, unknown>;
  flagKeys: string[];
}
