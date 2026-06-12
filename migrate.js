/**
 * migrate.js — Migra datos de mundialito.db (SQLite) a PostgreSQL
 *
 * Uso:
 *   # Con DATABASE_URL (Railway):
 *   DATABASE_URL="postgresql://..." node migrate.js
 *
 *   # Con variables individuales (desarrollo local):
 *   PGHOST=localhost PGDATABASE=mundialito PGUSER=postgres PGPASSWORD=... node migrate.js
 *
 * Comportamiento:
 *   - Crea las tablas si no existen
 *   - TRUNCA todas las tablas antes de insertar (migración limpia, idempotente)
 *   - Preserva los IDs originales de SQLite y reajusta las secuencias SERIAL
 *   - Requiere que mundialito.db esté en la misma carpeta
 */

'use strict';

const Database = require('better-sqlite3');
const { Pool }  = require('pg');
const path      = require('path');

// ── Conexiones ────────────────────────────────────────────────────────────────
const sqlite = new Database(path.join(__dirname, 'mundialito.db'), { readonly: true });

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

// ── DDL PostgreSQL ────────────────────────────────────────────────────────────
const DDL = `
  CREATE TABLE IF NOT EXISTS equipos (
    id      SERIAL  PRIMARY KEY,
    nombre  TEXT    NOT NULL,
    pin     TEXT    NOT NULL,
    activo  INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS partidos (
    id      INTEGER PRIMARY KEY,
    grupo   TEXT NOT NULL,
    fecha   TEXT NOT NULL,
    local   TEXT NOT NULL,
    visita  TEXT NOT NULL
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function log(msg) { console.log(`  ${msg}`); }

// Reinicia la secuencia SERIAL de una tabla al valor máximo de id actual
async function resetSeq(client, table) {
  await client.query(
    `SELECT setval('${table}_id_seq', COALESCE((SELECT MAX(id) FROM ${table}), 0))`
  );
}

// ── Migración ─────────────────────────────────────────────────────────────────
async function migrate() {
  console.log('🚀 Iniciando migración SQLite → PostgreSQL\n');

  // 1. Leer todos los datos de SQLite
  const data = {
    partidos:       sqlite.prepare('SELECT * FROM partidos      ORDER BY id').all(),
    equipos:        sqlite.prepare('SELECT * FROM equipos       ORDER BY id').all(),
    resultados:     sqlite.prepare('SELECT * FROM resultados    ORDER BY id').all(),
    predicciones:   sqlite.prepare('SELECT * FROM predicciones  ORDER BY id').all(),
    adherencia:     sqlite.prepare('SELECT * FROM adherencia    ORDER BY id').all(),
    bonos:          sqlite.prepare('SELECT * FROM bonos         ORDER BY id').all(),
    penalizaciones: sqlite.prepare('SELECT * FROM penalizaciones ORDER BY id').all()
  };

  console.log('📂 Datos leídos desde SQLite:');
  for (const [t, rows] of Object.entries(data)) log(`${t}: ${rows.length} fila(s)`);
  console.log();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 2. Crear tablas si no existen
    console.log('🔨 Creando tablas (si no existen)...');
    await client.query(DDL);
    log('OK');

    // 3. Limpiar tablas respetando FK (orden inverso de dependencias)
    console.log('\n🗑️  Limpiando tablas existentes...');
    await client.query(`
      TRUNCATE TABLE penalizaciones, bonos, adherencia, predicciones, resultados
      RESTART IDENTITY CASCADE
    `);
    // equipos y partidos al final porque otros dependen de ellos
    await client.query('TRUNCATE TABLE equipos RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE partidos RESTART IDENTITY CASCADE');
    log('OK');

    // 4. Insertar en orden de dependencias
    // ── partidos (id INTEGER, no SERIAL — se inserta directamente) ────────────
    console.log('\n📥 Insertando datos...');
    for (const p of data.partidos) {
      await client.query(
        'INSERT INTO partidos (id,grupo,fecha,local,visita) VALUES ($1,$2,$3,$4,$5)',
        [p.id, p.grupo, p.fecha, p.local, p.visita]
      );
    }
    log(`partidos: ${data.partidos.length}`);

    // ── equipos (SERIAL — insertar con id explícito, luego resetear seq) ──────
    for (const e of data.equipos) {
      await client.query(
        'INSERT INTO equipos (id,nombre,pin,activo) VALUES ($1,$2,$3,$4)',
        [e.id, e.nombre, e.pin, e.activo]
      );
    }
    await resetSeq(client, 'equipos');
    log(`equipos: ${data.equipos.length}`);

    // ── resultados ────────────────────────────────────────────────────────────
    for (const r of data.resultados) {
      await client.query(
        'INSERT INTO resultados (id,partido_id,local,visita) VALUES ($1,$2,$3,$4)',
        [r.id, r.partido_id, r.local, r.visita]
      );
    }
    if (data.resultados.length) await resetSeq(client, 'resultados');
    log(`resultados: ${data.resultados.length}`);

    // ── predicciones ──────────────────────────────────────────────────────────
    for (const p of data.predicciones) {
      await client.query(
        'INSERT INTO predicciones (id,equipo_id,partido_id,local,visita) VALUES ($1,$2,$3,$4,$5)',
        [p.id, p.equipo_id, p.partido_id, p.local, p.visita]
      );
    }
    if (data.predicciones.length) await resetSeq(client, 'predicciones');
    log(`predicciones: ${data.predicciones.length}`);

    // ── adherencia ────────────────────────────────────────────────────────────
    for (const a of data.adherencia) {
      await client.query(
        'INSERT INTO adherencia (id,equipo_id,fecha,puntos) VALUES ($1,$2,$3,$4)',
        [a.id, a.equipo_id, a.fecha, a.puntos]
      );
    }
    if (data.adherencia.length) await resetSeq(client, 'adherencia');
    log(`adherencia: ${data.adherencia.length}`);

    // ── bonos ─────────────────────────────────────────────────────────────────
    for (const b of data.bonos) {
      await client.query(
        'INSERT INTO bonos (id,equipo_id,puntos,descripcion,fecha) VALUES ($1,$2,$3,$4,$5)',
        [b.id, b.equipo_id, b.puntos, b.descripcion, b.fecha]
      );
    }
    if (data.bonos.length) await resetSeq(client, 'bonos');
    log(`bonos: ${data.bonos.length}`);

    // ── penalizaciones ────────────────────────────────────────────────────────
    for (const p of data.penalizaciones) {
      await client.query(
        'INSERT INTO penalizaciones (id,equipo_id,puntos,descripcion,fecha) VALUES ($1,$2,$3,$4,$5)',
        [p.id, p.equipo_id, p.puntos, p.descripcion, p.fecha]
      );
    }
    if (data.penalizaciones.length) await resetSeq(client, 'penalizaciones');
    log(`penalizaciones: ${data.penalizaciones.length}`);

    await client.query('COMMIT');
    console.log('\n✅ Migración completada exitosamente');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error — se hizo ROLLBACK. No se modificó nada en PostgreSQL.');
    throw err;
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

migrate().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
