/**
 * database-pg.js — PostgreSQL adapter para Railway
 *
 * Exporta exactamente las mismas funciones que database.js
 * (initDB, getAllData, findEquipo, updateEquipo, …) pero todas son async.
 *
 * El único cambio requerido en server.js es:
 *   require('./database') → require('./database-pg')
 *   + agregar async/await en los handlers (ver server.js actualizado)
 */

const { Pool } = require('pg');

// ── Conexión ──────────────────────────────────────────────────────────────────
// Railway provee DATABASE_URL automáticamente.
// En desarrollo local puedes poner las variables individuales en .env
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }        // requerido por Railway
      }
    : {
        host:     process.env.PGHOST     || 'localhost',
        database: process.env.PGDATABASE || 'mundialito',
        user:     process.env.PGUSER     || 'postgres',
        password: process.env.PGPASSWORD || '',
        port:     parseInt(process.env.PGPORT || '5432'),
        ssl:      false
      }
);

pool.on('error', (err) => console.error('PostgreSQL pool error:', err));

// ── Helpers ───────────────────────────────────────────────────────────────────

// Convierte placeholders SQLite '?' → PostgreSQL '$1, $2, …'
function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/**
 * Emula better-sqlite3's db.prepare(sql).get/all/run()
 * Devuelve un objeto con métodos async que replican la interfaz original.
 */
function prepare(sql) {
  const isInsert = /^\s*INSERT/i.test(sql);
  // Los INSERT reciben RETURNING id para poder devolver lastInsertRowid
  const pgSql = toPg(isInsert ? `${sql} RETURNING id` : sql);

  return {
    // Devuelve la primera fila o null (equivale a .get() síncrono)
    async get(...args) {
      const { rows } = await pool.query(pgSql, args);
      return rows[0] ?? null;
    },
    // Devuelve todas las filas (equivale a .all() síncrono)
    async all(...args) {
      const { rows } = await pool.query(pgSql, args);
      return rows;
    },
    // Ejecuta la query y devuelve { lastInsertRowid, changes }
    async run(...args) {
      const result = await pool.query(pgSql, args);
      return {
        lastInsertRowid: isInsert && result.rows[0] ? result.rows[0].id : undefined,
        changes: result.rowCount
      };
    }
  };
}

// ── Seed data ─────────────────────────────────────────────────────────────────
const PARTIDOS_SEED = [
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

// ── initDB ────────────────────────────────────────────────────────────────────
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // SERIAL = autoincrement en PostgreSQL (equivalente a INTEGER AUTOINCREMENT de SQLite)
    await client.query(`
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
    `);

    // Seed partidos si la tabla está vacía
    const { rows: [{ c: pc }] } = await client.query('SELECT COUNT(*)::int AS c FROM partidos');
    if (pc === 0) {
      for (const p of PARTIDOS_SEED) {
        await client.query(
          'INSERT INTO partidos (id,grupo,fecha,local,visita) VALUES ($1,$2,$3,$4,$5)',
          p
        );
      }
    }

    // Seed equipos si la tabla está vacía
    const { rows: [{ c: ec }] } = await client.query('SELECT COUNT(*)::int AS c FROM equipos');
    if (ec === 0) {
      for (let i = 1; i <= 10; i++) {
        await client.query(
          'INSERT INTO equipos (nombre,pin,activo) VALUES ($1,$2,1)',
          [`Equipo ${i}`, i === 10 ? '0000' : String(i).repeat(4)]
        );
      }
    }

    await client.query('COMMIT');
    console.log('✅ PostgreSQL inicializado correctamente');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── getAllData ────────────────────────────────────────────────────────────────
async function getAllData() {
  const [eq, pt, re, pr, ad, bo, pe] = await Promise.all([
    pool.query('SELECT * FROM equipos ORDER BY id'),
    pool.query('SELECT * FROM partidos ORDER BY id'),
    pool.query('SELECT * FROM resultados'),
    pool.query('SELECT * FROM predicciones'),
    pool.query('SELECT * FROM adherencia'),
    pool.query('SELECT * FROM bonos ORDER BY id'),
    pool.query('SELECT * FROM penalizaciones ORDER BY id')
  ]);
  return {
    equipos:        eq.rows,
    partidos:       pt.rows,
    resultados:     re.rows,
    predicciones:   pr.rows,
    adherencia:     ad.rows,
    bonos:          bo.rows,
    penalizaciones: pe.rows
  };
}

// ── Statements preparados (mismos nombres que database.js) ───────────────────
const stmts = {
  findEquipo:          prepare('SELECT * FROM equipos WHERE id=? AND pin=? AND activo=1'),
  updateEquipo:        prepare('UPDATE equipos SET nombre=?,pin=? WHERE id=?'),
  toggleEquipo:        prepare('UPDATE equipos SET activo=CASE WHEN activo=1 THEN 0 ELSE 1 END WHERE id=?'),
  insertEquipo:        prepare('INSERT INTO equipos (nombre,pin,activo) VALUES (?,?,1)'),
  upsertResultado:     prepare('INSERT INTO resultados (partido_id,local,visita) VALUES (?,?,?) ON CONFLICT(partido_id) DO UPDATE SET local=EXCLUDED.local,visita=EXCLUDED.visita'),
  deleteResultado:     prepare('DELETE FROM resultados WHERE partido_id=?'),
  deleteAllResultados: prepare('DELETE FROM resultados'),
  upsertPrediccion:    prepare('INSERT INTO predicciones (equipo_id,partido_id,local,visita) VALUES (?,?,?,?) ON CONFLICT(equipo_id,partido_id) DO UPDATE SET local=EXCLUDED.local,visita=EXCLUDED.visita'),
  deletePrediccion:    prepare('DELETE FROM predicciones WHERE equipo_id=? AND partido_id=?'),
  deletePrediccionesEq:prepare('DELETE FROM predicciones WHERE equipo_id=?'),
  upsertAdherencia:    prepare('INSERT INTO adherencia (equipo_id,fecha,puntos) VALUES (?,?,?) ON CONFLICT(equipo_id,fecha) DO UPDATE SET puntos=EXCLUDED.puntos'),
  insertBono:          prepare('INSERT INTO bonos (equipo_id,puntos,descripcion,fecha) VALUES (?,?,?,?)'),
  deleteBono:          prepare('DELETE FROM bonos WHERE id=?'),
  insertPenalizacion:  prepare('INSERT INTO penalizaciones (equipo_id,puntos,descripcion,fecha) VALUES (?,?,?,?)'),
  deletePenalizacion:  prepare('DELETE FROM penalizaciones WHERE id=?'),
  hasResultado:        prepare('SELECT 1 FROM resultados WHERE partido_id=?')
};

// ── Exports (misma firma que database.js, todo async) ────────────────────────
module.exports = {
  initDB,
  getAllData,
  findEquipo:            (id, pin)                => stmts.findEquipo.get(id, pin),
  updateEquipo:          (id, nombre, pin)         => stmts.updateEquipo.run(nombre, pin, id),
  toggleEquipo:          (id)                      => stmts.toggleEquipo.run(id),
  insertEquipo:          (nombre, pin)             => stmts.insertEquipo.run(nombre, pin),
  upsertResultado:       (pid, local, visita)      => stmts.upsertResultado.run(pid, local, visita),
  deleteResultado:       (pid)                     => stmts.deleteResultado.run(pid),
  deleteAllResultados:   ()                        => stmts.deleteAllResultados.run(),
  upsertPrediccion:      (eid, pid, local, visita) => stmts.upsertPrediccion.run(eid, pid, local, visita),
  deletePrediccion:      (eid, pid)                => stmts.deletePrediccion.run(eid, pid),
  deletePrediccionesEq:  (eid)                     => stmts.deletePrediccionesEq.run(eid),
  upsertAdherencia:      (eid, fecha, puntos)      => stmts.upsertAdherencia.run(eid, fecha, puntos),
  insertBono:            (eid, puntos, desc, fecha)=> stmts.insertBono.run(eid, puntos, desc, fecha),
  deleteBono:            (id)                      => stmts.deleteBono.run(id),
  insertPenalizacion:    (eid, puntos, desc, fecha)=> stmts.insertPenalizacion.run(eid, puntos, desc, fecha),
  deletePenalizacion:    (id)                      => stmts.deletePenalizacion.run(id),
  hasResultado:          async (pid)               => !!(await stmts.hasResultado.get(pid))
};
