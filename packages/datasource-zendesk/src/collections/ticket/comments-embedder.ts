import type { ZendeskClient } from '../../client';
import type { ZendeskRecord } from '../../types';
import type { Projection, RecordData } from '@forestadmin/datasource-toolkit';

function serializeComment(
  comment: ZendeskRecord,
  authorsById: Map<number, ZendeskRecord>,
): RecordData {
  const authorId = comment.author_id as number | undefined;
  const author = authorId !== undefined ? authorsById.get(authorId) : undefined;

  return {
    id: comment.id as RecordData[string],
    body: comment.body as RecordData[string],
    html_body: comment.html_body as RecordData[string],
    public: comment.public as RecordData[string],
    author_email: (author?.email as RecordData[string]) ?? null,
    author_name: (author?.name as RecordData[string]) ?? null,
    created_at: comment.created_at as RecordData[string],
  };
}

export function isCommentsRequested(projection: Projection): boolean {
  return projection.some(path => path === 'comments' || path.startsWith('comments:'));
}

export async function embedComments(records: RecordData[], client: ZendeskClient): Promise<void> {
  if (records.length === 0) return;

  const commentsByTicket = await Promise.all(
    records.map(record =>
      typeof record.id === 'number' || typeof record.id === 'string'
        ? client.bestEffort(`fetch_ticket_comments(${record.id})`, [] as ZendeskRecord[], () =>
            client.fetchTicketComments(record.id as number | string),
          )
        : Promise.resolve([] as ZendeskRecord[]),
    ),
  );

  const authorIds = new Set<number>();

  for (const comments of commentsByTicket) {
    for (const comment of comments) {
      const authorId = comment.author_id;
      if (typeof authorId === 'number') authorIds.add(authorId);
    }
  }

  const authorsById =
    authorIds.size > 0 ? await client.fetchUsersByIds(Array.from(authorIds)) : new Map();

  records.forEach((record, idx) => {
    record.comments = (commentsByTicket[idx] ?? []).map(comment =>
      serializeComment(comment, authorsById),
    );
  });
}
