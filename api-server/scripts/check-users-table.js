const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres@localhost:5432/v_poker' });

async function main() {
  const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position");
  console.log('users表字段:');
  cols.rows.forEach(c => console.log('  ' + c.column_name + ' (' + c.data_type + ')'));
  
  // 看一个现有用户的完整数据
  const sample = await pool.query("SELECT * FROM users WHERE account='admin'");
  console.log('\nadmin用户数据:');
  console.log(JSON.stringify(sample.rows[0], null, 2));
  pool.end();
}
main().catch(e => { console.error('ERROR:', e.message); pool.end(); });
