-- Schema for the "shop" demo database. Kept deliberately simple: plain pg driver, raw SQL, no ORM.

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Needed by the collector's postgresql receiver (scenario 07) to read pg_stat_* views.
GRANT pg_monitor TO demo;

CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
);

CREATE TABLE customers (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE orders (
  id          SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_cents INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'created'
);

CREATE TABLE order_items (
  order_id   INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty        INTEGER NOT NULL CHECK (qty > 0),
  price_cents INTEGER NOT NULL,
  PRIMARY KEY (order_id, product_id)
);

CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
