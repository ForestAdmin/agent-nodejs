export type ApprovalRequestedResult = { approvalRequested: true; approvalRequest?: { id: string } };

export function isApprovalRequested(result: unknown): result is ApprovalRequestedResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    (result as { approvalRequested?: unknown }).approvalRequested === true
  );
}
