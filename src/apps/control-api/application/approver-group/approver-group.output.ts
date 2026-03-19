export interface ApproverGroupOutput {
  id: string;
  ownerId: string;
  requiredApprovals: number;
  memberIds: string[];
  createdAt: Date;
  updatedAt: Date | null;
}
