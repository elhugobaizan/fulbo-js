# ⚽ Fútbol AR

Estadísticas del fútbol argentino (y más) — React + TypeScript + Tailwind + Express + Neon PostgreSQL

## Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite
- **Data fetching**: TanStack Query v5
- **Routing**: TanStack Router v1
- **Backend**: Express.js + TypeScript
- **ORM**: Drizzle ORM
- **Base de datos**: Neon (PostgreSQL serverless)
- **API de fútbol**: API-Football (api-sports.io)

## Setup

### 1. Instalar dependencias

```bash
npm run install:all
```

### 2. Configurar variables de entorno

```bash
cp server/.env.example server/.env
# Editar server/.env con tus credenciales
```

Necesitás:
- **DATABASE_URL**: Crear una DB en [neon.tech](https://neon.tech)
- **FOOTBALL_API_KEY**: Registrarse en [api-sports.io](https://www.api-sports.io) (plan gratuito disponible)

### 3. Crear tablas en la base de datos

```bash
cd server
npm run db:push
```

### 4. Correr en desarrollo

```bash
# Desde la raíz del proyecto
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- API Health: http://localhost:3000/api/health

## Estructura

```
futbol-ar/
├── client/                 # Vite + React
│   └── src/
│       ├── components/     # Componentes reutilizables
│       ├── routes/         # Páginas (TanStack Router)
│       ├── hooks/          # TanStack Query hooks
│       └── lib/            # API client, utils
│
└── server/                 # Express.js
    └── src/
        ├── config/         # Configuración (leagues IDs, etc.)
        ├── db/             # Schema Drizzle + conexión Neon
        ├── routes/         # Endpoints REST
        └── services/       # Wrapper API-Football con cache
```

## IDs de Ligas (API-Football)

| Liga | ID |
|---|---|
| Liga Profesional Argentina | 128 |
| Primera Nacional | 131 |
| Copa Argentina | 130 |
| Copa de la Liga | 788 |
| Copa Libertadores | 13 |
| Copa Sudamericana | 14 |
