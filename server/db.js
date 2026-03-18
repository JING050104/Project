const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL + "?sslmode=no-verify", 
  ssl: {
    rejectUnauthorized: false
  }
});

// db.js 建议改为：
module.exports = {
  pool: pool,
  query: (sql, params) => {
    const pgSql = sql.replace(/\?/g, ($, i) => `$${i + 1}`);
    return pool.query(pgSql, params); // 直接返回 pool 的 Promise
  },
  execute: (sql, params) => {
    const pgSql = sql.replace(/\?/g, ($, i) => `$${i + 1}`);
    return pool.query(pgSql, params);
  }
};