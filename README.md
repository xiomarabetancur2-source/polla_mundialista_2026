# ⚽ Mundialito GCA 2026

Sistema de predicciones para el torneo GCA Technologies 2026.  
**Stack:** Node.js + Express + Socket.io + SQLite (better-sqlite3)

---

## Instalación y uso local

```bash
npm install
npm start
```

Abrir en el navegador: **http://localhost:3000**

Para desarrollo con reinicio automático:
```bash
npm run dev
```

---

## Credenciales por defecto

| Rol | Acceso |
|-----|--------|
| Admin | Contraseña: `admin2026` |
| Equipo 1 | PIN: `1111` |
| Equipo 2 | PIN: `2222` |
| … | … |
| Equipo 10 | PIN: `0000` |

---

## Despliegue en Railway (recomendado)

1. Subir el proyecto a GitHub (incluye `mundialito.db` con datos semilla)
2. Ir a [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
3. Seleccionar el repositorio
4. Railway detecta Node.js automáticamente
5. En **Settings → Variables** agregar si es necesario: `PORT=3000` (Railway lo provee automáticamente via `$PORT`)
6. Click **Deploy**

> **Nota de persistencia:** Railway Free Tier tiene disco efímero. El archivo `mundialito.db` se reinicia con cada redeploy. Para persistencia real, usa un **Railway Volume** (opción de pago) o realiza backups manuales del `.db`.

---

## Despliegue en Render

1. Subir el proyecto a GitHub
2. En [render.com](https://render.com) → **New Web Service**
3. Conectar el repositorio
4. Configurar:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Click **Create Web Service**

> **Nota de persistencia:** En el plan Free de Render, el disco es efímero. Para persistir el `.db` entre deploys, agrega un **Render Disk** (desde $0.25/GB/mes) y monta el volumen en la ruta del proyecto.

---

## Arquitectura

```
Cliente (Browser)
    │  WebSocket (Socket.io)
    │  HTTP REST API
    ▼
server.js  (Express + Socket.io)
    │
    ▼
database.js  (better-sqlite3)
    │
    ▼
mundialito.db  (SQLite — portable, se sube a git con seed data)
```

Cuando cualquier dato cambia (resultado, predicción, bono, etc.), el servidor emite `data-update` a **todos** los clientes conectados simultáneamente.
