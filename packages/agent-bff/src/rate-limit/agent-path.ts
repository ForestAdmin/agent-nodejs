export default function isAgentPath(path: string): boolean {
  return path === '/agent' || path.startsWith('/agent/');
}
