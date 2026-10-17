import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { database } from "./db";

const scrypt = promisify(scryptCallback);

type AccountRow = {
  id: string;
  account_name: string;
  email: string;
  display_name: string;
  password_hash: Buffer;
  password_salt: Buffer;
};

export type PublicAccount = { id: string; account: string; email: string; name: string };

function publicAccount(row: AccountRow): PublicAccount {
  return { id: row.id, account: row.account_name, email: row.email, name: row.display_name };
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function accountName(email: string) {
  const base = normalize(email).split("@")[0]?.replace(/[^a-z0-9._-]/g, "-") || "mirror";
  return `${base.slice(0, 31)}-${randomBytes(4).toString("hex")}`;
}

async function hashPassword(password: string, salt: Buffer) {
  return Buffer.from(await scrypt(password, salt, 64) as ArrayBuffer);
}

export async function registerAccount(input: { name: string; email: string; password: string }) {
  const db = database();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const email = normalize(input.email);
  const salt = randomBytes(24);
  const hash = await hashPassword(input.password, salt);
  const generatedAccountName = accountName(email);
  try {
    const [row] = await db<AccountRow[]>`
      INSERT INTO accounts (account_name, email, display_name, password_hash, password_salt)
      VALUES (
        ${generatedAccountName},
        ${email}, ${input.name.trim()}, ${hash}, ${salt}
      )
      RETURNING id::text, account_name, email, display_name, password_hash, password_salt
    `;
    if (!row) throw new Error("REGISTRATION_FAILED");
    return publicAccount(row);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505") throw new Error("ACCOUNT_EXISTS");
    throw error;
  }
}

export async function authenticateAccount(account: string, password: string) {
  const db = database();
  if (!db) return null;
  const login = normalize(account);
  const [row] = await db<AccountRow[]>`
    SELECT id::text, account_name, email, display_name, password_hash, password_salt
    FROM accounts WHERE lower(email) = ${login} OR lower(account_name) = ${login} LIMIT 1
  `;
  if (!row) return null;
  const supplied = await hashPassword(password, row.password_salt);
  if (supplied.length !== row.password_hash.length || !timingSafeEqual(supplied, row.password_hash)) return null;
  await db`UPDATE accounts SET last_login_at = now(), updated_at = now() WHERE id = ${row.id}::uuid`;
  return publicAccount(row);
}

export async function authenticateAccountById(id: string, password: string) {
  const db = database();
  if (!db || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db<AccountRow[]>`
    SELECT id::text, account_name, email, display_name, password_hash, password_salt
    FROM accounts WHERE id = ${id}::uuid LIMIT 1
  `;
  if (!row) return null;
  const supplied = await hashPassword(password, row.password_salt);
  if (supplied.length !== row.password_hash.length || !timingSafeEqual(supplied, row.password_hash)) return null;
  await db`UPDATE accounts SET last_login_at = now(), updated_at = now() WHERE id = ${row.id}::uuid`;
  return publicAccount(row);
}

export async function listAccountIds() {
  const db = database();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const rows = await db<Array<{ id: string }>>`
    SELECT id::text FROM accounts ORDER BY created_at
  `;
  const ids = new Set(rows.map((row) => row.id));
  const legacyOwner = process.env.MIRROR_USER_ID || "owner";
  ids.add(legacyOwner);
  return [...ids];
}

export async function deleteAccount(id: string, password: string) {
  const db = database();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("ACCOUNT_DELETION_UNAVAILABLE");
  const account = await authenticateAccountById(id, password);
  if (!account) throw new Error("INVALID_PASSWORD");

  await db.begin(async (tx) => {
    const trx = tx as unknown as NonNullable<ReturnType<typeof database>>;
    // Tables without account foreign keys are removed explicitly. Capture-owned
    // rows (tasks, notes, transcripts, audio and financial entries) cascade.
    await trx`DELETE FROM commands WHERE user_id = ${id}`;
    await trx`DELETE FROM external_mappings WHERE user_id = ${id}`;
    await trx`DELETE FROM sync_jobs WHERE user_id = ${id}`;
    await trx`DELETE FROM device_push_tokens WHERE user_id = ${id}`;
    await trx`DELETE FROM coaching_notifications WHERE user_id = ${id}`;
    await trx`DELETE FROM integrations WHERE user_id = ${id}`;
    await trx`DELETE FROM briefings WHERE user_id = ${id}`;
    await trx`DELETE FROM habit_definitions WHERE user_id = ${id}`;
    await trx`DELETE FROM audit_events WHERE user_id = ${id}`;
    await trx`DELETE FROM meetings WHERE user_id = ${id}`;
    await trx`DELETE FROM captures WHERE user_id = ${id}`;
    await trx`DELETE FROM accounts WHERE id = ${id}::uuid`;
  });
}
