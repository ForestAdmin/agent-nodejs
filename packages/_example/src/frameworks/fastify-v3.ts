import Fastify from 'fastify';

export default function startFastifyV3() {
  const fastify = Fastify();

  fastify.get('/', (request, reply) => {
    reply.send({ error: null, framework: 'Fastify 3' });
  });

  return fastify;
}
