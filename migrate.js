/**
 * migrate.js — Crea tablas y siembra datos iniciales en PostgreSQL
 *
 * ✅ SIN dependencia de SQLite ni de mundialito.db
 * ✅ Seguro para ejecutar en Railway Console
 * ✅ Idempotente: se puede correr varias veces sin duplicar datos
 *
 * Uso en Railway Console:
 *   node migrate.js
 *
 * Uso local con variables individuales:
 *   PGHOST=localhost PGDATABASE=mundialito PGUSER=postgres PGPASSWORD=secret node migrate.js
 */

'use strict';

const { Pool } = require('pg');

// ── Conexión ──────────────────────────────────────────────────────────────────
// Railway inyecta DATABASE_URL automáticamente en el contenedor.
// Si usas variables individuales (PGHOST, etc.) también funciona.
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host:     process.env.PGHOST,
        database: process.env.PGDATABASE,
        user:     process.env.PGUSER,
        password: process.env.PGPASSWORD,
        port:     parseInt(process.env.PGPORT || '5432'),
        ssl:      false
      }
);

// ── Seed data ─────────────────────────────────────────────────────────────────
const PARTIDOS = [
  [1,'A','11/06/2026','México','Sudáfrica'],
  [2,'A','11/06/2026','Corea del Sur','República Checa'],
  [3,'A','18/06/2026','República Checa','Sudáfrica'],
  [4,'A','18/06/2026','México','Corea del Sur'],
  [5,'A','24/06/2026','República Checa','México'],
  [6,'A','24/06/2026','Sudáfrica','Corea del Sur'],
  [7,'B','12/06/2026','Canadá','Bosnia'],
  [8,'B','13/06/2026','Catar','Suiza'],
  [9,'B','18/06/2026','Suiza','Bosnia'],
  [10,'B','18/06/2026','Canadá','Catar'],
  [11,'B','24/06/2026','Suiza','Canadá'],
  [12,'B','24/06/2026','Bosnia','Catar'],
  [13,'C','13/06/2026','Brasil','Marruecos'],
  [14,'C','13/06/2026','Haití','Escocia'],
  [15,'C','19/06/2026','Escocia','Marruecos'],
  [16,'C','19/06/2026','Brasil','Haití'],
  [17,'C','24/06/2026','Escocia','Brasil'],
  [18,'C','24/06/2026','Marruecos','Haití'],
  [19,'D','12/06/2026','Estados Unidos','Paraguay'],
  [20,'D','14/06/2026','Australia','Turquía'],
  [21,'D','19/06/2026','Estados Unidos','Australia'],
  [22,'D','20/06/2026','Turquía','Paraguay'],
  [23,'D','25/06/2026','Turquía','Estados Unidos'],
  [24,'D','25/06/2026','Paraguay','Australia'],
  [25,'E','14/06/2026','Alemania','Curazao'],
  [26,'E','14/06/2026','Costa de Marfil','Ecuador'],
  [27,'E','20/06/2026','Alemania','Costa de Marfil'],
  [28,'E','20/06/2026','Ecuador','Curazao'],
  [29,'E','25/06/2026','Curazao','Costa de Marfil'],
  [30,'E','25/06/2026','Ecuador','Alemania'],
  [31,'F','14/06/2026','Países Bajos','Japón'],
  [32,'F','14/06/2026','Suecia','Túnez'],
  [33,'F','20/06/2026','Países Bajos','Suecia'],
  [34,'F','20/06/2026','Túnez','Japón'],
  [35,'F','25/06/2026','Japón','Suecia'],
  [36,'F','25/06/2026','Túnez','Países Bajos']
];

// ── Schema DDL ────────────────────────────────────────────────────────────────
const DDL = `
  CREATE TABLE IF NOT EXISTS equipos (
    id      SERIAL  PRIMARY KEY,
    nombre  TEXT    NOT NULL,
    pin     TEXT    NOT NULL,
    activo  INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS partidos (
    id      INTEGER PRIMARY KEY,
    grupo   TEXT    NOT NULL,
    fecha   TEXT    NOT NULL,
    local   TEXT    NOT NULL,
    visita  TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS resultados (
    id         SERIAL  PRIMARY KEY,
    partido_id INTEGER NOT NULL UNIQUE,
    local      INTEGER NOT NULL,
    visita     INTEGER NOT NULL,
    FOREIGN KEY (partido_id) REFERENCES partidos(id)
  );

  CREATE TABLE IF NOT EXISTS predicciones (
    id         SERIAL  PRIMARY KEY,
    equipo_id  INTEGER NOT NULL,
    partido_id INTEGER NOT NULL,
    local      INTEGER NOT NULL,
    visita     INTEGER NOT NULL,
    UNIQUE(equipo_id, partido_id),
    FOREIGN KEY (equipo_id)  REFERENCES equipos(id),
    FOREIGN KEY (partido_id) REFERENCES partidos(id)
  );

  CREATE TABLE IF NOT EXISTS adherencia (
    id        SERIAL  PRIMARY KEY,
    equipo_id INTEGER NOT NULL,
    fecha     TEXT    NOT NULL,
    puntos    INTEGER NOT NULL,
    UNIQUE(equipo_id, fecha),
    FOREIGN KEY (equipo_id) REFERENCES equipos(id)
  );

  CREATE TABLE IF NOT EXISTS bonos (
    id          SERIAL  PRIMARY KEY,
    equipo_id   INTEGER NOT NULL,
    puntos      INTEGER NOT NULL,
    descripcion TEXT    NOT NULL,
    fecha       TEXT    NOT NULL,
    FOREIGN KEY (equipo_id) REFERENCES equipos(id)
  );

  CREATE TABLE IF NOT EXISTS penalizaciones (
    id          SERIAL  PRIMARY KEY,
    equipo_id   INTEGER NOT NULL,
    puntos      INTEGER NOT NULL,
    descripcion TEXT    NOT NULL,
    fecha       TEXT    NOT NULL,
    FOREIGN KEY (equipo_id) REFERENCES equipos(id)
  );
`;

// ── Main ──────────────────────────────────────────────────────────────────────
async function migrate() {
  console.log('🚀 Iniciando setup de PostgreSQL...\n');

  // Verificar conexión antes de empezar
  try {
    await pool.query('SELECT 1');
    console.log('✅ Conexión a PostgreSQL exitosa\n');
  } catch (err) {
    console.error('❌ No se pudo conectar a PostgreSQL.');
    console.error('   Verifica que DATABASE_URL o las variables PG* estén configuradas.');
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Crear tablas
    console.log('📋 Creando tablas (CREATE TABLE IF NOT EXISTS)...');
    await client.query(DDL);
    console.log('   ✓ Esquema aplicado\n');

    // 2. Seed partidos (solo si la tabla está vacía)
    const { rows: [{ c: pc }] } = await client.query('SELECT COUNT(*)::int AS c FROM partidos');
    if (pc === 0) {
      console.log('⚽ Insertando 36 partidos...');
      for (const [id, grupo, fecha, local, visita] of PARTIDOS) {
        await client.query(
          'INSERT INTO partidos (id,grupo,fecha,local,visita) VALUES ($1,$2,$3,$4,$5)',
          [id, grupo, fecha, local, visita]
        );
      }
      console.log('   ✓ 36 partidos insertados\n');
    } else {
      console.log(`⚽ Partidos: ${pc} ya existen — no se modificaron\n`);
    }

    // 3. Seed equipos (solo si la tabla está vacía)
    const { rows: [{ c: ec }] } = await client.query('SELECT COUNT(*)::int AS c FROM equipos');
    if (ec === 0) {
      console.log('👥 Insertando 10 equipos con PINs por defecto...');
      for (let i = 1; i <= 10; i++) {
        const pin = i === 10 ? '0000' : String(i).repeat(4);
        await client.query(
          'INSERT INTO equipos (nombre, pin, activo) VALUES ($1, $2, 1)',
          [`Equipo ${i}`, pin]
        );
      }
      console.log('   ✓ 10 equipos insertados\n');
      console.log('   PINs por defecto:');
      console.log('   Equipo 1→1111  Equipo 2→2222  ...  Equipo 9→9999  Equipo 10→0000\n');
    } else {
      console.log(`👥 Equipos: ${ec} ya existen — no se modificaron\n`);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error — ROLLBACK ejecutado. No se modificó nada.');
    throw err;
  } finally {
    client.release();
  }

  // 4. Verificación final (fuera de la transacción)
  console.log('📊 Verificación — filas en cada tabla:');
  const tablas = ['partidos','equipos','resultados','predicciones','adherencia','bonos','penalizaciones'];
  for (const tabla of tablas) {
    const { rows: [{ c }] } = await pool.query(`SELECT COUNT(*)::int AS c FROM ${tabla}`);
    const ok = (tabla === 'partidos' && c === 36) || (tabla === 'equipos' && c >= 1) || !['partidos','equipos'].includes(tabla);
    console.log(`   ${ok ? '✓' : '⚠'} ${tabla.padEnd(16)} ${c} fila(s)`);
  }

  await pool.end();
  console.log('\n✅ Setup completado. La aplicación está lista para usar.');
}

migrate().catch((err) => {
  console.error('\n' + err.message);
  process.exit(1);
});
