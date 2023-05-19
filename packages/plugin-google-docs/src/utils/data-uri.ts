// eslint-disable-next-line import/prefer-default-export
export function encodeDataUri(data: { mimeType: string; buffer: Buffer }): string {
  // prefix
  let uri = `data:${data.mimeType}`;

  // media types
  const mediaTypes = Object.entries(data)
    .filter(([mediaType, value]) => value && mediaType !== 'mimeType' && mediaType !== 'buffer')
    .map(([mediaType, value]) => `${mediaType}=${encodeURIComponent(value as string)}`)
    .join(';');

  if (mediaTypes.length) uri += `;${mediaTypes}`;

  // data
  uri += `;base64,${data.buffer.toString('base64')}`;

  return uri;
}
