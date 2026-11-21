import type { Logger } from '../server';

export const MAX_UPLOAD_ORIGINS = 16;

const LOCAL_DEV_HOSTNAME = 'localhost';

export interface UploadOrigins {
  add(uploadUrl: string): void;
  list(): string[];
}

export function connectableOrigin(uploadUrl: string): string | undefined {
  if (!URL.canParse(uploadUrl)) return undefined;

  const { protocol, hostname, origin } = new URL(uploadUrl);

  if (protocol === 'https:') return origin;
  if (protocol === 'http:' && hostname === LOCAL_DEV_HOSTNAME) return origin;

  return undefined;
}

export function createUploadOrigins(logger: Logger): UploadOrigins {
  const origins = new Set<string>();

  return {
    add(uploadUrl) {
      const origin = connectableOrigin(uploadUrl);

      if (!origin) {
        logger(
          'Warn',
          'An upload URL is neither https nor http://localhost: the records view cannot upload to it.',
        );

        return;
      }

      if (origins.has(origin)) return;

      if (origins.size >= MAX_UPLOAD_ORIGINS) {
        logger(
          'Warn',
          `The records view already allows ${MAX_UPLOAD_ORIGINS} upload origins: ${origin} is not added.`,
        );

        return;
      }

      origins.add(origin);
    },
    list: () => [...origins],
  };
}
