import { pool } from './connection';

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_events (
        id          SERIAL PRIMARY KEY,
        entity      VARCHAR(50)  NOT NULL,
        action      VARCHAR(20)  NOT NULL,
        user_id     VARCHAR(255),
        user_email  VARCHAR(255),
        timestamp   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        data        JSONB,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_audit_entity    ON audit_events(entity);
      CREATE INDEX IF NOT EXISTS idx_audit_action    ON audit_events(action);
      CREATE INDEX IF NOT EXISTS idx_audit_user_id   ON audit_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp);
    `);
    console.log('[migrations] audit_events table ready');
  } finally {
    client.release();
  }
}
