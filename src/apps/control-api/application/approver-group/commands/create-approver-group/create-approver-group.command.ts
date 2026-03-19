export interface CreateApproverGroupCommand {
  actorId: string;
  ownerId: string;
  requiredApprovals: number;
}
