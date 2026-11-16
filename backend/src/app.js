import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';

const app = express();

app.set('trust proxy', 1); // Nginx / load balancer arkasında doğru IP (rate limit için)
app.disable('x-powered-by');

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })); // görseller frontend'den yüklenebilsin
app.use(cors({ origin: env.clientUrls, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false })); // İyzico callback (form-post) için - Adım 3
app.use(morgan(env.isProd ? 'combined' : 'dev'));

app.use('/uploads', express.static(path.resolve(env.uploadDir), { maxAge: '7d', index: false }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'up' : 'down', uptime: Math.round(process.uptime()) });
});

app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
