/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in .env.local");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const sql: string = fs.readFileSync(
    path.resolve(__dirname, "../lib/schema.sql"),
    "utf-8"
  );

  console.log("Applying schema…");
  await pool.query(sql);
  console.log("✓ Schema applied successfully.");

  await pool.end();
}

migrate().catch((err: Error) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
