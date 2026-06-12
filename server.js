const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const ADMIN_PASS = 'admin2026';
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

db.initDB();

function broadcast() {
  io.emit('data-update', db.getAllData());
}

function wrap(fn) {
  return (req, res) => {
    try { fn(req, res); }
    catch (err) { console.error(err); res.status(500).json({ error: 'Error interno del servidor' }); }
  };
}

// ── Auth ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/equipo', wrap((req, res) => {
  const { equipoId, pin } = req.body;
  const equipo = db.findEquipo(parseInt(equipoId), String(pin));
  if (!equipo) return res.status(401).json({ error: 'PIN incorrecto' });
  res.json({ equipo });
}));

app.post('/api/auth/admin', wrap((req, res) => {
  if (req.body.password !== ADMIN_PASS) return res.status(401).json({ error: 'Contraseña incorrecta' });
  res.json({ ok: true });
}));

// ── Data ──────────────────────────────────────────────────────────────────────
app.get('/api/data', wrap((req, res) => res.json(db.getAllData())));

// ── Equipos ───────────────────────────────────────────────────────────────────
app.put('/api/equipos/:id', wrap((req, res) => {
  const { nombre, pin } = req.body;
  db.updateEquipo(parseInt(req.params.id), nombre, String(pin));
  broadcast();
  res.json({ ok: true });
}));

app.post('/api/equipos', wrap((req, res) => {
  const { nombre, pin } = req.body;
  const r = db.insertEquipo(nombre, String(pin));
  broadcast();
  res.json({ id: r.lastInsertRowid });
}));

app.put('/api/equipos/:id/toggle', wrap((req, res) => {
  db.toggleEquipo(parseInt(req.params.id));
  broadcast();
  res.json({ ok: true });
}));

// ── Resultados ────────────────────────────────────────────────────────────────
app.post('/api/resultados', wrap((req, res) => {
  const { partidoId, local, visita } = req.body;
  db.upsertResultado(parseInt(partidoId), parseInt(local), parseInt(visita));
  broadcast();
  res.json({ ok: true });
}));

// IMPORTANT: /all must come before /:partidoId
app.delete('/api/resultados/all', wrap((req, res) => {
  db.deleteAllResultados();
  broadcast();
  res.json({ ok: true });
}));

app.delete('/api/resultados/:partidoId', wrap((req, res) => {
  db.deleteResultado(parseInt(req.params.partidoId));
  broadcast();
  res.json({ ok: true });
}));

// ── Predicciones ──────────────────────────────────────────────────────────────
app.post('/api/predicciones', wrap((req, res) => {
  const { equipoId, partidoId, local, visita } = req.body;
  if (db.hasResultado(parseInt(partidoId))) {
    return res.status(400).json({ error: 'Este partido ya fue jugado, no se puede predecir' });
  }
  db.upsertPrediccion(parseInt(equipoId), parseInt(partidoId), parseInt(local), parseInt(visita));
  broadcast();
  res.json({ ok: true });
}));

app.delete('/api/predicciones/:equipoId/:partidoId', wrap((req, res) => {
  db.deletePrediccion(parseInt(req.params.equipoId), parseInt(req.params.partidoId));
  broadcast();
  res.json({ ok: true });
}));

app.delete('/api/predicciones/:equipoId', wrap((req, res) => {
  db.deletePrediccionesEq(parseInt(req.params.equipoId));
  broadcast();
  res.json({ ok: true });
}));

// ── Adherencia ────────────────────────────────────────────────────────────────
app.post('/api/adherencia', wrap((req, res) => {
  const { equipoId, fecha, puntos } = req.body;
  db.upsertAdherencia(parseInt(equipoId), fecha, parseInt(puntos));
  broadcast();
  res.json({ ok: true });
}));

// ── Bonos ─────────────────────────────────────────────────────────────────────
app.post('/api/bonos', wrap((req, res) => {
  const { equipoId, puntos, descripcion, fecha } = req.body;
  const r = db.insertBono(parseInt(equipoId), parseInt(puntos), descripcion, fecha);
  broadcast();
  res.json({ id: r.lastInsertRowid });
}));

app.delete('/api/bonos/:id', wrap((req, res) => {
  db.deleteBono(parseInt(req.params.id));
  broadcast();
  res.json({ ok: true });
}));

// ── Penalizaciones ────────────────────────────────────────────────────────────
app.post('/api/penalizaciones', wrap((req, res) => {
  const { equipoId, puntos, descripcion, fecha } = req.body;
  const r = db.insertPenalizacion(parseInt(equipoId), parseInt(puntos), descripcion, fecha);
  broadcast();
  res.json({ id: r.lastInsertRowid });
}));

app.delete('/api/penalizaciones/:id', wrap((req, res) => {
  db.deletePenalizacion(parseInt(req.params.id));
  broadcast();
  res.json({ ok: true });
}));

// ── Socket.io ─────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.emit('data-update', db.getAllData());
});

// ── Fallback ──────────────────────────────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

server.listen(PORT, () => {
  console.log(`✅ Mundialito GCA 2026 corriendo en http://localhost:${PORT}`);
});
