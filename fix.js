const { Client } = require('pg');

const url = 'postgresql://postgres:ZeMFcmDbyRZiOsKfwAuaMshuFhrQxOvP@thomas.proxy.rlwy.net:56018/railway';

const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

async function fix() {
  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL');
    
    // Agregar columna sede_id a partidos
    await client.query(`ALTER TABLE partidos ADD COLUMN IF NOT EXISTS sede_id INTEGER DEFAULT 1`);
    console.log('✅ Columna sede_id agregada a partidos');
    
    // Actualizar partidos existentes
    await client.query(`UPDATE partidos SET sede_id = 1 WHERE sede_id IS NULL`);
    console.log('✅ Partidos actualizados con sede_id = 1');
    
    // Verificar que la columna existe
    const res = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'partidos'`);
    console.log('📋 Columnas en partidos:', res.rows.map(r => r.column_name).join(', '));
    
    await client.end();
    console.log('✅ Listo. Ahora reinicia el servicio en Railway');
  } catch (err) {
    console.error('❌ Error:', err.message);
    await client.end();
  }
}

fix();