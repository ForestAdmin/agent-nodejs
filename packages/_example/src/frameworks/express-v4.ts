import express from 'express';

export default function startExpressV4(): express.Express {
  const app = express();

  app.get('/', (req, res) => {
    res.json({ error: null, framework: 'Express.js' });
  });

  return app;
}
