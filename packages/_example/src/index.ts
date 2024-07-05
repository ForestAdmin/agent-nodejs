import { createSqlDataSource } from '@forestadmin/datasource-sql';
import { createRpcAgent } from '@forestadmin-experimental/rpc-agent';
import dotenv from 'dotenv';

import makeAgent from './forest/agent';
import startExpress from './frameworks/express-v4';
import startFastifyV2 from './frameworks/fastify-v2';
import startFastifyV3 from './frameworks/fastify-v3';
import startKoa from './frameworks/koa-v2';
import startNestExpressV8 from './frameworks/nest-express-v8';
import startNestFastifyV8 from './frameworks/nest-fastify-v8';

dotenv.config();

export default async () => {
  // Create customer apps
  const expressAppV4 = startExpress();
  const koaAppV2 = startKoa();
  const fastifyAppV2 = startFastifyV2();
  const fastifyAppV3 = startFastifyV3();
  const nestExpressV8 = await startNestExpressV8();
  const nestFastifyV8 = await startNestFastifyV8();

  const rpcAgent = createRpcAgent({
    authSecret: process.env.FOREST_AUTH_SECRET,
    envSecret: process.env.FOREST_ENV_SECRET,
    forestServerUrl: process.env.FOREST_SERVER_URL,
    isProduction: false,
    loggerLevel: 'Info',
  })
    .addDataSource(createSqlDataSource('mariadb://example:password@localhost:3808/example'))
    .customizeCollection('card', collection => {
      collection
        .addSegment('rpc', { field: 'card_type', operator: 'Equal', value: 'visa' })
        .addChart('test chart', (context, resultbuilder) => {
          return resultbuilder.value(3);
        })
        .addAction('rpc', {
          scope: 'Global',
          form: [
            {
              label: 'test',
              type: 'String',
            },
          ],
          execute: (context, resultbuilder) => {
            return resultbuilder.success('au top ca marche');
          },
        });
    })
    .mountOnExpress(expressAppV4);

  // Run the servers!
  expressAppV4.listen(Number(process.env.HTTP_PORT_EXPRESS));
  koaAppV2.listen(Number(process.env.HTTP_PORT_KOA));
  await fastifyAppV2.listen(Number(process.env.HTTP_PORT_FASTIFY_V2));
  await fastifyAppV3.listen(Number(process.env.HTTP_PORT_FASTIFY_V3));
  await nestExpressV8.listen(Number(process.env.HTTP_PORT_NEST_EXPRESS_V8));
  await nestFastifyV8.listen(Number(process.env.HTTP_PORT_NEST_FASTIFY_V8));

  await rpcAgent.start();

  // Make and mount agent.
  const agent = makeAgent().mountOnStandaloneServer(Number(process.env.HTTP_PORT_STANDALONE));

  // We can start agent later.
  await agent.start();
};
