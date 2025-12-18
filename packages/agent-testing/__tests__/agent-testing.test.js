'use strict';

const agentTesting = require('..');
const assert = require('assert').strict;

assert.strictEqual(agentTesting(), 'Hello from agentTesting');
console.info('agentTesting tests passed');
