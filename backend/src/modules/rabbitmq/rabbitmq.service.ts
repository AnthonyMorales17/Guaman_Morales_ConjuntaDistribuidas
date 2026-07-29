import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, Channel } from 'amqplib';

export interface AuditMessage {
  entity: string;
  action: string;
  userId: string;
  userEmail: string;
  timestamp: string;
  data: {
    before?: any;
    after?: any;
  };
}

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: any = null;
  private channel: Channel | null = null;
  private readonly exchange = 'audit.events';
  private readonly buffer: { routingKey: string; message: Buffer }[] = [];
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30000;
  private isShuttingDown = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection && typeof this.connection.close === 'function') {
        await this.connection.close();
      }
    } catch (err) {
      this.logger.warn('Error closing RabbitMQ connection', err);
    }
  }

  private async connect(): Promise<void> {
    try {
      const url = this.config.get<string>('rabbitmqUrl') || 'amqp://guest:guest@localhost:5672';
      const conn: any = await connect(url);
      const ch: Channel = await conn.createChannel();

      await ch.assertExchange(this.exchange, 'topic', { durable: true });

      conn.on('error', (err: any) => {
        this.logger.error('RabbitMQ connection error', err);
      });

      conn.on('close', () => {
        if (!this.isShuttingDown) {
          this.logger.warn('RabbitMQ connection closed. Reconnecting...');
          this.channel = null;
          this.connection = null;
          this.scheduleReconnect();
        }
      });

      this.connection = conn;
      this.channel = ch;
      this.reconnectDelay = 1000;
      this.logger.log('Connected to RabbitMQ');

      // Flush buffer
      await this.flushBuffer();
    } catch (err) {
      this.logger.warn(`Failed to connect to RabbitMQ: ${(err as Error).message}. Retrying...`);
      this.channel = null;
      this.connection = null;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.isShuttingDown) return;
    this.reconnectTimeout = setTimeout(async () => {
      await this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  private async flushBuffer(): Promise<void> {
    while (this.buffer.length > 0 && this.channel) {
      const item = this.buffer.shift()!;
      try {
        this.channel.publish(this.exchange, item.routingKey, item.message, { persistent: true });
      } catch (err) {
        this.buffer.unshift(item);
        this.logger.warn('Failed to flush buffer message, will retry later');
        break;
      }
    }
    if (this.buffer.length > 0) {
      this.logger.log(`${this.buffer.length} messages still in buffer`);
    }
  }

  async publishAuditEvent(message: AuditMessage): Promise<void> {
    const routingKey = `audit.${message.entity.toLowerCase()}.${message.action.toLowerCase()}`;
    const content = Buffer.from(JSON.stringify(message));

    try {
      if (this.channel) {
        this.channel.publish(this.exchange, routingKey, content, { persistent: true });
      } else {
        this.logger.warn('RabbitMQ not connected. Buffering message.');
        this.buffer.push({ routingKey, message: content });
      }
    } catch (err) {
      this.logger.warn('Failed to publish to RabbitMQ. Buffering message.');
      this.buffer.push({ routingKey, message: content });
    }
  }
}
