import { Pool, QueryResult, QueryResultRow } from "pg";

declare global {
  var postgresPool: Pool | undefined;
}

function createPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  return new Pool({
    host: process.env.DB_HOST ,
    port: Number(process.env.DB_PORT ),
    database: process.env.DB_NAME ,
    user: process.env.DB_USER ,
    password: process.env.DB_PASSWORD,
  });
}

export const db = globalThis.postgresPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalThis.postgresPool = db;
}

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return db.query<T>(text, params);
}
