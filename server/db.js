// db.js 修正版
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL + "?sslmode=no-verify", 
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = {
  pool: pool,
  query: (sql, params) => {
    const pgSql = sql.replace(/\?/g, ($, i) => `$${i + 1}`);
    return pool.query(pgSql, params).then(res => [res.rows]);
  },
  execute: (sql, params) => {
    const pgSql = sql.replace(/\?/g, ($, i) => `$${i + 1}`);
    return pool.query(pgSql, params).then(res => [res.rows]);
  }
};