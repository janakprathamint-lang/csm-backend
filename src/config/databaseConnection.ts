import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";


const DATABASE_URL = process.env.DATABASE_URL;

console.log("DATABASE_URL:", DATABASE_URL);

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL missing");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

// ✅ Drizzle instance (USE THIS IN CONTROLLERS)
export const db = drizzle(pool);

// ✅ Connection health check (startup)
export const checkDbConnection = async () => {
  const result = await pool.query("SELECT current_database()");
  console.log("✅ Connected to DB:", result.rows[0].current_database);
};

export default pool;
