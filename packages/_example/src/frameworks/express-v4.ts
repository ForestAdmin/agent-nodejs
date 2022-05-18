import express from 'express';

export default function startExpressV4() {
  const app = express();

  app.get('/', (req, res) => {
    res.json({ error: null, framework: 'Express.js' });
  });

  return app;
}
