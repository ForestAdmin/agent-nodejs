/**
 * @param {import('@forestadmin/agent').Agent} agent
 */
function customize(agent) {
  agent.addChart('test-exports', (context, resultBuilder) =>
    resultBuilder.distribution({
      foo: 42,
      bar: 24,
    }),
  );
}

module.exports = customize;
