export type CloseTicketStatus = 'solved' | 'closed';

export type CloseTicketOutcome = {
  succeeded: Array<number | string>;
  alreadyClosed: Array<number | string>;
  failed: Array<{ id: number | string; error: string }>;
};

export function buildSuccessMessage(
  outcome: CloseTicketOutcome,
  status: CloseTicketStatus,
): string {
  const verb = status === 'solved' ? 'solved' : 'closed';
  const parts: string[] = [];

  if (outcome.succeeded.length === 1 && outcome.alreadyClosed.length === 0) {
    parts.push(`Ticket #${outcome.succeeded[0]} marked as ${verb}.`);
  } else if (outcome.succeeded.length > 0) {
    parts.push(`${outcome.succeeded.length} ticket(s) marked as ${verb}.`);
  }

  if (outcome.alreadyClosed.length > 0) {
    parts.push(
      `${outcome.alreadyClosed.length} ticket(s) were already closed (Zendesk does not allow editing closed tickets).`,
    );
  }

  if (outcome.failed.length > 0) {
    parts.push(`${outcome.failed.length} ticket(s) failed to update.`);
  }

  return parts.join(' ');
}

export function buildErrorMessage(outcome: CloseTicketOutcome, status: CloseTicketStatus): string {
  const verb = status === 'solved' ? 'solve' : 'close';

  if (outcome.failed.length === 1) {
    const [{ id, error }] = outcome.failed;

    return `Failed to ${verb} ticket #${id}: ${error}`;
  }

  if (outcome.failed.length > 1) {
    return `Failed to ${verb} ${outcome.failed.length} ticket(s).`;
  }

  return `No tickets were ${verb === 'solve' ? 'solved' : 'closed'}.`;
}
