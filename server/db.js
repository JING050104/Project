const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL + "?sslmode=no-verify", 
  ssl: {
    rejectUnauthorized: false
  }
});

// 統一封裝，讓所有查詢都返回乾淨的 rows 陣列
module.exports = {
  pool,

  // query 和 execute 現在都返回乾淨的 rows（不再包兩層陣列）
  query: async (sql, params = []) => {
    const client = await pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows;           // ← 直接返回 rows
    } finally {
      client.release();
    }
  },

  execute: async (sql, params = []) => {
    const client = await pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows;           // ← 直接返回 rows
    } finally {
      client.release();
    }
  }
};