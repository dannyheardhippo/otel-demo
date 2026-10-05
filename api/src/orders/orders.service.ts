import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { metrics, trace, SpanStatusCode } from '@opentelemetry/api';
import { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../database/database.module';
import { ProductsService } from '../products/products.service';
import { CreateOrderDto } from './dto/create-order.dto';

const tracer = trace.getTracer('api.orders');
const meter = metrics.getMeter('api.orders');

const ordersCreated = meter.createCounter('shop.orders.created', {
  description: 'Number of orders created, by outcome',
});
const orderValue = meter.createHistogram('shop.order.value', {
  description: 'Value of a created order',
  unit: '{cents}',
});
const ordersInFlight = meter.createUpDownCounter('shop.orders.in_flight', {
  description: 'Checkouts currently being processed',
});

export interface OrderRow {
  id: number;
  customer_id: number;
  created_at: string;
  total_cents: number;
  status: string;
}

export interface OrderItemRow {
  order_id: number;
  product_id: number;
  qty: number;
  price_cents: number;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    products: ProductsService,
  ) {
    // Observable gauge: sampled on metrics export, not on the request path.
    meter
      .createObservableGauge('shop.product.stock', {
        description: 'Current stock level per product',
        unit: '{items}',
      })
      .addCallback(async (result) => {
        const levels = await products.stockLevels();
        for (const { name, stock } of levels) {
          result.observe(stock, { 'product.name': name });
        }
      });
  }

  async findAllForCustomer(customerId: number): Promise<
    (OrderRow & { items: OrderItemRow[] })[]
  > {
    const { rows: orders } = await this.pool.query<OrderRow>(
      'SELECT id, customer_id, created_at, total_cents, status FROM orders WHERE customer_id = $1 ORDER BY id',
      [customerId],
    );

    // Deliberate N+1: one query per order instead of a single JOIN/IN query.
    const withItems = [];
    for (const order of orders) {
      const { rows: items } = await this.pool.query<OrderItemRow>(
        'SELECT order_id, product_id, qty, price_cents FROM order_items WHERE order_id = $1',
        [order.id],
      );
      withItems.push({ ...order, items });
    }
    return withItems;
  }

  async findOne(id: number): Promise<(OrderRow & { items: OrderItemRow[] }) | null> {
    const { rows } = await this.pool.query<OrderRow>(
      'SELECT id, customer_id, created_at, total_cents, status FROM orders WHERE id = $1',
      [id],
    );
    const order = rows[0];
    if (!order) return null;
    const { rows: items } = await this.pool.query<OrderItemRow>(
      'SELECT order_id, product_id, qty, price_cents FROM order_items WHERE order_id = $1',
      [id],
    );
    return { ...order, items };
  }

  async create(dto: CreateOrderDto): Promise<OrderRow> {
    ordersInFlight.add(1);
    const client = await this.pool.connect();
    try {
      const order = await tracer.startActiveSpan(
        'checkout.calculate_total',
        async (span) => {
          try {
            const { rows: customerRows } = await client.query<{
              email: string;
            }>('SELECT email FROM customers WHERE id = $1', [dto.customerId]);
            const email = customerRows[0]?.email;

            // Deliberately sensitive attributes, masked/redacted by the collector in scenario 03.
            span.setAttribute('customer.email', email ?? 'unknown');
            span.setAttribute('payment.card_number', dto.cardNumber);
            span.setAttribute('order.item_count', dto.items.length);

            await client.query('BEGIN');

            let totalCents = 0;
            const priced: { productId: number; qty: number; price: number }[] =
              [];

            for (const item of dto.items) {
              const { rows } = await client.query<{
                price_cents: number;
                stock: number;
              }>('SELECT price_cents, stock FROM products WHERE id = $1 FOR UPDATE', [
                item.productId,
              ]);
              const product = rows[0];
              if (!product) {
                throw new NotFoundException(
                  `Product ${item.productId} not found`,
                );
              }
              if (product.stock < item.qty) {
                throw new Error(
                  `Insufficient stock for product ${item.productId}`,
                );
              }
              priced.push({
                productId: item.productId,
                qty: item.qty,
                price: product.price_cents,
              });
              totalCents += product.price_cents * item.qty;
            }

            const { rows: orderRows } = await client.query<OrderRow>(
              `INSERT INTO orders (customer_id, total_cents, status)
               VALUES ($1, $2, 'created')
               RETURNING id, customer_id, created_at, total_cents, status`,
              [dto.customerId, totalCents],
            );
            const order = orderRows[0];

            for (const item of priced) {
              await client.query(
                'INSERT INTO order_items (order_id, product_id, qty, price_cents) VALUES ($1, $2, $3, $4)',
                [order.id, item.productId, item.qty, item.price],
              );
              await client.query(
                'UPDATE products SET stock = stock - $1 WHERE id = $2',
                [item.qty, item.productId],
              );
            }

            span.addEvent('stock.reserved');
            span.setAttribute('order.total_cents', totalCents);

            await client.query('COMMIT');

            this.logger.log(
              `Order ${order.id} created for ${email} (total ${totalCents} cents)`,
            );

            ordersCreated.add(1, { status: 'created' });
            orderValue.record(totalCents);

            return order;
          } catch (err) {
            await client.query('ROLLBACK');
            span.recordException(err as Error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: (err as Error).message,
            });
            ordersCreated.add(1, { status: 'failed' });
            throw err;
          } finally {
            span.end();
          }
        },
      );
      return order;
    } finally {
      client.release();
      ordersInFlight.add(-1);
    }
  }
}
