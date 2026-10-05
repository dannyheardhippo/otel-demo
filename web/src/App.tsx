import { useEffect, useState } from 'react';
import './App.css';
import { api, CUSTOMERS, type Order, type Product } from './api';
import { log, recordCartAdd, tracer } from './otel';

const GRAFANA_URL = 'http://localhost:3000';

interface CartLine {
  product: Product;
  qty: number;
}

interface TraceInfo {
  label: string;
  traceId: string;
  ok: boolean;
  at: number;
}

/** Wrap an async UI action in a span, and surface the resulting trace ID. */
function useTracedAction(onTrace: (info: TraceInfo) => void) {
  return function runTraced<T>(label: string, fn: () => Promise<T>): Promise<T> {
    return tracer.startActiveSpan(`ui.${label}`, async (span) => {
      const traceId = span.spanContext().traceId;
      try {
        const result = await fn();
        onTrace({ label, traceId, ok: true, at: Date.now() });
        return result;
      } catch (err) {
        span.recordException(err as Error);
        onTrace({ label, traceId, ok: false, at: Date.now() });
        log.error(`${label} failed`, { 'error.message': (err as Error).message });
        throw err;
      } finally {
        span.end();
      }
    });
  };
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState(CUSTOMERS[0].id);
  const [cardNumber, setCardNumber] = useState('4111 1111 1111 1111');
  const [orders, setOrders] = useState<Order[]>([]);
  const [traces, setTraces] = useState<TraceInfo[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pushTrace = (info: TraceInfo) =>
    setTraces((prev) => [info, ...prev].slice(0, 8));
  const runTraced = useTracedAction(pushTrace);

  useEffect(() => {
    runTraced('load_products', () => api.products())
      .then(setProducts)
      .catch((err) => setError(String(err)))
      .finally(() => setLoadingProducts(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addToCart(product: Product) {
    recordCartAdd();
    setCart((prev) => {
      const existing = prev.find((line) => line.product.id === product.id);
      if (existing) {
        return prev.map((line) =>
          line.product.id === product.id ? { ...line, qty: line.qty + 1 } : line,
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  }

  function removeFromCart(productId: number) {
    setCart((prev) => prev.filter((line) => line.product.id !== productId));
  }

  const totalCents = cart.reduce(
    (sum, line) => sum + line.product.price_cents * line.qty,
    0,
  );

  async function checkout() {
    if (cart.length === 0) return;
    setCheckingOut(true);
    setError(null);
    try {
      await runTraced('checkout', () =>
        api.createOrder({
          customerId,
          items: cart.map((line) => ({ productId: line.product.id, qty: line.qty })),
          cardNumber,
        }),
      );
      log.info('Order placed from UI', { 'customer.id': customerId });
      setCart([]);
      await loadOrders();
    } catch (err) {
      setError(String(err));
    } finally {
      setCheckingOut(false);
    }
  }

  async function loadOrders() {
    try {
      const result = await runTraced('load_orders', () =>
        api.ordersForCustomer(customerId),
      );
      setOrders(result);
    } catch (err) {
      setError(String(err));
    }
  }

  async function chaos(action: 'slow' | 'error' | 'random') {
    setError(null);
    try {
      if (action === 'slow') await runTraced('chaos_slow', () => api.chaosSlow(1500));
      if (action === 'error') await runTraced('chaos_error', () => api.chaosError());
      if (action === 'random') await runTraced('chaos_random', () => api.chaosRandom());
    } catch (err) {
      setError(String(err));
    }
  }

  async function burst() {
    setError(null);
    await Promise.allSettled(
      Array.from({ length: 50 }, () => runTraced('chaos_burst', () => api.chaosRandom())),
    );
  }

  return (
    <div className="page">
      <header>
        <h1>☕ OTel Coffee Shop</h1>
        <p className="subtitle">
          A 3-tier demo app (React → NestJS → Postgres) fully instrumented with
          OpenTelemetry. Grafana:{' '}
          <a href={GRAFANA_URL} target="_blank" rel="noreferrer">
            {GRAFANA_URL}
          </a>
        </p>
      </header>

      {error && <div className="banner error">{error}</div>}

      <section>
        <h2>Products</h2>
        {loadingProducts ? (
          <p>Loading…</p>
        ) : (
          <div className="grid">
            {products.map((p) => (
              <div className="card" key={p.id}>
                <div className="card-title">{p.name}</div>
                <div className="card-meta">
                  {p.category} · £{(p.price_cents / 100).toFixed(2)} · stock {p.stock}
                </div>
                <button onClick={() => addToCart(p)} disabled={p.stock === 0}>
                  Add to cart
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="two-col">
        <div>
          <h2>Cart</h2>
          <label>
            Customer{' '}
            <select
              value={customerId}
              onChange={(e) => setCustomerId(Number(e.target.value))}
            >
              {CUSTOMERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="card-field">
            Card number{' '}
            <input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
          </label>

          {cart.length === 0 ? (
            <p>Cart is empty.</p>
          ) : (
            <ul className="cart-list">
              {cart.map((line) => (
                <li key={line.product.id}>
                  {line.product.name} × {line.qty} —{' '}
                  £{((line.product.price_cents * line.qty) / 100).toFixed(2)}{' '}
                  <button onClick={() => removeFromCart(line.product.id)}>✕</button>
                </li>
              ))}
            </ul>
          )}
          <p>
            <strong>Total: £{(totalCents / 100).toFixed(2)}</strong>
          </p>
          <button disabled={cart.length === 0 || checkingOut} onClick={checkout}>
            {checkingOut ? 'Placing order…' : 'Checkout'}
          </button>
        </div>

        <div>
          <h2>My orders</h2>
          <p className="hint">Triggers a deliberate N+1 query pattern server-side.</p>
          <button onClick={loadOrders}>Refresh orders</button>
          <ul className="order-list">
            {orders.map((o) => (
              <li key={o.id}>
                Order #{o.id} — £{(o.total_cents / 100).toFixed(2)} — {o.items.length}{' '}
                item(s) — {o.status}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <h2>Chaos panel</h2>
        <p className="hint">Good raw material for tail sampling and error dashboards.</p>
        <div className="chaos-buttons">
          <button onClick={() => chaos('slow')}>Slow request (1.5s)</button>
          <button onClick={() => chaos('error')}>Guaranteed error</button>
          <button onClick={() => chaos('random')}>Random (×1)</button>
          <button onClick={burst}>Burst ×50</button>
        </div>
      </section>

      <section>
        <h2>Recent traces</h2>
        <p className="hint">
          Open Grafana → Explore → Tempo → search by Trace ID to see any of these.
        </p>
        <ul className="trace-list">
          {traces.map((t) => (
            <li key={`${t.traceId}-${t.at}`} className={t.ok ? 'ok' : 'fail'}>
              <code>{t.traceId}</code> — {t.label} — {t.ok ? 'ok' : 'error'}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
