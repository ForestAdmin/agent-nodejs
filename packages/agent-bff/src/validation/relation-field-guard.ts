import { relationFieldNotSupported } from '../http/bff-http-error';

const RELATION_SEPARATOR = ':';

export default function assertNoRelationFieldPaths(paths: string[]): void {
  const offending: string[] = [];

  for (const path of paths) {
    if (path.includes(RELATION_SEPARATOR) && !offending.includes(path)) {
      offending.push(path);
    }
  }

  if (offending.length > 0) throw relationFieldNotSupported(offending);
}
