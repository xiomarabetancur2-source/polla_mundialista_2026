/**
 * database-pg.js — PostgreSQL adapter para Railway
 *
 * Exporta exactamente las mismas funciones que database.js
 * (initDB, getAllData, findEquipo, updateEquipo, …) pero todas son async.
 * Además agrega funciones para sedes y bloqueo de partidos.
 */

'use strict';

const { Pool } = require('pg');

// ── Conexión ──────────────────────────────────────────────────────────────────
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
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

function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function prepare(sql) {
  const isInsert = /^\s*INSERT/i.test(sql);
  const pgSql = toPg(isInsert ? `${sql} RETURNING id` : sql);

  return {
    async get(...args) {
      const { rows } = await pool.query(pgSql, args);
      return rows[0] ?? null;
    },
    async all(...args) {
      const { rows } = await pool.query(pgSql, args);
      return rows;
    },
    async run(...args) {
      const result = await pool.query(pgSql, args);
      return {
        lastInsertRowid: isInsert && result.rows[0] ? result.rows[0].id : undefined,
        changes: result.rowCount
      };
    }
  };
}

// Convierte DD/MM/YYYY + HH:MM a TIMESTAMPTZ en zona Colombia (UTC-5)
function toTimestamp(fecha, hora) {
  const [dd, mm, yyyy] = fecha.split('/');
  return `${yyyy}-${mm}-${dd} ${hora}:00-05:00`;
}

// ── Seed data ─────────────────────────────────────────────────────────────────
const PARTIDOS_72 = [
  [1,'A','11/06/2026','14:00','México','Sudáfrica'],
  [2,'A','11/06/2026','21:00','Corea del Sur','República Checa'],
  [3,'B','12/06/2026','14:00','Canadá','Bosnia'],
  [4,'D','12/06/2026','20:00','Estados Unidos','Paraguay'],
  [5,'B','13/06/2026','14:00','Catar','Suiza'],
  [6,'C','13/06/2026','17:00','Brasil','Marruecos'],
  [7,'C','13/06/2026','20:00','Haití','Escocia'],
  [8,'D','13/06/2026','23:00','Australia','Turquía'],
  [9,'E','14/06/2026','12:00','Alemania','Curazao'],
  [10,'E','14/06/2026','15:00','Costa de Marfil','Ecuador'],
  [11,'F','14/06/2026','18:00','Países Bajos','Japón'],
  [12,'F','14/06/2026','21:00','Suecia','Túnez'],
  [13,'G','15/06/2026','11:00','Bélgica','Egipto'],
  [14,'G','15/06/2026','14:00','Irán','Nueva Zelanda'],
  [15,'H','15/06/2026','17:00','España','Cabo Verde'],
  [16,'H','15/06/2026','20:00','Arabia Saudita','Uruguay'],
  [17,'I','16/06/2026','14:00','Francia','Senegal'],
  [18,'I','16/06/2026','17:00','Irak','Noruega'],
  [19,'J','16/06/2026','20:00','Argentina','Argelia'],
  [20,'J','16/06/2026','23:00','Austria','Jordania'],
  [21,'K','17/06/2026','12:00','Portugal','República Democrática del Congo'],
  [22,'K','17/06/2026','15:00','Inglaterra','Croacia'],
  [23,'L','17/06/2026','18:00','Ghana','Panamá'],
  [24,'K','17/06/2026','21:00','Uzbekistán','Colombia'],
  [25,'A','18/06/2026','11:00','República Checa','Sudáfrica'],
  [26,'B','18/06/2026','14:00','Suiza','Bosnia'],
  [27,'B','18/06/2026','17:00','Canadá','Catar'],
  [28,'A','18/06/2026','20:00','México','Corea del Sur'],
  [29,'D','19/06/2026','14:00','Estados Unidos','Australia'],
  [30,'C','19/06/2026','17:00','Escocia','Marruecos'],
  [31,'C','19/06/2026','19:30','Brasil','Haití'],
  [32,'D','19/06/2026','22:00','Turquía','Paraguay'],
  [33,'F','20/06/2026','12:00','Países Bajos','Suecia'],
  [34,'E','20/06/2026','15:00','Alemania','Costa de Marfil'],
  [35,'E','20/06/2026','19:00','Ecuador','Curazao'],
  [36,'F','20/06/2026','23:00','Túnez','Japón'],
  [37,'H','21/06/2026','11:00','España','Arabia Saudita'],
  [38,'G','21/06/2026','14:00','Bélgica','Irán'],
  [39,'H','21/06/2026','17:00','Uruguay','Cabo Verde'],
  [40,'G','21/06/2026','20:00','Nueva Zelanda','Egipto'],
  [41,'J','22/06/2026','12:00','Argentina','Austria'],
  [42,'I','22/06/2026','16:00','Francia','Irak'],
  [43,'I','22/06/2026','19:00','Noruega','Senegal'],
  [44,'J','22/06/2026','22:00','Jordania','Argelia'],
  [45,'K','23/06/2026','12:00','Portugal','Uzbekistán'],
  [46,'L','23/06/2026','15:00','Inglaterra','Ghana'],
  [47,'L','23/06/2026','18:00','Panamá','Croacia'],
  [48,'K','23/06/2026','21:00','Colombia','República Democrática del Congo'],
  [49,'B','24/06/2026','14:00','Suiza','Canadá'],
  [50,'B','24/06/2026','14:00','Bosnia','Catar'],
  [51,'C','24/06/2026','17:00','Escocia','Brasil'],
  [52,'C','24/06/2026','17:00','Marruecos','Haití'],
  [53,'A','24/06/2026','20:00','República Checa','México'],
  [54,'A','24/06/2026','20:00','Sudáfrica','Corea del Sur'],
  [55,'E','25/06/2026','15:00','Ecuador','Alemania'],
  [56,'E','25/06/2026','15:00','Curazao','Costa de Marfil'],
  [57,'F','25/06/2026','18:00','Túnez','Países Bajos'],
  [58,'F','25/06/2026','18:00','Japón','Suecia'],
  [59,'D','25/06/2026','21:00','Turquía','Estados Unidos'],
  [60,'D','25/06/2026','21:00','Paraguay','Australia'],
  [61,'I','26/06/2026','14:00','Noruega','Francia'],
  [62,'I','26/06/2026','14:00','Senegal','Irak'],
  [63,'H','26/06/2026','19:00','Uruguay','España'],
  [64,'H','26/06/2026','19:00','Cabo Verde','Arabia Saudita'],
  [65,'G','26/06/2026','22:00','Nueva Zelanda','Bélgica'],
  [66,'G','26/06/2026','22:00','Egipto','Irán'],
  [67,'L','27/06/2026','16:00','Panamá','Inglaterra'],
  [68,'L','27/06/2026','16:00','Croacia','Ghana'],
  [69,'K','27/06/2026','18:30','Colombia','Portugal'],
  [70,'K','27/06/2026','18:30','República Democrática del Congo','Uzbekistán'],
  [71,'J','27/06/2026','21:00','Jordania','Argentina'],
  [72,'J','27/06/2026','21:00','Argelia','Austria']
];

// Mapeo de IDs viejos (1-36) a nuevos (1-72) para migración automática
const PARTIDO_MAPPING = {
  1:1,  2:2,  3:25, 4:28, 5:53, 6:54,
  7:3,  8:5,  9:26, 10:27, 11:49, 12:50,
  13:6, 14:7, 15:30, 16:31, 17:51, 18:52,
  19:4, 20:8, 21:29, 22:32, 23:59, 24:60,
  25:9, 26:10, 27:34, 28:35, 29:56, 30:55,
  31:11, 32:12, 33:33, 34:36, 35:58, 36:57
};

// ── initDB ────────────────────────────────────────────────────────────────────
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Tablas que no cambian de esquema ───────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS sedes (
        id         SERIAL PRIMARY KEY,
        nombre     TEXT NOT NULL,
        slug       TEXT UNIQUE NOT NULL,
        activo     INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS equipos (
        id      SERIAL  PRIMARY KEY,
        nombre  TEXT    NOT NULL,
        pin     TEXT    NOT NULL,
        activo  INTEGER NOT NULL DEFAULT 1,
        sede_id INTEGER
      )
    `);

    // Crear partidos con nuevo esquema si no existe aún
    await client.query(`
      CREATE TABLE IF NOT EXISTS partidos (
        id         INTEGER PRIMARY KEY,
        grupo      TEXT    NOT NULL,
        fecha_hora TIMESTAMPTZ,
        local      TEXT    NOT NULL,
        visita     TEXT    NOT NULL,
        sede_id    INTEGER,
        bloqueado  INTEGER NOT NULL DEFAULT 0
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS resultados (
        id         SERIAL  PRIMARY KEY,
        partido_id INTEGER NOT NULL UNIQUE,
        local      INTEGER NOT NULL,
        visita     INTEGER NOT NULL,
        FOREIGN KEY (partido_id) REFERENCES partidos(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS predicciones (
        id         SERIAL  PRIMARY KEY,
        equipo_id  INTEGER NOT NULL,
        partido_id INTEGER NOT NULL,
        local      INTEGER NOT NULL,
        visita     INTEGER NOT NULL,
        UNIQUE(equipo_id, partido_id),
        FOREIGN KEY (equipo_id)  REFERENCES equipos(id),
        FOREIGN KEY (partido_id) REFERENCES partidos(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS adherencia (
        id        SERIAL  PRIMARY KEY,
        equipo_id INTEGER NOT NULL,
        fecha     TEXT    NOT NULL,
        puntos    INTEGER NOT NULL,
        UNIQUE(equipo_id, fecha),
        FOREIGN KEY (equipo_id) REFERENCES equipos(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bonos (
        id          SERIAL  PRIMARY KEY,
        equipo_id   INTEGER NOT NULL,
        puntos      INTEGER NOT NULL,
        descripcion TEXT    NOT NULL,
        fecha       TEXT    NOT NULL,
        FOREIGN KEY (equipo_id) REFERENCES equipos(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS penalizaciones (
        id          SERIAL  PRIMARY KEY,
        equipo_id   INTEGER NOT NULL,
        puntos      INTEGER NOT NULL,
        descripcion TEXT    NOT NULL,
        fecha       TEXT    NOT NULL,
        FOREIGN KEY (equipo_id) REFERENCES equipos(id)
      )
    `);

    // ── 2. Migración automática de esquema ────────────────────────────────────
    // Detectar columnas actuales de partidos y equipos
    const { rows: pCols } = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='partidos'`
    );
    const partidosCols = new Set(pCols.map(r => r.column_name));

    const { rows: eCols } = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='equipos'`
    );
    const equiposCols = new Set(eCols.map(r => r.column_name));

    // Agregar sede_id a equipos si falta
    if (!equiposCols.has('sede_id')) {
      await client.query('ALTER TABLE equipos ADD COLUMN sede_id INTEGER');
      console.log('  → sede_id agregado a equipos');
    }

    if (partidosCols.has('fecha') && !partidosCols.has('fecha_hora')) {
      // Esquema viejo detectado: migrar a 72 partidos con timestamps
      console.log('  → Esquema viejo detectado, migrando a 72 partidos...');

      // Guardar predicciones y resultados existentes
      const predsBackup = (await client.query('SELECT * FROM predicciones')).rows;
      const resBackup   = (await client.query('SELECT * FROM resultados')).rows;
      console.log(`  → Backup: ${predsBackup.length} predicciones, ${resBackup.length} resultados`);

      // Vaciar tablas dependientes y partidos
      await client.query('DELETE FROM predicciones');
      await client.query('DELETE FROM resultados');
      await client.query('DELETE FROM partidos');

      // Cambiar esquema de partidos
      await client.query('ALTER TABLE partidos DROP COLUMN fecha');
      await client.query('ALTER TABLE partidos ADD COLUMN fecha_hora TIMESTAMPTZ');
      await client.query('ALTER TABLE partidos ADD COLUMN sede_id INTEGER');
      await client.query('ALTER TABLE partidos ADD COLUMN bloqueado INTEGER NOT NULL DEFAULT 0');

      // Insertar 72 partidos con horarios
      const { rows: [sedeRow] } = await client.query("SELECT id FROM sedes WHERE slug='gca-cali'");
      const sedeId = sedeRow ? sedeRow.id : 1;
      for (const [id, grupo, fecha, hora, local, visita] of PARTIDOS_72) {
        await client.query(
          'INSERT INTO partidos (id,grupo,fecha_hora,local,visita,sede_id,bloqueado) VALUES ($1,$2,$3,$4,$5,$6,0)',
          [id, grupo, toTimestamp(fecha, hora), local, visita, sedeId]
        );
      }
      console.log('  → 72 partidos insertados');

      // Restaurar resultados con IDs mapeados
      let resMig = 0;
      for (const r of resBackup) {
        const nuevoId = PARTIDO_MAPPING[r.partido_id];
        if (nuevoId) {
          await client.query(
            'INSERT INTO resultados (partido_id,local,visita) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
            [nuevoId, r.local, r.visita]
          );
          resMig++;
        }
      }

      // Restaurar predicciones con IDs mapeados
      let predMig = 0;
      for (const p of predsBackup) {
        const nuevoId = PARTIDO_MAPPING[p.partido_id];
        if (nuevoId) {
          await client.query(
            'INSERT INTO predicciones (equipo_id,partido_id,local,visita) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
            [p.equipo_id, nuevoId, p.local, p.visita]
          );
          predMig++;
        }
      }
      console.log(`  → Migradas: ${resMig} resultados, ${predMig} predicciones`);

    } else {
      // Esquema nuevo: agregar columnas faltantes sin perder datos
      if (!partidosCols.has('fecha_hora')) {
        await client.query('ALTER TABLE partidos ADD COLUMN fecha_hora TIMESTAMPTZ');
        console.log('  → fecha_hora agregado a partidos');
      }
      if (!partidosCols.has('sede_id')) {
        await client.query('ALTER TABLE partidos ADD COLUMN sede_id INTEGER');
        console.log('  → sede_id agregado a partidos');
      }
      if (!partidosCols.has('bloqueado')) {
        await client.query('ALTER TABLE partidos ADD COLUMN bloqueado INTEGER NOT NULL DEFAULT 0');
        console.log('  → bloqueado agregado a partidos');
      }
    }

    // ── 3. Seeds (solo si las tablas están vacías) ────────────────────────────
    const { rows: [{ c: sc }] } = await client.query('SELECT COUNT(*)::int AS c FROM sedes');
    if (sc === 0) {
      await client.query(
        "INSERT INTO sedes (nombre,slug,activo) VALUES ('GCA - Cali','gca-cali',1)"
      );
    }

    const { rows: [{ c: pc }] } = await client.query('SELECT COUNT(*)::int AS c FROM partidos');
    if (pc === 0) {
      const { rows: [sedeRow] } = await client.query("SELECT id FROM sedes WHERE slug='gca-cali'");
      const sedeId = sedeRow ? sedeRow.id : 1;
      for (const [id, grupo, fecha, hora, local, visita] of PARTIDOS_72) {
        await client.query(
          'INSERT INTO partidos (id,grupo,fecha_hora,local,visita,sede_id,bloqueado) VALUES ($1,$2,$3,$4,$5,$6,0)',
          [id, grupo, toTimestamp(fecha, hora), local, visita, sedeId]
        );
      }
    }

    const { rows: [{ c: ec }] } = await client.query('SELECT COUNT(*)::int AS c FROM equipos');
    if (ec === 0) {
      const { rows: [sedeRow] } = await client.query("SELECT id FROM sedes WHERE slug='gca-cali'");
      const sedeId = sedeRow ? sedeRow.id : 1;
      const equiposSeed = [
        [1, 'Las Romperredes',         '1111'],
        [2, 'Titanes FC',              '2222'],
        [3, 'Los Elegidos',            '3333'],
        [4, 'Los Alcones',             '4444'],
        [5, 'El Combo',                '5555'],
        [6, 'Furia del Gol',           '6666'],
        [7, 'Aficionadas VIP',         '7777'],
        [8, 'Golden Team',             '8888'],
        [9, 'Los Dueños del Mundial',  '9999'],
        [10,'Fenix FC',                '0000']
      ];
      for (const [id, nombre, pin] of equiposSeed) {
        await client.query(
          'INSERT INTO equipos (id,nombre,pin,activo,sede_id) VALUES ($1,$2,$3,1,$4)',
          [id, nombre, pin, sedeId]
        );
      }
      // Sincronizar secuencia SERIAL con el máximo ID insertado
      await client.query("SELECT setval('equipos_id_seq', (SELECT MAX(id) FROM equipos))");
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
  const [se, eq, pt, re, pr, ad, bo, pe] = await Promise.all([
    pool.query('SELECT * FROM sedes ORDER BY id'),
    pool.query('SELECT * FROM equipos ORDER BY id'),
    // Partidos con campos derivados para el frontend
    pool.query(`
      SELECT
        p.id,
        p.grupo,
        p.local,
        p.visita,
        p.sede_id,
        p.bloqueado,
        TO_CHAR(p.fecha_hora AT TIME ZONE 'America/Bogota', 'DD/MM/YYYY') AS fecha,
        TO_CHAR(p.fecha_hora AT TIME ZONE 'America/Bogota', 'HH24:MI')    AS hora,
        CASE WHEN (
          p.bloqueado = 1
          OR p.fecha_hora <= NOW() + INTERVAL '5 minutes'
          OR EXISTS (SELECT 1 FROM resultados r WHERE r.partido_id = p.id)
        ) THEN 1 ELSE 0 END AS bloqueado_efectivo
      FROM partidos p
      ORDER BY p.fecha_hora, p.id
    `),
    pool.query('SELECT * FROM resultados'),
    pool.query('SELECT * FROM predicciones'),
    pool.query('SELECT * FROM adherencia'),
    pool.query('SELECT * FROM bonos ORDER BY id'),
    pool.query('SELECT * FROM penalizaciones ORDER BY id')
  ]);
  return {
    sedes:          se.rows,
    equipos:        eq.rows,
    partidos:       pt.rows,
    resultados:     re.rows,
    predicciones:   pr.rows,
    adherencia:     ad.rows,
    bonos:          bo.rows,
    penalizaciones: pe.rows
  };
}

// ── Sedes ─────────────────────────────────────────────────────────────────────
async function getSedes() {
  const { rows } = await pool.query('SELECT * FROM sedes ORDER BY id');
  return rows;
}

async function createSede(nombre, slug) {
  const { rows } = await pool.query(
    'INSERT INTO sedes (nombre,slug,activo) VALUES ($1,$2,1) RETURNING id',
    [nombre, slug]
  );
  return { lastInsertRowid: rows[0].id };
}

async function updateSede(id, nombre, slug) {
  const { rowCount } = await pool.query(
    'UPDATE sedes SET nombre=$1,slug=$2 WHERE id=$3',
    [nombre, slug, id]
  );
  return { changes: rowCount };
}

async function toggleSede(id) {
  const { rowCount } = await pool.query(
    'UPDATE sedes SET activo=CASE WHEN activo=1 THEN 0 ELSE 1 END WHERE id=$1',
    [id]
  );
  return { changes: rowCount };
}

// ── Bloqueo de partidos ───────────────────────────────────────────────────────

async function isPartidoBloqueado(partidoId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM partidos p
     WHERE p.id = $1 AND (
       p.bloqueado = 1
       OR p.fecha_hora <= NOW() + INTERVAL '5 minutes'
       OR EXISTS (SELECT 1 FROM resultados r WHERE r.partido_id = p.id)
     )`,
    [partidoId]
  );
  return rows.length > 0;
}

async function toggleBloqueoPartido(partidoId) {
  const { rowCount } = await pool.query(
    'UPDATE partidos SET bloqueado=CASE WHEN bloqueado=1 THEN 0 ELSE 1 END WHERE id=$1',
    [partidoId]
  );
  return { changes: rowCount };
}

// ── Statements preparados ─────────────────────────────────────────────────────
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
  deletePenalizacion:  prepare('DELETE FROM penalizaciones WHERE id=?')
};

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  initDB,
  getAllData,
  // Equipos
  findEquipo:           (id, pin)                 => stmts.findEquipo.get(id, pin),
  updateEquipo:         (id, nombre, pin)          => stmts.updateEquipo.run(nombre, pin, id),
  toggleEquipo:         (id)                       => stmts.toggleEquipo.run(id),
  insertEquipo:         (nombre, pin)              => stmts.insertEquipo.run(nombre, pin),
  // Resultados
  upsertResultado:      (pid, local, visita)       => stmts.upsertResultado.run(pid, local, visita),
  deleteResultado:      (pid)                      => stmts.deleteResultado.run(pid),
  deleteAllResultados:  ()                         => stmts.deleteAllResultados.run(),
  // Predicciones
  upsertPrediccion:     (eid, pid, local, visita)  => stmts.upsertPrediccion.run(eid, pid, local, visita),
  deletePrediccion:     (eid, pid)                 => stmts.deletePrediccion.run(eid, pid),
  deletePrediccionesEq: (eid)                      => stmts.deletePrediccionesEq.run(eid),
  // Adherencia / Bonos / Penalizaciones
  upsertAdherencia:     (eid, fecha, puntos)       => stmts.upsertAdherencia.run(eid, fecha, puntos),
  insertBono:           (eid, puntos, desc, fecha) => stmts.insertBono.run(eid, puntos, desc, fecha),
  deleteBono:           (id)                       => stmts.deleteBono.run(id),
  insertPenalizacion:   (eid, puntos, desc, fecha) => stmts.insertPenalizacion.run(eid, puntos, desc, fecha),
  deletePenalizacion:   (id)                       => stmts.deletePenalizacion.run(id),
  // Sedes
  getSedes,
  createSede,
  updateSede,
  toggleSede,
  // Bloqueo
  isPartidoBloqueado,
  toggleBloqueoPartido,
  // Compatibilidad legada (server.js antiguo usa hasResultado)
  hasResultado: isPartidoBloqueado
};
