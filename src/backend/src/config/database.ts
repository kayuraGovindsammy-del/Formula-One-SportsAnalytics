import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (pool) {
    return pool;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL error:", error);
  });

  return pool;
}