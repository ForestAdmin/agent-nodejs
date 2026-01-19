/**
 * Extract a header value from Gmail message payload
 */
export function getHeader(
  payload: { headers?: Array<{ name: string; value: string }> },
  name: string,
): string {
  return (
    payload.headers?.find(
      (h: { name: string; value: string }) => h.name.toLowerCase() === name.toLowerCase(),
    )?.value || ''
  );
}

/**
 * Decode base64url-encoded body data from Gmail API
 */
function decodeBody(body: string): string {
  if (!body) return '';

  try {
    const sanitized = body.replace(/-/g, '+').replace(/_/g, '/');

    return Buffer.from(sanitized, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

/**
 * Extract body content from Gmail message payload (recursively searches parts)
 */
export function getBody(payload: any): string {
  if (payload.body?.data) {
    return decodeBody(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const body = getBody(part);
      if (body) return body;
    }
  }

  return '';
}

/**
 * Encode email message for Gmail API (base64url encoding)
 */
export function encodeEmail(params: {
  to: string[];
  subject: string;
  message: string;
  cc?: string[];
  bcc?: string[];
}): string {
  const { to, subject, message, cc, bcc } = params;

  const emailLines = [
    `To: ${to.join(', ')}`,
    ...(cc ? [`Cc: ${cc.join(', ')}`] : []),
    ...(bcc ? [`Bcc: ${bcc.join(', ')}`] : []),
    `Subject: ${subject}`,
    '',
    message,
  ];

  const email = emailLines.join('\r\n');

  return Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
