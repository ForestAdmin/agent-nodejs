import Fastify from 'fastify4';

export default function startFastifyV4() {
  const fastify = Fastify();

  fastify.get('/', (request, reply) => {
    reply.send({ error: null, framework: 'Fastify 4' });
  });

  return fastify;
}
