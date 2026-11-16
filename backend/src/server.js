import http from 'http';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import app from './app.js';
import { initSocket } from './sockets/index.js';

async function bootstrap() {
  await connectDB();

  const server = http.createServer(app);
  const io = initSocket(server);

  server.listen(env.port, () => {
    console.log(`[server] http://localhost:${env.port} (${env.nodeEnv}) — Socket.IO aktif`);
  });

  const shutdown = (signal) => {
    console.log(`[server] ${signal} alındı, kapatılıyor...`);
    io.close();
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (err) => {
    console.error('[server] unhandledRejection:', err);
    shutdown('unhandledRejection');
  });
}

bootstrap().catch((err) => {
  console.error('[server] Başlatılamadı:', err);
  process.exit(1);
});
