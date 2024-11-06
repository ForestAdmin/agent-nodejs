import fs from 'fs/promises';

import { BusinessError } from '../errors';

const content = `
/**
 * @returns {Record<string, { connectionOptions: (import('@forestadmin/datasource-sql').ConnectionOptions | import('@forestadmin/datasource-mongo').ConnectionParams); datasourceSuffix?: string; }>}
 */
module.exports = () => ({
    main: {
        connectionOptions: {
            uri: "postgres://username:password@localhost:5432/postgres",
        },
    },
})
`;

export default async function generateDatasourceConfigFile(path: string) {
  try {
    await fs.writeFile(path, content, { encoding: 'utf-8' });
  } catch (e) {
    throw new BusinessError('Could not generate Datasource connection options file', e);
  }
}
