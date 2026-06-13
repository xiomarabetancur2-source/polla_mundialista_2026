'use strict';

/**
 * restore.js — Restaura los datos del backup de producción
 *
 * Uso en Railway Console:
 *   node restore.js
 *
 * Es idempotente: usa ON CONFLICT DO UPDATE para no duplicar.
 */

const { Pool } = require('pg');

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host:     process.env.PGHOST     || 'localhost',
        database: process.env.PGDATABASE || 'mundialito',
        user:     process.env.PGUSER     || 'postgres',
        password: process.env.PGPASSWORD || '',
        port:     parseInt(process.env.PGPORT || '5432'),
        ssl:      false
      }
);

// Mapeo IDs viejos (1-36) → nuevos (1-72)
const PARTIDO_MAPPING = {
  1:1,  2:2,  3:25, 4:28, 5:53, 6:54,
  7:3,  8:5,  9:26, 10:27, 11:49, 12:50,
  13:6, 14:7, 15:30, 16:31, 17:51, 18:52,
  19:4, 20:8, 21:29, 22:32, 23:59, 24:60,
  25:9, 26:10, 27:34, 28:35, 29:56, 30:55,
  31:11, 32:12, 33:33, 34:36, 35:58, 36:57
};

// ── Datos del backup ──────────────────────────────────────────────────────────

const EQUIPOS = [
  { id: 1,  nombre: 'Las Romperredes',        pin: '1111' },
  { id: 2,  nombre: 'Titanes FC',             pin: '2222' },
  { id: 3,  nombre: 'Los Elegidos',           pin: '3333' },
  { id: 4,  nombre: 'Los Alcones',            pin: '4444' },
  { id: 5,  nombre: 'El Combo',               pin: '5555' },
  { id: 6,  nombre: 'Furia del Gol',          pin: '6666' },
  { id: 7,  nombre: 'Aficionadas VIP',        pin: '7777' },
  { id: 8,  nombre: 'Golden Team',            pin: '8888' },
  { id: 9,  nombre: 'Los Dueños del Mundial', pin: '9999' },
  { id: 10, nombre: 'Fenix FC',               pin: '0000' },
];

// Predicciones del backup (equipo_id, viejo_partido_id, local, visita)
const PREDICCIONES_RAW = [
  [8, 1, 4, 2],   [8, 2, 2, 1],
  [3, 1, 2, 0],   [3, 2, 1, 1],
  [7, 1, 2, 1],   [7, 2, 1, 0],
  [9, 1, 3, 0],   [9, 2, 0, 1],
  [4, 1, 2, 0],   [4, 2, 1, 1],
  [2, 1, 2, 1],   [2, 2, 1, 1],
  [10, 1, 2, 0],  [10, 2, 1, 0],
  [1, 1, 2, 1],   [1, 2, 2, 0],
  [6, 1, 2, 0],   [6, 2, 1, 1],
  [5, 1, 2, 0],   [5, 2, 1, 2],
  [9, 7, 2, 0],   [8, 7, 2, 0],
  [4, 7, 2, 1],   [4, 19, 1, 1],
  [2, 7, 2, 0],   [2, 19, 1, 2],
  [1, 8, 0, 2],   [10, 7, 1, 0],
  [1, 7, 2, 1],   [1, 14, 1, 1],
  [5, 19, 1, 1],  [1, 19, 1, 2],
  [5, 20, 0, 2],  [5, 26, 1, 2],
  [1, 13, 2, 1],  [5, 31, 1, 2],
  [5, 32, 0, 2],  [5, 14, 0, 2],
  [5, 4, 0, 1],   [5, 3, 2, 1],
  [5, 15, 0, 2],  [5, 16, 4, 0],
  [5, 25, 6, 0],  [10, 19, 1, 1],
  [5, 22, 1, 2],  [5, 21, 2, 0],
  [3, 19, 2, 1],  [10, 8, 0, 2],
  [10, 13, 3, 1], [6, 7, 2, 1],
  [6, 19, 2, 2],  [3, 7, 2, 1],
  [10, 14, 1, 2], [8, 14, 1, 2],
  [9, 19, 1, 1],  [5, 7, 0, 1],
  [5, 10, 0, 0],  [8, 19, 2, 1],
  [5, 9, 1, 0],   [5, 8, 0, 3],
  [5, 13, 2, 1],  [8, 8, 0, 2],
  [8, 13, 2, 1],  [8, 20, 1, 2],
];

// Resultados del backup (viejo_partido_id, local, visita)
const RESULTADOS_RAW = [
  [1,  2, 0],   // México 2-0 Sudáfrica
  [2,  2, 1],   // Corea del Sur 2-1 República Checa
  [7,  0, 0],   // Canadá 0-0 Bosnia
  [19, 0, 0],   // Estados Unidos 0-0 Paraguay
];

// ── Restauración ──────────────────────────────────────────────────────────────
async function restore() {
  console.log('🔄 Restaurando datos del backup...\n');

  try {
    await pool.query('SELECT 1');
    console.log('✅ Conexión a PostgreSQL exitosa');
  } catch (err) {
    console.error('❌ No se pudo conectar:', err.message);
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Restaurar nombres reales de equipos ────────────────────────────────
    console.log('\n👥 Restaurando equipos...');
    for (const eq of EQUIPOS) {
      await client.query(
        `INSERT INTO equipos (id, nombre, pin, activo)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, pin = EXCLUDED.pin`,
        [eq.id, eq.nombre, eq.pin]
      );
    }
    // Asegurar que la secuencia quede sincronizada
    await client.query("SELECT setval('equipos_id_seq', (SELECT MAX(id) FROM equipos))");
    console.log(`   ✓ ${EQUIPOS.length} equipos restaurados`);

    // ── 2. Limpiar predicciones y resultados anteriores ───────────────────────
    console.log('\n🧹 Limpiando datos previos...');
    await client.query('DELETE FROM predicciones');
    await client.query('DELETE FROM resultados');
    console.log('   ✓ Predicciones y resultados eliminados');

    // ── 3. Restaurar resultados con IDs mapeados ──────────────────────────────
    console.log('\n⚽ Restaurando resultados...');
    let resMig = 0, resDrop = 0;
    for (const [viejoId, local, visita] of RESULTADOS_RAW) {
      const nuevoId = PARTIDO_MAPPING[viejoId];
      if (!nuevoId) { resDrop++; continue; }
      await client.query(
        `INSERT INTO resultados (partido_id, local, visita)
         VALUES ($1, $2, $3)
         ON CONFLICT (partido_id) DO UPDATE SET local = EXCLUDED.local, visita = EXCLUDED.visita`,
        [nuevoId, local, visita]
      );
      resMig++;
    }
    console.log(`   ✓ ${resMig} resultados restaurados${resDrop > 0 ? `, ${resDrop} sin mapeo` : ''}`);

    // ── 4. Restaurar predicciones con IDs mapeados ────────────────────────────
    console.log('\n🎯 Restaurando predicciones...');
    let predMig = 0, predDrop = 0;
    for (const [equipoId, viejoId, local, visita] of PREDICCIONES_RAW) {
      const nuevoId = PARTIDO_MAPPING[viejoId];
      if (!nuevoId) { predDrop++; continue; }
      await client.query(
        `INSERT INTO predicciones (equipo_id, partido_id, local, visita)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (equipo_id, partido_id)
         DO UPDATE SET local = EXCLUDED.local, visita = EXCLUDED.visita`,
        [equipoId, nuevoId, local, visita]
      );
      predMig++;
    }
    console.log(`   ✓ ${predMig} predicciones restauradas${predDrop > 0 ? `, ${predDrop} sin mapeo` : ''}`);

    await client.query('COMMIT');

    // ── 5. Verificación final ─────────────────────────────────────────────────
    console.log('\n📊 Verificación:');
    const checks = await Promise.all([
      client.query('SELECT COUNT(*)::int AS c FROM equipos'),
      client.query('SELECT COUNT(*)::int AS c FROM partidos'),
      client.query('SELECT COUNT(*)::int AS c FROM resultados'),
      client.query('SELECT COUNT(*)::int AS c FROM predicciones'),
    ]);
    console.log(`   equipos:      ${checks[0].rows[0].c}`);
    console.log(`   partidos:     ${checks[1].rows[0].c}`);
    console.log(`   resultados:   ${checks[2].rows[0].c}`);
    console.log(`   predicciones: ${checks[3].rows[0].c}`);
    console.log('\n✅ Restauración completada con éxito');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error durante la restauración:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

restore().catch(() => process.exit(1));
