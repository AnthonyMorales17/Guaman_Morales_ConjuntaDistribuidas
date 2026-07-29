import { Request, Response } from 'express';
import { EventEmitter } from 'events';

const eventBus = new EventEmitter();
eventBus.setMaxListeners(100);

export interface AuditEventPayload {
  id: number;
  entity: string;
  action: string;
  userId: string | null;
  userEmail: string | null;
  timestamp: string;
  data: any;
  createdAt: string;
}

export function emitAuditEvent(event: AuditEventPayload): void {
  eventBus.emit('audit', event);
}

export function sseHandler(req: Request, res: Response): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(':\n\n'); // initial comment to establish connection

  const onAudit = (event: AuditEventPayload) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  eventBus.on('audit', onAudit);

  // Heartbeat every 30s
  const heartbeat = setInterval(() => {
    res.write(':\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.off('audit', onAudit);
  });
}
