import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface Product {
  id: number;
  name: string;
  category: string;
  price_cents: number;
  stock: number;
}

@Injectable()
export class ProductsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findAll(): Promise<Product[]> {
    const { rows } = await this.pool.query<Product>(
      'SELECT id, name, category, price_cents, stock FROM products ORDER BY id',
    );
    return rows;
  }

  async findOne(id: number): Promise<Product | null> {
    const { rows } = await this.pool.query<Product>(
      'SELECT id, name, category, price_cents, stock FROM products WHERE id = $1',
      [id],
    );
    return rows[0] ?? null;
  }

  /** Used by the observable stock gauge in OrdersService. */
  async stockLevels(): Promise<{ name: string; stock: number }[]> {
    const { rows } = await this.pool.query<{ name: string; stock: number }>(
      'SELECT name, stock FROM products ORDER BY id',
    );
    return rows;
  }
}
