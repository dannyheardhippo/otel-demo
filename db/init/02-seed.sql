-- Seed data: a small coffee-shop catalogue and a handful of customers.

INSERT INTO products (name, category, price_cents, stock) VALUES
  ('House Blend Beans 250g',     'beans',     1250, 40),
  ('Single Origin Ethiopia 250g','beans',     1650, 25),
  ('Decaf Colombia 250g',        'beans',     1450, 30),
  ('Espresso Cup Set (2)',       'equipment', 1800, 15),
  ('Pour-Over Dripper',          'equipment', 2200, 12),
  ('Stainless Milk Frother',     'equipment', 1500, 20),
  ('Chemex 6-Cup',               'equipment', 4200, 8),
  ('Burr Grinder',               'equipment', 8900, 6),
  ('Oat Milk Creamer 1L',        'extras',     350, 60),
  ('Vanilla Syrup 250ml',        'extras',     650, 45),
  ('Reusable Cup 12oz',          'extras',    1200, 35),
  ('Coffee Tasting Notebook',    'extras',     900, 18);

INSERT INTO customers (name, email) VALUES
  ('Ada Lovelace',    'ada@example.com'),
  ('Grace Hopper',    'grace@example.com'),
  ('Alan Turing',     'alan@example.com'),
  ('Katherine Johnson','katherine@example.com'),
  ('Tim Berners-Lee', 'tim@example.com');
