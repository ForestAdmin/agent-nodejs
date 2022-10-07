import Fastify from 'fastify2';

export default function startFastifyV2() {
  const fastify = Fastify();

  fastify.get('/', (request, reply) => {
    reply.send({ error: null, framework: 'Fastify 2' });
  });

  return fastify;
}
