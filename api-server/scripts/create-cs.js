const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const pool = new Pool({ connectionString: 'postgresql://postgres@localhost:5432/v_poker' });

async function createCS() {
  const exist = await pool.query("SELECT id, account, role FROM users WHERE account='cs01' AND deleted_at IS NULL");
  if (exist.rows.length > 0) {
    console.log('cs01已存在:', JSON.stringify(exist.rows[0]));
  } else {
    const hash = await bcrypt.hash('cs123456', 8);
    const inv = 'CS' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const insert = await pool.query(
      "INSERT INTO users (account, password, security_code, nickname, role, invite_code, points, vault_points, frozen, cs_status, created_at) VALUES ($1,$2,'888888',$3,'customer_service',$4,0,0,false,'offline',NOW()) RETURNING id, account, role, invite_code",
      ['cs01', hash, '客服小美', inv]
    );
    console.log('客服创建成功:', JSON.stringify(insert.rows[0]));
  }
  pool.end();
}
createCS().catch(e => { console.error('ERROR:', e.message); pool.end(); });
