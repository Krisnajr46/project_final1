const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const client = require('prom-client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

client.collectDefaultMetrics();
const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Durasi request HTTP',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2],
});

function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'Token tidak ada' });

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'SECRET_KEY');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Token tidak valid' });
  }
}

function createApp(store) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(express.json({ limit: '10kb' }));

  // Logging + metrics
  app.use((req, res, next) => {
    const end = httpDuration.startTimer();
    res.on('finish', () => {
      const route = req.route ? req.baseUrl + req.route.path : 'other';
      end({ method: req.method, route, status: res.statusCode });
      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        ip: req.ip
      }));
    });
    next();
  });

  // Monitoring & health
  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  const api = express.Router();
  api.use(rateLimit({ windowMs: 60_000, limit: 100 }));

  // 🔑 Authentication
  api.post('/auth/signup', async (req, res) => {
    const { email, password } = req.body;
    const existing = await store.getUserByEmail(email);
    if (existing) return res.status(400).json({ error: 'User sudah ada' });

    const hash = await bcrypt.hash(password, 10);
    const user = await store.createUser(email, hash);
    res.status(201).json({ message: 'Signup berhasil', user });
  });

  api.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await store.getUserByEmail(email);
    if (!user) return res.status(400).json({ error: 'User tidak ditemukan' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Password salah' });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'SECRET_KEY',
      { expiresIn: '1h' }
    );
    res.json({ token });
  });

  // ✅ Todos (proteksi pakai authMiddleware)
  api.get('/todos', authMiddleware, async (req, res) => {
    res.json(await store.listByUser(req.user.id));
  });

  api.post('/todos', authMiddleware, async (req, res) => {
    const title = (req.body.title || '').toString().trim();
    if (!title || title.length > 200) {
      return res.status(400).json({ error: 'title wajib (1-200 karakter)' });
    }
    res.status(201).json(await store.add(title, req.user.id));
  });

  api.patch('/todos/:id', authMiddleware, async (req, res) => {
    const t = await store.toggle(Number(req.params.id), req.user.id);
    return t ? res.json(t) : res.status(404).json({ error: 'tidak ditemukan' });
  });

  api.delete('/todos/:id', authMiddleware, async (req, res) => {
    await store.remove(Number(req.params.id), req.user.id);
    res.status(204).end();
  });

  app.use('/api', api);

  // Error handler
  app.use((err, _req, res, _next) => {
    console.error(JSON.stringify({ level: 'error', msg: err.message }));
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}

module.exports = { createApp };
