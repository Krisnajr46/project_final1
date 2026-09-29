const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const client = require('prom-client');

client.collectDefaultMetrics();
const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Durasi request HTTP',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2],
});

function createApp(store) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(express.json({ limit: '10kb' }));

  // Structured JSON logging + metrics
  app.use((req, res, next) => {
    const end = httpDuration.startTimer();
    res.on('finish', () => {
      const route = req.route ? req.baseUrl + req.route.path : 'other';
      end({ method: req.method, route, status: res.statusCode });
      console.log(JSON.stringify({ ts: new Date().toISOString(), method: req.method,
        path: req.originalUrl, status: res.statusCode, ip: req.ip }));
    });
    next();
  });

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  const api = express.Router();
  api.use(rateLimit({ windowMs: 60_000, limit: 100 }));
  api.get('/todos', async (_req, res) => res.json(await store.list()));
  api.post('/todos', async (req, res) => {
    const title = (req.body.title || '').toString().trim();
    if (!title || title.length > 200) return res.status(400).json({ error: 'title wajib (1-200 karakter)' });
    res.status(201).json(await store.add(title));
  });
  api.patch('/todos/:id', async (req, res) => {
    const t = await store.toggle(Number(req.params.id));
    return t ? res.json(t) : res.status(404).json({ error: 'tidak ditemukan' });
  });
  api.delete('/todos/:id', async (req, res) => {
    await store.remove(Number(req.params.id));
    res.status(204).end();
  });
  app.use('/api', api);

  app.use((err, _req, res, _next) => {
    console.error(JSON.stringify({ level: 'error', msg: err.message }));
    res.status(500).json({ error: 'internal server error' });
  });
  return app;
}
module.exports = { createApp };
