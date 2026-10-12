import { DOCS_BUNDLE_PATH, DOCS_PATH } from './docs/docs-routes';
import { HEALTH_PATH } from './http/health-route';
import isAgentPath from './rate-limit/agent-path';

export type ClaimsBffPathOptions = { docs: boolean };

const DOCS_PATHS = new Set([DOCS_PATH, DOCS_BUNDLE_PATH]);

export default function claimsBffPath(pathname: string, { docs }: ClaimsBffPathOptions): boolean {
  if (isAgentPath(pathname) || pathname === HEALTH_PATH) return true;

  return docs && DOCS_PATHS.has(pathname);
}
