const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const db = require('./database-pg');                          // CAMBIO: ./database → ./database-pg

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const ADMIN_PASS = 'admin2026';
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// CAMBIO: broadcast y wrap son ahora async para soportar db async
async function broadcast() {
  io.emit('data-update', await db.getAllData());
}

function wrap(fn) {
  return async (req, res) => {                               // CAMBIO: async + await
    try { await fn(req, res); }
    catch (err) { console.error(err); res.status(500).json({ error: 'Error interno del servidor' }); }
  };
}

// ── Auth ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/equipo', wrap(async (req, res) => {
  const { equipoId, pin } = req.body;
  const equipo = await db.findEquipo(parseInt(equipoId), String(pin));
  if (!equipo) return res.status(401).json({ error: 'PIN incorrecto' });
  res.json({ equipo });
}));

app.post('/api/auth/admin', wrap((req, res) => {
  if (req.body.password !== ADMIN_PASS) return res.status(401).json({ error: 'Contraseña incorrecta' });
  res.json({ ok: true });
}));

// ── Data ──────────────────────────────────────────────────────────────────────
app.get('/api/data', wrap(async (_req, res) => res.json(await db.getAllData())));

// ── Equipos ───────────────────────────────────────────────────────────────────
app.put('/api/equipos/:id', wrap(async (req, res) => {
  const { nombre, pin } = req.body;
  await db.updateEquipo(parseInt(req.params.id), nombre, String(pin));
  await broadcast();
  res.json({ ok: true });
}));

app.post('/api/equipos', wrap(async (req, res) => {
  const { nombre, pin, sedeId } = req.body;
  const r = await db.insertEquipo(nombre, String(pin), sedeId ? parseInt(sedeId) : null);
  await broadcast();
  res.json({ id: r.lastInsertRowid });
}));

app.put('/api/equipos/:id/toggle', wrap(async (req, res) => {
  await db.toggleEquipo(parseInt(req.params.id));
  await broadcast();
  res.json({ ok: true });
}));

// ── Resultados ────────────────────────────────────────────────────────────────
app.post('/api/resultados', wrap(async (req, res) => {
  const { partidoId, local, visita } = req.body;
  await db.upsertResultado(parseInt(partidoId), parseInt(local), parseInt(visita));
  await broadcast();
  res.json({ ok: true });
}));

// IMPORTANT: /all must come before /:partidoId
app.delete('/api/resultados/all', wrap(async (_req, res) => {
  await db.deleteAllResultados();
  await broadcast();
  res.json({ ok: true });
}));

app.delete('/api/resultados/:partidoId', wrap(async (req, res) => {
  await db.deleteResultado(parseInt(req.params.partidoId));
  await broadcast();
  res.json({ ok: true });
}));

// ── Sedes ─────────────────────────────────────────────────────────────────────
app.get('/api/sedes', wrap(async (_req, res) => {
  res.json(await db.getSedes());
}));

app.post('/api/sedes', wrap(async (req, res) => {
  const { nombre, slug } = req.body;
  const r = await db.createSede(nombre, slug);
  await broadcast();
  res.json({ id: r.lastInsertRowid });
}));

app.put('/api/sedes/:id', wrap(async (req, res) => {
  const { nombre, slug } = req.body;
  await db.updateSede(parseInt(req.params.id), nombre, slug);
  await broadcast();
  res.json({ ok: true });
}));

app.put('/api/sedes/:id/toggle', wrap(async (req, res) => {
  await db.toggleSede(parseInt(req.params.id));
  await broadcast();
  res.json({ ok: true });
}));

// ── Bloqueo manual de partidos ────────────────────────────────────────────────
app.put('/api/partidos/:id/bloqueo', wrap(async (req, res) => {
  await db.toggleBloqueoPartido(parseInt(req.params.id));
  await broadcast();
  res.json({ ok: true });
}));

// ── Predicciones ──────────────────────────────────────────────────────────────
app.post('/api/predicciones', wrap(async (req, res) => {
  const { equipoId, partidoId, local, visita } = req.body;
  if (await db.isPartidoBloqueado(parseInt(partidoId))) {
    return res.status(400).json({ error: 'Este partido está bloqueado, no se puede predecir' });
  }
  await db.upsertPrediccion(parseInt(equipoId), parseInt(partidoId), parseInt(local), parseInt(visita));
  await broadcast();
  res.json({ ok: true });
}));

app.delete('/api/predicciones/:equipoId/:partidoId', wrap(async (req, res) => {
  await db.deletePrediccion(parseInt(req.params.equipoId), parseInt(req.params.partidoId));
  await broadcast();
  res.json({ ok: true });
}));

app.delete('/api/predicciones/:equipoId', wrap(async (req, res) => {
  await db.deletePrediccionesEq(parseInt(req.params.equipoId));
  await broadcast();
  res.json({ ok: true });
}));

// ── Adherencia ────────────────────────────────────────────────────────────────
app.post('/api/adherencia', wrap(async (req, res) => {
  const { equipoId, fecha, puntos } = req.body;
  await db.upsertAdherencia(parseInt(equipoId), fecha, parseInt(puntos));
  await broadcast();
  res.json({ ok: true });
}));

// ── Bonos ─────────────────────────────────────────────────────────────────────
app.post('/api/bonos', wrap(async (req, res) => {
  const { equipoId, puntos, descripcion, fecha } = req.body;
  const r = await db.insertBono(parseInt(equipoId), parseInt(puntos), descripcion, fecha);
  await broadcast();
  res.json({ id: r.lastInsertRowid });
}));

app.delete('/api/bonos/:id', wrap(async (req, res) => {
  await db.deleteBono(parseInt(req.params.id));
  await broadcast();
  res.json({ ok: true });
}));

// ── Penalizaciones ────────────────────────────────────────────────────────────
app.post('/api/penalizaciones', wrap(async (req, res) => {
  const { equipoId, puntos, descripcion, fecha } = req.body;
  const r = await db.insertPenalizacion(parseInt(equipoId), parseInt(puntos), descripcion, fecha);
  await broadcast();
  res.json({ id: r.lastInsertRowid });
}));

app.delete('/api/penalizaciones/:id', wrap(async (req, res) => {
  await db.deletePenalizacion(parseInt(req.params.id));
  await broadcast();
  res.json({ ok: true });
}));

// ── Socket.io ─────────────────────────────────────────────────────────────────
io.on('connection', async (socket) => {           // CAMBIO: async
  socket.emit('data-update', await db.getAllData());
});

// ── Fallback ──────────────────────────────────────────────────────────────────
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ── Arranque: espera a que la DB esté lista antes de aceptar conexiones ───────
// CAMBIO: db.initDB() es async; el server.listen() va dentro del .then()
db.initDB()
  .then(() => server.listen(PORT, () => {
    console.log(`✅ Mundialito GCA 2026 corriendo en http://localhost:${PORT}`);
  }))
  .catch((err) => {
    console.error('❌ Error fatal al inicializar la base de datos:', err);
    process.exit(1);
  });