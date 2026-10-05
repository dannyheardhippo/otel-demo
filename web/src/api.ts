export interface Product {
  id: number;
  name: string;
  category: string;
  price_cents: number;
  stock: number;
}

export interface OrderItem {
  order_id: number;
  product_id: number;
  qty: number;
  price_cents: number;
}

export interface Order {
  id: number;
  customer_id: number;
  created_at: string;
  total_cents: number;
  status: string;
  items: OrderItem[];
}

export interface Customer {
  id: number;
  name: string;
}

// Seeded in db/init/02-seed.sql.
export const CUSTOMERS: Customer[] = [
  { id: 1, name: 'Ada Lovelace' },
  { id: 2, name: 'Grace Hopper' },
  { id: 3, name: 'Alan Turing' },
  { id: 4, name: 'Katherine Johnson' },
  { id: 5, name: 'Tim Berners-Lee' },
];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${init?.method ?? 'GET'} ${path} -> ${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  products: () => request<Product[]>('/products'),
  ordersForCustomer: (customerId: number) =>
    request<Order[]>(`/orders?customerId=${customerId}`),
  createOrder: (dto: {
    customerId: number;
    items: { productId: number; qty: number }[];
    cardNumber: string;
  }) => request<Order>('/orders', { method: 'POST', body: JSON.stringify(dto) }),
  chaosSlow: (ms: number) => request<{ slept_ms: number }>(`/chaos/slow?ms=${ms}`),
  chaosError: () => request<never>('/chaos/error'),
  chaosRandom: () => request<{ slept_ms: number }>('/chaos/random'),
};
