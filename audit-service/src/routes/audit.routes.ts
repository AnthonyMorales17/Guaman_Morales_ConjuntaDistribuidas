import { Router, Request, Response } from 'express';
import { pool } from '../db/connection';
import { sseHandler } from '../sse/sse.handler';

const router = Router();

// GET /api/audit — paginated list with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (req.query.entity) {
      conditions.push(`entity = $${paramIdx++}`);
      params.push(req.query.entity);
    }
    if (req.query.action) {
      conditions.push(`action = $${paramIdx++}`);
      params.push(req.query.action);
    }
    if (req.query.userId) {
      conditions.push(`(user_id = $${paramIdx} OR user_email ILIKE $${paramIdx})`);
      params.push(req.query.userId);
      paramIdx++;
    }
    if (req.query.from) {
      conditions.push(`timestamp >= $${paramIdx++}`);
      params.push(req.query.from);
    }
    if (req.query.to) {
      conditions.push(`timestamp <= $${paramIdx++}`);
      params.push(req.query.to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM audit_events ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await pool.query(
      `SELECT id, entity, action, user_id, user_email, timestamp, data, created_at
       FROM audit_events ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, pageSize, offset],
    );

    const items = dataResult.rows.map((row) => ({
      id: row.id,
      entity: row.entity,
      action: row.action,
      userId: row.user_id,
      userEmail: row.user_email,
      timestamp: row.timestamp,
      data: row.data,
      createdAt: row.created_at,
    }));

    res.json({ items, total, page, pageSize });
  } catch (err) {
    console.error('[audit] Error querying events:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/audit/stream — SSE endpoint
router.get('/stream', sseHandler);

// GET /api/audit/:id — single event detail
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM audit_events WHERE id = $1',
      [req.params.id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    const row = result.rows[0];
    res.json({
      id: row.id,
      entity: row.entity,
      action: row.action,
      userId: row.user_id,
      userEmail: row.user_email,
      timestamp: row.timestamp,
      data: row.data,
      createdAt: row.created_at,
    });
  } catch (err) {
    console.error('[audit] Error fetching event:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
