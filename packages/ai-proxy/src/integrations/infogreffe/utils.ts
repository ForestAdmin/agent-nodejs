const API_BASE_V1 = 'https://opendata.datainfogreffe.fr/api/records/1.0/search';

export interface DatainfogreffeRecord {
  fields: Record<string, unknown>;
  recordid: string;
}

export interface DatainfogreffeResponse {
  nhits: number;
  records: DatainfogreffeRecord[];
}

export async function searchV1Api(
  headers: Record<string, string>,
  dataset: string,
  query?: string,
  rows = 10,
): Promise<DatainfogreffeResponse> {
  const params = new URLSearchParams({ dataset, rows: rows.toString() });
  if (query) params.set('q', query);

  const response = await fetch(`${API_BASE_V1}?${params}`, { headers });

  if (!response.ok) {
    if (response.status === 404) {
      return { nhits: 0, records: [] };
    }

    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export function buildQuery(parts: Array<string | undefined>): string | undefined {
  const filtered = parts.filter(Boolean);

  return filtered.length > 0 ? filtered.join(' AND ') : undefined;
}
