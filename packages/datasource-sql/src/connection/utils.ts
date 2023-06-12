import type { Logger } from '@forestadmin/datasource-toolkit';

export default function getLogger(logger: Logger): (sql: string) => void {
  return (sql: string) => logger?.('Debug', sql.substring(sql.indexOf(':') + 2));
}
