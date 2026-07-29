import { Router, Request, Response } from 'express';
import { checkDbConnection } from '../db/connection';
import { isRabbitConnected } from '../rabbitmq/consumer';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const dbOk = await checkDbConnection();
  const rabbitOk = isRabbitConnected();

  const status = dbOk && rabbitOk ? 'ok' : 'degraded';

  res.status(dbOk ? 200 : 503).json({
    status,
    db: dbOk ? 'up' : 'down',
    rabbitmq: rabbitOk ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

export default router;
