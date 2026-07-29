import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const databaseUrl =
  process.env.DATABASE_URL || "postgresql://postgres:1234@localhost:5432/postgres";

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  const files = [
    "schema.sql",
    "seed_diagnosis.sql",
    "alter_job_category_recommendations.sql",
  ];

  await client.connect();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(__dirname, "..", "db", file), "utf8");
    await client.query(sql);
    console.log(`applied ${file}`);
  }

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
