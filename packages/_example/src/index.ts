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

  // Make and mount agent.
  const agent = makeAgent().mountOnStandaloneServer(Number(process.env.HTTP_PORT_STANDALONE));
  // .mountOnExpress(expressAppV4)
  // .mountOnKoa(koaAppV2)
  // .mountOnFastify(fastifyAppV2)
  // .mountOnFastify(fastifyAppV3)
  // .mountOnNestJs(nestExpressV8)
  // .mountOnNestJs(nestFastifyV8);

  // Run the servers!
  expressAppV4.listen(Number(process.env.HTTP_PORT_EXPRESS));
  koaAppV2.listen(Number(process.env.HTTP_PORT_KOA));
  fastifyAppV2.listen(Number(process.env.HTTP_PORT_FASTIFY_V2));
  fastifyAppV3.listen(Number(process.env.HTTP_PORT_FASTIFY_V3));
  await nestExpressV8.listen(Number(process.env.HTTP_PORT_NEST_EXPRESS_V8));
  await nestFastifyV8.listen(Number(process.env.HTTP_PORT_NEST_FASTIFY_V8));

  // We can start agent later.
  await agent.start();
};
