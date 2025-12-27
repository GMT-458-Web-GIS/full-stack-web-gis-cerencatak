const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',          // Kendi kullanıcı adın
  host: 'localhost',
  database: 'student_save_db',
  password: 'postgres',  // pgAdmin şifren
  port: 5432,
});

module.exports = pool;
