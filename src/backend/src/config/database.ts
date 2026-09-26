import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | undefined;

function getDatabaseCaCertificate(): string {
  // Aiven for PostgreSQL requires TLS and is signed by its own project CA, so
  // the pool needs that CA rather than the system trust store. In deployed
  // environments (Railway) it is supplied as DATABASE_CA_CERT: the ca.pem
  // contents on one line, newlines escaped as \n, unescaped here.
  if (process.env.DATABASE_CA_CERT) {
    return process.env.DATABASE_CA_CERT.replace(/\\n/g, "\n");
  }

  // Local development fallback: the ca.pem downloaded from the Aiven console,
  // saved to certs/ca.pem under the working directory (src/backend/certs/ca.pem
  // when the backend is run from src/backend, as the README describes).
  const localCertificatePath = path.resolve(
    process.cwd(),
    "certs",
    "ca.pem"
  );

  if (fs.existsSync(localCertificatePath)) {
    return fs.readFileSync(localCertificatePath, "utf8");
  }

  throw new Error(
    "Database CA certificate is not configured. Set DATABASE_CA_CERT or provide certs/ca.pem."
  );
}

export function getPool(): pg.Pool {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: true,
      ca: getDatabaseCaCertificate(),
    },
  });

  pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error:", error);
  });

  return pool;
}