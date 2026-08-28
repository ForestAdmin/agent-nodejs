// One definition of the agent-edge boundary, shared by the scoping wrapper in `cli-core` and the
// rate limiter: a security scope that lives in two places can drift.
export default function isAgentPath(path: string): boolean {
  return path === '/agent' || path.startsWith('/agent/');
}
