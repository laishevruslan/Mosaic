import { createClient, type RedisClientType } from 'redis';

import type { RedisPort } from '../../domain/ports.js';

export class RedisClientPort implements RedisPort {
  constructor(private readonly client: RedisClientType) {}

  async ping(): Promise<boolean> {
    const reply = await this.client.ping();
    return reply === 'PONG';
  }

  async close(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }

  async duplicate(): Promise<RedisPort> {
    const copy = this.client.duplicate();
    await copy.connect();
    return new RedisClientPort(copy);
  }

  raw(): RedisClientType {
    return this.client;
  }
}

export async function connectRedis(url: string): Promise<RedisPort> {
  const client = createClient({
    url,
    socket: { connectTimeout: 1_000 },
  });
  await client.connect();
  return new RedisClientPort(client as RedisClientType);
}
