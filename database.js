const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'mundialito.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS equipos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      pin TEXT NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS partidos (
      id INTEGER PRIMARY KEY,
      grupo TEXT NOT NULL,
      fecha TEXT NOT NULL,
      local TEXT NOT NULL,
      visita TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS resultados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partido_id INTEGER NOT NULL UNIQUE,
      local INTEGER NOT NULL,
      visita INTEGER NOT NULL,
      FOREIGN KEY (partido_id) REFERENCES partidos(id)
    );
    CREATE TABLE IF NOT EXISTS predicciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipo_id INTEGER NOT NULL,
      partido_id INTEGER NOT NULL,
      local INTEGER NOT NULL,
      visita INTEGER NOT NULL,
      UNIQUE(equipo_id, partido_id),
      FOREIGN KEY (equipo_id) REFERENCES equipos(id),
      FOREIGN KEY (partido_id) REFERENCES partidos(id)
    );
    CREATE TABLE IF NOT EXISTS adherencia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipo_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      puntos INTEGER NOT NULL,
      UNIQUE(equipo_id, fecha),
      FOREIGN KEY (equipo_id) REFERENCES equipos(id)
    );
    CREATE TABLE IF NOT EXISTS bonos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipo_id INTEGER NOT NULL,
      puntos INTEGER NOT NULL,
      descripcion TEXT NOT NULL,
      fecha TEXT NOT NULL,
      FOREIGN KEY (equipo_id) REFERENCES equipos(id)
    );
    CREATE TABLE IF NOT EXISTS penalizaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipo_id INTEGER NOT NULL,
      puntos INTEGER NOT NULL,
      descripcion TEXT NOT NULL,
      fecha TEXT NOT NULL,
      FOREIGN KEY (equipo_id) REFERENCES equipos(id)
    );
  `);

  if (db.prepare('SELECT COUNT(*) as c FROM partidos').get().c === 0) {
    const ins = db.prepare('INSERT INTO partidos (id,grupo,fecha,local,visita) VALUES (?,?,?,?,?)');
    db.transaction(() => { for (const p of PARTIDOS_SEED) ins.run(...p); })();
  }

  if (db.prepare('SELECT COUNT(*) as c FROM equipos').get().c === 0) {
    const ins = db.prepare('INSERT INTO equipos (nombre,pin,activo) VALUES (?,?,1)');
    db.transaction(() => {
      for (let i = 1; i <= 10; i++) {
        ins.run(`Equipo ${i}`, i === 10 ? '0000' : String(i).repeat(4));
      }
    })();
  }
}

function getAllData() {
  return {
    equipos:       db.prepare('SELECT * FROM equipos ORDER BY id').all(),
    partidos:      db.prepare('SELECT * FROM partidos ORDER BY id').all(),
    resultados:    db.prepare('SELECT * FROM resultados').all(),
    predicciones:  db.prepare('SELECT * FROM predicciones').all(),
    adherencia:    db.prepare('SELECT * FROM adherencia').all(),
    bonos:         db.prepare('SELECT * FROM bonos ORDER BY id').all(),
    penalizaciones:db.prepare('SELECT * FROM penalizaciones ORDER BY id').all()
  };
}

const stmts = {
  findEquipo:            db.prepare('SELECT * FROM equipos WHERE id=? AND pin=? AND activo=1'),
  updateEquipo:          db.prepare('UPDATE equipos SET nombre=?,pin=? WHERE id=?'),
  toggleEquipo:          db.prepare('UPDATE equipos SET activo=CASE WHEN activo=1 THEN 0 ELSE 1 END WHERE id=?'),
  insertEquipo:          db.prepare('INSERT INTO equipos (nombre,pin,activo) VALUES (?,?,1)'),
  upsertResultado:       db.prepare('INSERT INTO resultados (partido_id,local,visita) VALUES (?,?,?) ON CONFLICT(partido_id) DO UPDATE SET local=excluded.local,visita=excluded.visita'),
  deleteResultado:       db.prepare('DELETE FROM resultados WHERE partido_id=?'),
  deleteAllResultados:   db.prepare('DELETE FROM resultados'),
  upsertPrediccion:      db.prepare('INSERT INTO predicciones (equipo_id,partido_id,local,visita) VALUES (?,?,?,?) ON CONFLICT(equipo_id,partido_id) DO UPDATE SET local=excluded.local,visita=excluded.visita'),
  deletePrediccion:      db.prepare('DELETE FROM predicciones WHERE equipo_id=? AND partido_id=?'),
  deletePrediccionesEq:  db.prepare('DELETE FROM predicciones WHERE equipo_id=?'),
  upsertAdherencia:      db.prepare('INSERT INTO adherencia (equipo_id,fecha,puntos) VALUES (?,?,?) ON CONFLICT(equipo_id,fecha) DO UPDATE SET puntos=excluded.puntos'),
  insertBono:            db.prepare('INSERT INTO bonos (equipo_id,puntos,descripcion,fecha) VALUES (?,?,?,?)'),
  deleteBono:            db.prepare('DELETE FROM bonos WHERE id=?'),
  insertPenalizacion:    db.prepare('INSERT INTO penalizaciones (equipo_id,puntos,descripcion,fecha) VALUES (?,?,?,?)'),
  deletePenalizacion:    db.prepare('DELETE FROM penalizaciones WHERE id=?'),
  hasResultado:          db.prepare('SELECT 1 FROM resultados WHERE partido_id=?')
};

module.exports = {
  initDB,
  getAllData,
  findEquipo:           (id, pin)                    => stmts.findEquipo.get(id, pin),
  updateEquipo:         (id, nombre, pin)             => stmts.updateEquipo.run(nombre, pin, id),
  toggleEquipo:         (id)                          => stmts.toggleEquipo.run(id),
  insertEquipo:         (nombre, pin)                 => stmts.insertEquipo.run(nombre, pin),
  upsertResultado:      (pid, local, visita)          => stmts.upsertResultado.run(pid, local, visita),
  deleteResultado:      (pid)                         => stmts.deleteResultado.run(pid),
  deleteAllResultados:  ()                            => stmts.deleteAllResultados.run(),
  upsertPrediccion:     (eid, pid, local, visita)     => stmts.upsertPrediccion.run(eid, pid, local, visita),
  deletePrediccion:     (eid, pid)                    => stmts.deletePrediccion.run(eid, pid),
  deletePrediccionesEq: (eid)                         => stmts.deletePrediccionesEq.run(eid),
  upsertAdherencia:     (eid, fecha, puntos)          => stmts.upsertAdherencia.run(eid, fecha, puntos),
  insertBono:           (eid, puntos, desc, fecha)    => stmts.insertBono.run(eid, puntos, desc, fecha),
  deleteBono:           (id)                          => stmts.deleteBono.run(id),
  insertPenalizacion:   (eid, puntos, desc, fecha)    => stmts.insertPenalizacion.run(eid, puntos, desc, fecha),
  deletePenalizacion:   (id)                          => stmts.deletePenalizacion.run(id),
  hasResultado:         (pid)                         => !!stmts.hasResultado.get(pid)
};
