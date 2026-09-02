import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv(path.join(__dirname, "..", ".env"));

const args = parseArgs(process.argv.slice(2));
const provider = args.provider;
const email = args.email;
const providerUserId = args["provider-user-id"];

if (!provider || !["kakao", "naver"].includes(provider)) {
  fail("Usage: node scripts/reset-oauth-reward-state.mjs --provider kakao|naver [--email user@example.com] [--provider-user-id id]");
}

if (!email && !providerUserId) {
  fail("Provide --email or --provider-user-id so the reset can target one OAuth identity.");
}

const databaseUrl =
  process.env.DATABASE_URL || "postgresql://postgres:1234@localhost:5432/postgres";

const hashes = new Set();
if (providerUserId) hashes.add(hashOAuthIdentity(provider, providerUserId));
if (email) hashes.add(hashOAuthIdentity(provider, email.toLowerCase()));

const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query("BEGIN");

  const hashValues = [...hashes];
  const users = await client.query(
    `
      SELECT DISTINCT users.id
      FROM public.users users
      LEFT JOIN public.user_oauth_accounts accounts
        ON accounts.user_id = users.id
      WHERE ($1::text IS NOT NULL AND lower(users.email) = lower($1))
         OR ($2::public.oauth_provider IS NOT NULL AND accounts.provider = $2::public.oauth_provider AND accounts.provider_email IS NOT NULL AND lower(accounts.provider_email) = lower($1))
         OR ($3::text IS NOT NULL AND accounts.provider = $2::public.oauth_provider AND accounts.provider_user_id = $3)
    `,
    [email || null, provider, providerUserId || null],
  );

  const userIds = users.rows.map((row) => row.id);

  const grants = await client.query(
    `
      DELETE FROM public.oauth_identity_reward_grants grants
      WHERE grants.provider = $1::public.oauth_provider
        AND (
          grants.provider_user_id_hash = ANY($2::text[])
          OR grants.user_id = ANY($3::uuid[])
        )
      RETURNING reward_key
    `,
    [provider, hashValues, userIds],
  );

  const withdrawn = await client.query(
    `
      DELETE FROM public.withdrawn_oauth_identities identities
      WHERE identities.provider = $1::public.oauth_provider
        AND (
          identities.provider_user_id_hash = ANY($2::text[])
          OR identities.provider_email_hash = ANY($2::text[])
          OR identities.withdrawn_user_id = ANY($3::uuid[])
        )
      RETURNING withdrawal_count
    `,
    [provider, hashValues, userIds],
  );

  await client.query("COMMIT");

  console.log(
    JSON.stringify(
      {
        provider,
        email: email ? maskEmail(email) : undefined,
        matchedUsers: userIds.length,
        deletedRewardGrants: grants.rowCount,
        deletedWithdrawnIdentities: withdrawn.rowCount,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end().catch(() => {});
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return;

  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/);
    if (!match) continue;

    const key = match[1].trim();
    const value = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;

    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }

    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function hashOAuthIdentity(providerValue, providerUserIdValue) {
  const secret =
    process.env.OAUTH_IDENTITY_HASH_SECRET ||
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY ||
    "gongbu-eong-dev-oauth-identity";

  return crypto
    .createHmac("sha256", secret)
    .update(`${providerValue}:${providerUserIdValue}`)
    .digest("hex");
}

function maskEmail(value) {
  const [name, domain] = value.split("@");
  if (!domain) return "***";
  return `${name.slice(0, 2)}***@${domain}`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
