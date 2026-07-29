import { connect, Channel } from 'amqplib';
import { config } from '../config';
import { pool } from '../db/connection';
import { emitAuditEvent } from '../sse/sse.handler';

let connection: any = null;
let channel: Channel | null = null;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 30000;

export function isRabbitConnected(): boolean {
  return channel !== null;
}

export async function startConsumer(): Promise<void> {
  try {
    const conn: any = await connect(config.rabbitmqUrl);
    const ch: Channel = await conn.createChannel();

    await ch.assertExchange(config.exchange, 'topic', { durable: true });
    await ch.assertQueue(config.queue, { durable: true });
    await ch.bindQueue(config.queue, config.exchange, 'audit.#');
    await ch.prefetch(1);

    connection = conn;
    channel = ch;

    console.log('[rabbitmq] Connected and consuming from', config.queue);
    reconnectDelay = 1000;

    ch.consume(config.queue, async (msg) => {
      if (!msg) return;

      try {
        const event = JSON.parse(msg.content.toString());
        const result = await pool.query(
          `INSERT INTO audit_events (entity, action, user_id, user_email, timestamp, data)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            event.entity,
            event.action,
            event.userId || null,
            event.userEmail || null,
            event.timestamp || new Date().toISOString(),
            JSON.stringify(event.data || {}),
          ],
        );

        ch.ack(msg);

        // Emit to SSE clients
        const inserted = result.rows[0];
        emitAuditEvent({
          id: inserted.id,
          entity: inserted.entity,
          action: inserted.action,
          userId: inserted.user_id,
          userEmail: inserted.user_email,
          timestamp: inserted.timestamp,
          data: inserted.data,
          createdAt: inserted.created_at,
        });
      } catch (err) {
        console.error('[rabbitmq] Error processing message:', err);
        ch.nack(msg, false, true); // requeue
      }
    });

    conn.on('error', (err: any) => {
      console.error('[rabbitmq] Connection error:', err.message || err);
    });

    conn.on('close', () => {
      console.warn('[rabbitmq] Connection closed. Reconnecting...');
      channel = null;
      connection = null;
      scheduleReconnect();
    });
  } catch (err) {
    console.warn(`[rabbitmq] Failed to connect: ${(err as Error).message}. Retrying in ${reconnectDelay}ms...`);
    channel = null;
    connection = null;
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  setTimeout(async () => {
    await startConsumer();
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
}
