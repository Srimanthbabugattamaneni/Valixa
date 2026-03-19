import { Pool } from "pg";

// Reuse the pool across hot-reloads in development
declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function createPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  return new Pool({
    connectionString: process.env.DATABASE_URL,
    min: Number(process.env.DB_POOL_MIN ?? 2),
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });
}

// In development, attach pool to global to survive HMR
const pool: Pool =
  process.env.NODE_ENV === "development"
    ? (globalThis._pgPool ?? (globalThis._pgPool = createPool()))
    : createPool();

export default pool;
