import { Pool, QueryResult, QueryResultRow } from "pg";

declare global {
  var postgresPool: Pool | undefined;
}

const appName = process.env.APP_NAME || "gongbu-eong-backend";
const dbSchema = process.env.DB_SCHEMA || "public";

function shouldUseSslByDefault(connectionString?: string) {
  return (
    process.env.NODE_ENV === "production" ||
    connectionString?.includes("supabase.co") ||
    connectionString?.includes("sslmode=require")
  );
}

function getSslConfig(connectionString?: string) {
  const sslMode = (process.env.DB_SSLMODE || process.env.PGSSLMODE || "")
    .trim()
    .toLowerCase();

  if (["disable", "false", "off"].includes(sslMode)) {
    return undefined;
  }

  if (["require", "true", "on", "prefer"].includes(sslMode)) {
    return { rejectUnauthorized: false };
  }

  return shouldUseSslByDefault(connectionString)
    ? { rejectUnauthorized: false }
    : undefined;
}

function createPool() {
  if (process.env.DATABASE_URL) {
    const connectionString = process.env.DATABASE_URL;

    return new Pool({
      connectionString,
      application_name: appName,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      max: 5,
      ssl: getSslConfig(connectionString),
    });
  }

  return new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    application_name: appName,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    max: 5,
    ssl: getSslConfig(),
  });
}

export const db = globalThis.postgresPool ?? createPool();

db.on("connect", (client) => {
  void client.query("SELECT set_config('search_path', $1, false)", [dbSchema]);
  void client.query("SELECT set_config('application_name', $1, false)", [
    appName,
  ]);
});

if (process.env.NODE_ENV !== "production") {
  globalThis.postgresPool = db;
}

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return db.query<T>(text, params);
}
