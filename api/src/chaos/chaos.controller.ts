import {
  Controller,
  Get,
  Inject,
  InternalServerErrorException,
  Logger,
  Query,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

/** Slow requests, guaranteed errors and a random mix - fodder for tail sampling (scenario 05). */
@Controller('chaos')
export class ChaosController {
  private readonly logger = new Logger(ChaosController.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Get('slow')
  async slow(@Query('ms') ms?: string) {
    const delay = Math.min(Number(ms ?? 1500) || 1500, 10000);
    await this.pool.query('SELECT pg_sleep($1)', [delay / 1000]);
    return { slept_ms: delay };
  }

  @Get('error')
  error(): never {
    this.logger.error('Chaos endpoint deliberately throwing');
    throw new InternalServerErrorException('Chaos: this endpoint always fails');
  }

  @Get('random')
  async random() {
    const delay = Math.random() * 800;
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (Math.random() < 0.2) {
      this.logger.error('Chaos random endpoint rolled a failure');
      throw new InternalServerErrorException('Chaos: random failure');
    }
    return { slept_ms: Math.round(delay) };
  }
}
