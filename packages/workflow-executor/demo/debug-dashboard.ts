/**
 * Demo script — launches only the HTTP server with simulated events.
 * No agent, no orchestrator, no AI needed.
 *
 * Usage:
 *   npx ts-node packages/workflow-executor/demo/debug-dashboard.ts
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { PassThrough } from 'stream';

const PORT = Number(process.env.PORT) || 3142;
const events = new EventEmitter();

const dashboardHtml = fs.readFileSync(
  path.join(__dirname, '../src/http/debug-dashboard.html'),
  'utf-8',
);

const server = http.createServer((req, res) => {
  if (req.url === '/debug') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(dashboardHtml);

    return;
  }

  if (req.url === '/debug/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    res.write(':ok\n\n');

    const eventNames = [
      'poll:start',
      'poll:end',
      'step:start',
      'step:end',
      'step:error',
      'drain:start',
      'drain:end',
    ];

    const handlers = eventNames.map(name => {
      const handler = (data: unknown) =>
        res.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
      events.on(name, handler);

      return { name, handler };
    });

    req.on('close', () => {
      handlers.forEach(({ name, handler }) => events.removeListener(name, handler));
    });

    return;
  }

  res.writeHead(302, { Location: '/debug' });
  res.end();
});

// ── Simulate events ──

let runCounter = 0;

function simulateRun() {
  runCounter += 1;
  const runId = `run-${runCounter}`;
  const stepTypes = ['condition', 'read-record', 'update-record', 'trigger-record-action'];
  const stepCount = 2 + Math.floor(Math.random() * 3);

  let delay = 0;

  for (let i = 0; i < stepCount; i += 1) {
    const stepId = `${runId}-step-${i}`;
    const stepType = stepTypes[Math.floor(Math.random() * stepTypes.length)];
    const durationMs = 200 + Math.floor(Math.random() * 2000);

    delay += 500 + Math.floor(Math.random() * 1000);

    setTimeout(() => {
      events.emit('step:start', { runId, stepId, stepIndex: i, stepType });
    }, delay);

    delay += durationMs;

    setTimeout(() => {
      const roll = Math.random();

      if (roll < 0.12) {
        events.emit('step:error', {
          runId,
          stepId,
          error: 'Simulated error: AI returned invalid tool call',
        });
      } else if (roll < 0.4) {
        // Awaiting input — then resume after 3-8s
        events.emit('step:end', { runId, stepId, status: 'awaiting-input', durationMs });

        const resumeDelay = 3000 + Math.floor(Math.random() * 5000);
        const resumeDuration = 200 + Math.floor(Math.random() * 1000);

        setTimeout(() => {
          events.emit('step:start', { runId, stepId, stepIndex: i, stepType });
          setTimeout(() => {
            events.emit('step:end', { runId, stepId, status: 'success', durationMs: resumeDuration });
          }, resumeDuration);
        }, resumeDelay);
      } else {
        events.emit('step:end', { runId, stepId, status: 'success', durationMs });
      }
    }, delay);
  }
}

function simulatePollCycle() {
  events.emit('poll:start', {});

  const stepsFound = Math.floor(Math.random() * 4);
  events.emit('poll:end', { stepsFound });

  if (stepsFound > 0) {
    simulateRun();
  }
}

server.listen(PORT, () => {
  console.log(`\n  Debug dashboard: http://localhost:${PORT}/debug\n`);

  // Poll every 3-6s
  const poll = () => {
    simulatePollCycle();
    setTimeout(poll, 3000 + Math.random() * 3000);
  };

  poll();
});
