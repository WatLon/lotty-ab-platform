export interface UpdateApproverGroupCommand {
  actorId: string;
  groupId: string;
  requiredApprovals: number;
}
