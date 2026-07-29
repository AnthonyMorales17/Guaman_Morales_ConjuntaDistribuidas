import express from 'express';
import cors from 'cors';
import { config } from './config';
import { runMigrations } from './db/migrations';
import { startConsumer } from './rabbitmq/consumer';
import auditRoutes from './routes/audit.routes';
import healthRoutes from './routes/health.routes';

const app = express();

app.use(cors({ origin: config.corsOrigins === '*' ? true : config.corsOrigins.split(',') }));
app.use(express.json());

// Routes — mounted at / because Ingress rewrites /api/audit/* → /*
app.use('/', auditRoutes);
app.use('/health', healthRoutes);

async function bootstrap() {
  try {
    await runMigrations();
    console.log('[boot] Database migrations complete');
  } catch (err) {
    console.error('[boot] Failed to run migrations:', err);
    process.exit(1);
  }

  startConsumer().catch((err) => {
    console.error('[boot] RabbitMQ consumer failed to start:', err);
  });

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`[boot] Audit service running on port ${config.port}`);
  });
}

bootstrap();
