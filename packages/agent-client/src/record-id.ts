import type { RecordId } from './types';

// Forest Admin backend expects composite PKs pipe-joined (e.g. "k1|k2"). Centralizing the
// encoding here lets callers pass structured arrays and keeps the convention out of their code.
export default function encodeRecordId(id: RecordId): string {
  return Array.isArray(id) ? id.map(v => String(v)).join('|') : String(id);
}
