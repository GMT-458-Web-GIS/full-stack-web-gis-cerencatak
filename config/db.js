const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',         
  host: 'localhost',
  database: 'student_save_db',
  password: 'postgres',  
  port: 5432,
});

module.exports = pool;
