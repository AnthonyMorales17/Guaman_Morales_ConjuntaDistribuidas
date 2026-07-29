export const config = {
  port: parseInt(process.env.PORT || process.env.AUDIT_PORT || '3002', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:qwerty123@localhost:5432/audit_db',
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
  exchange: process.env.RABBITMQ_EXCHANGE || 'audit.events',
  queue: process.env.RABBITMQ_QUEUE || 'audit.queue',
  corsOrigins: process.env.CORS_ORIGINS || '*',
};
