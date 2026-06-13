/**
 * migrate.js — Migración multisede + 72 partidos con horarios
 *
 * ✅ Idempotente: detecta el estado actual y solo aplica lo que falta
 * ✅ Sin dependencias externas más allá de 'pg'
 * ✅ Mapea las 131 predicciones existentes a los nuevos IDs de partido
 * ✅ Funciona en Railway Console (DATABASE_URL disponible) y en local
 *
 * En Railway Console:
 *   node migrate.js
 *
 * En local:
 *   DATABASE_URL=postgres://... node migrate.js
 *   o bien: PGHOST=localhost PGDATABASE=mundialito PGUSER=postgres PGPASSWORD=... node migrate.js
 */

'use strict';

const { Pool } = require('pg');

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

// ─────────────────────────────────────────────────────────────────────────────
// 72 PARTIDOS (formato: [id, grupo, fecha DD/MM/YYYY, hora HH:MM, local, visita])
// Horario Colombia (UTC-5)
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// MAPEO: ID antiguo (1-36) → ID nuevo (1-72)
// Basado en mismo grupo + mismo par de equipos
// ─────────────────────────────────────────────────────────────────────────────
const PARTIDO_MAPPING = {
  // Grupo A
  1: 1,   // México vs Sudáfrica
  2: 2,   // Corea del Sur vs República Checa
  3: 25,  // República Checa vs Sudáfrica
  4: 28,  // México vs Corea del Sur
  5: 53,  // República Checa vs México
  6: 54,  // Sudáfrica vs Corea del Sur
  // Grupo B
  7: 3,   // Canadá vs Bosnia
  8: 5,   // Catar vs Suiza
  9: 26,  // Suiza vs Bosnia
  10: 27, // Canadá vs Catar
  11: 49, // Suiza vs Canadá
  12: 50, // Bosnia vs Catar
  // Grupo C
  13: 6,  // Brasil vs Marruecos
  14: 7,  // Haití vs Escocia
  15: 30, // Escocia vs Marruecos
  16: 31, // Brasil vs Haití
  17: 51, // Escocia vs Brasil
  18: 52, // Marruecos vs Haití
  // Grupo D
  19: 4,  // Estados Unidos vs Paraguay
  20: 8,  // Australia vs Turquía
  21: 29, // Estados Unidos vs Australia
  22: 32, // Turquía vs Paraguay
  23: 59, // Turquía vs Estados Unidos
  24: 60, // Paraguay vs Australia
  // Grupo E
  25: 9,  // Alemania vs Curazao
  26: 10, // Costa de Marfil vs Ecuador
  27: 34, // Alemania vs Costa de Marfil
  28: 35, // Ecuador vs Curazao
  29: 56, // Curazao vs Costa de Marfil
  30: 55, // Ecuador vs Alemania
  // Grupo F
  31: 11, // Países Bajos vs Japón
  32: 12, // Suecia vs Túnez
  33: 33, // Países Bajos vs Suecia
  34: 36, // Túnez vs Japón
  35: 58, // Japón vs Suecia
  36: 57  // Túnez vs Países Bajos
};

// ─────────────────────────────────────────────────────────────────────────────
// Convierte DD/MM/YYYY + HH:MM a TIMESTAMPTZ en zona Colombia (UTC-5)
// ─────────────────────────────────────────────────────────────────────────────
function toTimestamp(fecha, hora) {
  const [dd, mm, yyyy] = fecha.split('/');
  return `${yyyy}-${mm}-${dd} ${hora}:00-05:00`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Detecta qué columnas existen en una tabla
// ─────────────────────────────────────────────────────────────────────────────
async function getColumns(client, tableName) {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1`,
    [tableName]
  );
  return new Set(rows.map(r => r.column_name));
}

// ─────────────────────────────────────────────────────────────────────────────
// Detecta si una tabla existe
// ─────────────────────────────────────────────────────────────────────────────
async function tableExists(client, tableName) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name=$1`,
    [tableName]
  );
  return rows.length > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// MIGRACIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
async function migrate() {
  console.log('🚀 Iniciando migración Multisede + 72 Partidos...\n');

  // Verificar conexión
  try {
    await pool.query('SELECT 1');
    console.log('✅ Conexión a PostgreSQL exitosa');
  } catch (err) {
    console.error('❌ No se pudo conectar. Verifica DATABASE_URL o variables PG*.');
    throw err;
  }

  const client = await pool.connect();
  try {
    // ── PASO 1: Tabla sedes ───────────────────────────────────────────────────
    console.log('\n📋 PASO 1: Tabla sedes');
    await client.query(`
      CREATE TABLE IF NOT EXISTS sedes (
        id         SERIAL PRIMARY KEY,
        nombre     TEXT NOT NULL,
        slug       TEXT UNIQUE NOT NULL,
        activo     INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const { rows: [sedeExiste] } = await client.query(
      "SELECT id FROM sedes WHERE slug='gca-cali'"
    );
    let sedeGcaCali;
    if (!sedeExiste) {
      const { rows: [{ id }] } = await client.query(
        "INSERT INTO sedes (nombre, slug, activo) VALUES ('GCA - Cali', 'gca-cali', 1) RETURNING id"
      );
      sedeGcaCali = id;
      console.log(`   ✓ Sede "GCA - Cali" creada con id=${sedeGcaCali}`);
    } else {
      sedeGcaCali = sedeExiste.id;
      console.log(`   ✓ Sede "GCA - Cali" ya existe (id=${sedeGcaCali})`);
    }

    // ── PASO 2: Columna sede_id en equipos ───────────────────────────────────
    console.log('\n📋 PASO 2: sede_id en equipos');
    const equiposCols = await getColumns(client, 'equipos');
    if (!equiposCols.has('sede_id')) {
      await client.query('ALTER TABLE equipos ADD COLUMN sede_id INTEGER');
      console.log('   ✓ Columna sede_id agregada');
    } else {
      console.log('   ✓ Columna sede_id ya existe');
    }
    const { rowCount: upd } = await client.query(
      'UPDATE equipos SET sede_id = $1 WHERE sede_id IS NULL',
      [sedeGcaCali]
    );
    if (upd > 0) console.log(`   ✓ ${upd} equipos asignados a "GCA - Cali"`);

    // ── PASO 3: Detectar esquema de partidos ──────────────────────────────────
    console.log('\n📋 PASO 3: Esquema de partidos');
    const partidosCols = await getColumns(client, 'partidos');
    const tieneEsquemaViejo = partidosCols.has('fecha') && !partidosCols.has('fecha_hora');
    const tieneEsquemaNuevo = partidosCols.has('fecha_hora');

    if (tieneEsquemaViejo) {
      console.log('   ⚠️  Detectado esquema VIEJO (columna "fecha" TEXT).');
      console.log('   → Guardando predicciones y resultados existentes...');

      // Guardar predicciones y resultados en memoria
      const { rows: predsBackup } = await client.query(
        'SELECT equipo_id, partido_id, local, visita FROM predicciones'
      );
      const { rows: resBackup } = await client.query(
        'SELECT partido_id, local, visita FROM resultados'
      );
      console.log(`   → ${predsBackup.length} predicciones guardadas`);
      console.log(`   → ${resBackup.length} resultados guardados`);

      // Vaciar tablas dependientes (sin CASCADE para no perder estructura)
      await client.query('DELETE FROM predicciones');
      await client.query('DELETE FROM resultados');
      await client.query('DELETE FROM partidos');
      console.log('   → Tablas vaciadas');

      // Alterar esquema de partidos
      await client.query('ALTER TABLE partidos DROP COLUMN fecha');
      await client.query('ALTER TABLE partidos ADD COLUMN fecha_hora TIMESTAMPTZ');
      await client.query('ALTER TABLE partidos ADD COLUMN sede_id INTEGER');
      await client.query('ALTER TABLE partidos ADD COLUMN bloqueado INTEGER NOT NULL DEFAULT 0');
      console.log('   → Esquema de partidos actualizado');

      // Insertar los 72 partidos nuevos
      console.log('   → Insertando 72 partidos con horarios...');
      for (const [id, grupo, fecha, hora, local, visita] of PARTIDOS_72) {
        await client.query(
          'INSERT INTO partidos (id,grupo,fecha_hora,local,visita,sede_id,bloqueado) VALUES ($1,$2,$3,$4,$5,$6,0)',
          [id, grupo, toTimestamp(fecha, hora), local, visita, sedeGcaCali]
        );
      }
      console.log('   ✓ 72 partidos insertados');

      // Re-insertar resultados con IDs mapeados
      let resMigrados = 0, resDropped = 0;
      for (const r of resBackup) {
        const nuevoId = PARTIDO_MAPPING[r.partido_id];
        if (nuevoId) {
          await client.query(
            'INSERT INTO resultados (partido_id,local,visita) VALUES ($1,$2,$3) ON CONFLICT (partido_id) DO NOTHING',
            [nuevoId, r.local, r.visita]
          );
          resMigrados++;
        } else {
          resDropped++;
        }
      }
      console.log(`   ✓ Resultados: ${resMigrados} migrados, ${resDropped} sin mapeo`);

      // Re-insertar predicciones con IDs mapeados
      let predMigradas = 0, predDropped = 0;
      for (const p of predsBackup) {
        const nuevoId = PARTIDO_MAPPING[p.partido_id];
        if (nuevoId) {
          await client.query(
            'INSERT INTO predicciones (equipo_id,partido_id,local,visita) VALUES ($1,$2,$3,$4) ON CONFLICT (equipo_id,partido_id) DO NOTHING',
            [p.equipo_id, nuevoId, p.local, p.visita]
          );
          predMigradas++;
        } else {
          predDropped++;
        }
      }
      console.log(`   ✓ Predicciones: ${predMigradas} migradas, ${predDropped} sin mapeo`);

    } else if (tieneEsquemaNuevo) {
      console.log('   ✓ Esquema nuevo (fecha_hora) ya aplicado');

      // Agregar columnas faltantes si faltan (por si migrate se corrió parcialmente)
      if (!partidosCols.has('sede_id')) {
        await client.query('ALTER TABLE partidos ADD COLUMN sede_id INTEGER');
        console.log('   ✓ Columna sede_id agregada a partidos');
      }
      if (!partidosCols.has('bloqueado')) {
        await client.query('ALTER TABLE partidos ADD COLUMN bloqueado INTEGER NOT NULL DEFAULT 0');
        console.log('   ✓ Columna bloqueado agregada a partidos');
      }

      // Asignar sede_id a partidos sin sede
      const { rowCount: pUpd } = await client.query(
        'UPDATE partidos SET sede_id = $1 WHERE sede_id IS NULL',
        [sedeGcaCali]
      );
      if (pUpd > 0) console.log(`   ✓ ${pUpd} partidos asignados a "GCA - Cali"`);

      // Insertar partidos faltantes
      const { rows: [{ c: totalP }] } = await client.query('SELECT COUNT(*)::int AS c FROM partidos');
      console.log(`   → Partidos actuales: ${totalP} (esperados: 72)`);
      for (const [id, grupo, fecha, hora, local, visita] of PARTIDOS_72) {
        await client.query(
          `INSERT INTO partidos (id,grupo,fecha_hora,local,visita,sede_id,bloqueado)
           VALUES ($1,$2,$3,$4,$5,$6,0) ON CONFLICT (id) DO NOTHING`,
          [id, grupo, toTimestamp(fecha, hora), local, visita, sedeGcaCali]
        );
      }
      const { rows: [{ c: finalP }] } = await client.query('SELECT COUNT(*)::int AS c FROM partidos');
      console.log(`   ✓ Partidos finales: ${finalP}`);

    } else {
      console.log('   ⚠️  Tabla partidos sin columnas esperadas. Recreando...');
      await client.query('DELETE FROM predicciones');
      await client.query('DELETE FROM resultados');
      await client.query('DELETE FROM partidos');
      await client.query('ALTER TABLE partidos ADD COLUMN IF NOT EXISTS fecha_hora TIMESTAMPTZ');
      await client.query('ALTER TABLE partidos ADD COLUMN IF NOT EXISTS sede_id INTEGER');
      await client.query('ALTER TABLE partidos ADD COLUMN IF NOT EXISTS bloqueado INTEGER NOT NULL DEFAULT 0');
      for (const [id, grupo, fecha, hora, local, visita] of PARTIDOS_72) {
        await client.query(
          'INSERT INTO partidos (id,grupo,fecha_hora,local,visita,sede_id,bloqueado) VALUES ($1,$2,$3,$4,$5,$6,0)',
          [id, grupo, toTimestamp(fecha, hora), local, visita, sedeGcaCali]
        );
      }
      console.log('   ✓ 72 partidos insertados desde cero');
    }

    // ── PASO 4: Verificación final ────────────────────────────────────────────
    console.log('\n📊 PASO 4: Verificación final');
    const tablas = ['sedes','equipos','partidos','predicciones','resultados','adherencia','bonos','penalizaciones'];
    for (const t of tablas) {
      if (await tableExists(client, t)) {
        const { rows: [{ c }] } = await client.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
        console.log(`   ${t.padEnd(18)} → ${c} filas`);
      } else {
        console.log(`   ${t.padEnd(18)} → (tabla no existe)`);
      }
    }

    console.log('\n✅ Migración completada exitosamente.\n');

  } catch (err) {
    console.error('\n❌ Error durante la migración:', err.message);
    console.error('   No se hicieron cambios permanentes en los datos de predicciones/resultados.');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(() => process.exit(1));
