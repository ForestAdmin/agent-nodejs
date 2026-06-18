import type { CanExecuteOperation, CanExecuteVerdict } from '../types/mcp';

export interface McpPermissionResolver {
  resolve(userId: number, operation: CanExecuteOperation): Promise<CanExecuteVerdict>;
}

// Seam for tool-level RBAC. forestadmin-client's permission service is collection/action-only
// today and the executor token carries no renderingId, so a real check can't be wired here yet.
// The executor only ANSWERS; the gateway ENFORCES. The verdict is reported as not-yet-resolved so
// the gateway can decide its own policy rather than mistaking an unimplemented check for a grant.
// Forest-native operations and connector RBAC plug in here once the server primitive exists.
export default class PendingMcpPermissionResolver implements McpPermissionResolver {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, class-methods-use-this
  async resolve(userId: number, operation: CanExecuteOperation): Promise<CanExecuteVerdict> {
    return { allowed: true, reason: 'permission-resolution-pending' };
  }
}
