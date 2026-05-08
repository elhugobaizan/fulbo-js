# Fútbol AR — Contexto del Proyecto

## Stack
- **Frontend**: React + TypeScript + Tailwind + Vite + TanStack Router/Query
- **Backend**: Express (dev) / Vercel Serverless Functions (prod)
- **DB**: Neon PostgreSQL + Drizzle ORM
- **API externa**: API-Football (api-sports.io) — plan free, season 2024
- **Deploy**: Vercel (Hobby plan, máx 12 funciones serverless)
- **PWA**: vite-plugin-pwa, orientation: 'any' en manifest
- **Storage logos**: Cloudflare R2

## Estructura de archivos clave
```
api/
  admin.ts          ← CRUD partidos, jugadores, eventos, lineup, torneo
  local.ts          ← endpoints de lectura: standings, fixtures, stats, etc.
  bracket/index.ts  ← cálculo de eliminatoria
  _lib/
    tournament-schema.ts  ← schema Drizzle completo
    helpers.ts

client/src/
  routes/
    index.tsx           ← Home
    standings.tsx       ← Posiciones
    fixtures.tsx        ← Fixtures (grupos + eliminatoria integrada)
    bracket.tsx         ← Eliminatoria (árbol visual)
    players.tsx         ← Jugadores / stats
    team.$teamId.tsx    ← Partidos + Plantel del equipo (tab Partidos por defecto)
    match.$matchId.tsx  ← Detalle del partido
  components/
    BracketView.tsx        ← Árbol de eliminatoria desktop + lista mobile
    MatchEventsPanel.tsx   ← Cargar/editar incidencias
    LineupPanel.tsx        ← Cargar alineación (un solo botón guardar ambos equipos)
    ESPNImportModal.tsx    ← Importar desde ESPN API (5 pasos)
    LocalPlayerModal.tsx   ← Stats del jugador
    AddPlayerModal.tsx     ← Agregar jugador
    TeamBadge.tsx          ← Logo o iniciales con color determinístico
  hooks/
    useActiveTournament.ts
    useLocalPlayers.ts     ← incluye usePlayerStats, useTournamentTeams, useTeamTournaments
    useMatchEvents.ts      ← incluye useUpdateEvent
    useMatchLineup.ts
    useTeamFixtures.ts     ← acepta all=true para traer todos los partidos
    useWikidata.ts
```

## Schema DB (tablas principales)
- `tournaments`: id, name, shortName, season, hasGroups, qualifiersPerGroup, active, allowCrossGroup, knockoutStarted
- `teams`: id, name, shortName, logoUrl, country, externalId
- `groups`: id, tournamentId, name
- `groupTeams`: groupId, teamId
- `matches`: id, tournamentId, phase, status, groupId, matchday, knockoutRound, bracketPosition, homeTeamId, awayTeamId, homeScore, awayScore, homePenalties, awayPenalties, scheduledAt
- `bracketRules`: tournamentId, knockoutRound, bracketPosition, homeGroupId, homePosition, awayGroupId, awayPosition, homeWinnerOf, awayWinnerOf
- `localPlayers`: id, firstName, lastName, teamId, tournamentId, position
- `matchEvents`: id, matchId, minute, type, playerId, playerOutId, teamId, isPenalty, isOwnGoal
- `matchLineups`: id, matchId, teamId, playerId, isStarter, shirtNumber

## Fase eliminatoria
- `tournaments.knockoutStarted = true` habilita la generación de partidos knockout
- `admin.ts` endpoint `generate-knockout` genera los partidos de octavos desde standings + bracketRules
- Los partidos knockout tienen `phase: 'knockout'` y `knockoutRound: 'round_of_16' | 'quarterfinal' | 'semifinal' | 'final'`
- `set-match-date` PATCH actualiza solo la fecha de un partido knockout
- En fixtures, la "Eliminatoria" aparece como una fecha especial después de la última fecha de grupos
- Al guardar fecha desde el frontend: usar `dateValue + ':00.000Z'` para evitar conversión de timezone

## Decisiones técnicas críticas

### Stats calculadas desde eventos
Los campos `goals`, `assists`, `yellowCards`, `redCards` NO existen en `local_players`.
Todas las stats se calculan desde `match_events` en los endpoints `local-topscorers`, `local-topassists`, `local-topcards`, `player-stats`.

### Filtros de eventos — CRÍTICO
Siempre usar `e.player` y NUNCA `e.event.player` en los filtros de eventos.
El join pone el jugador en `e.player`, no en `e.event.player`.
```ts
// CORRECTO:
const goalEvents = events.filter((e: any) => e.event.type === 'goal' && e.player)
// INCORRECTO (bug conocido):
const goalEvents = events.filter((e: any) => e.event.type === 'goal' && e.event.player)
```

### Favorites solo en localStorage
La tabla `favorites` NO existe en Neon. Los favoritos se manejan únicamente con localStorage en el cliente. La pantalla `/favorites` fue eliminada. No crear endpoints de favorites.

### Fechas y timezone
Las fechas se guardan en UTC en Neon. Para mostrarlas siempre parsear sin conversión de timezone:
```ts
// CORRECTO:
const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
return new Date(y, m - 1, d).toLocaleDateString('es-AR', ...)
// INCORRECTO (muestra un día anterior):
new Date(dateStr).toLocaleDateString('es-AR', ...)
```
Para guardar fechas desde `datetime-local` sin conversión:
```ts
// CORRECTO: agregar Z para que se guarde como UTC sin conversión
scheduledAt: dateValue + ':00.000Z'
// INCORRECTO: new Date() convierte a UTC restando 3 horas
scheduledAt: new Date(dateValue).toISOString()
```

### Handler de local.ts — orden de recursos
Los recursos que NO necesitan `tournamentId` deben ir ANTES del check `if (!tournamentId) return err(...)`.
Recursos sin tournamentId: `active-tournament`, `team`, `team-fixtures`, `team-tournaments`, `match-lineup`.
Si se agregan nuevos recursos sin tournamentId, ponerlos antes del check.

### tournamentId: 0 bloquea el handler
Nunca pasar `tournamentId: 0` en requests a `/local`. El check `if (!tournamentId)` lo bloquea.
Los hooks que llaman a recursos sin tournamentId no deben incluir el parámetro `tournamentId`.

### allowCrossGroup
Campo en `tournaments`. Cuando es `false`, el form de nuevo partido en admin muestra selector de grupo y filtra equipos por grupo. Cuando es `true`, muestra todos los equipos.

### Cross-group standings — CRÍTICO
Al calcular standings de un grupo, filtrar partidos por los equipos del grupo (NO por groupId):
```ts
// CORRECTO:
const relevantMatches = allMatches.filter(m =>
  m.phase === 'group' && (groupTeamIds.has(m.homeTeamId) || groupTeamIds.has(m.awayTeamId))
)
// INCORRECTO (pierde partidos cross-group):
const relevantMatches = allMatches.filter(m => m.groupId === group.id)
```

### getTournamentEvents — debe estar fuera del handler
Esta función debe estar declarada FUERA del handler de local.ts (no dentro del bloque try).
Firma correcta: `async function getTournamentEvents(db: any, tournamentId: number)`

### Logos en R2
Los logos se almacenan en Cloudflare R2. Variables de entorno: `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`.
El script para poblar logos está en `scripts/seed-logos-wikidata.ts`.

### PWA orientación
- Mobile (teléfonos): se lockea a portrait con `screen.orientation.lock('portrait')`
- Detección: `/iPhone|Android.*Mobile|Windows Phone/i.test(navigator.userAgent)`
- Tablet: no tiene "Mobile" en userAgent — puede rotar libremente
- Manifest usa `orientation: 'any'`

## Endpoints admin.ts
Todos requieren header `x-admin-token`. Acciones disponibles:
- `auth` POST — verificar password
- `tournament` GET — datos completos del torneo (grupos, partidos)
- `tournaments` GET — lista todos los torneos
- `activate-tournament` POST — cambia el torneo activo
- `activate-knockout` POST — setea knockoutStarted=true en el torneo
- `generate-knockout` POST — genera partidos de octavos desde standings + bracketRules
- `set-match-date` PATCH — actualiza solo la fecha de un partido
- `setup-tournament` POST — crea torneo nuevo (acepta allowCrossGroup)
- `setup-group` POST — crea grupo
- `setup-team` POST — crea equipo y lo agrega a grupo
- `matches` POST/PATCH — crear/actualizar partido
- `bracket-rules` GET/POST/DELETE — CRUD reglas de eliminatoria
- `create-event` POST — crea incidencia
- `update-event` PATCH — edita incidencia (minuto/jugador)
- `delete-event` DELETE — borra incidencia
- `set-lineup` POST — guarda alineación completa de ambos equipos
- `create-player` POST — crea jugador local (acepta position)
- `edit-player` POST — edita jugador existente
- `teams` GET — lista equipos
- `assign-team` POST — agrega equipo existente a grupo
- `remove-team` DELETE — quita equipo de grupo
- `delete-tournament` DELETE — borra torneo (cascade)

## Endpoints local.ts (lectura pública)
- `active-tournament` — torneo activo (sin tournamentId)
- `team` — info de equipo por teamId (sin tournamentId)
- `team-fixtures` — partidos del equipo, acepta `all=true` para todos (sin tournamentId)
- `team-tournaments` — torneos en que participa el equipo (sin tournamentId)
- `match-lineup` — alineación de un partido (sin tournamentId)
- `standings` — tabla de posiciones por torneo
- `fixtures` — partidos por fecha/matchday, incluye `eventCount`
- `knockout-fixtures` — partidos de fase eliminatoria, acepta `round` para filtrar
- `match-detail` — partido completo con eventos
- `match-events` — incidencias de un partido
- `local-topscorers/topassists/topcards` — rankings calculados desde eventos
- `player-stats` — stats individuales (usa lineups si existen, fallback a eventos)
- `local-players` — todos los jugadores del torneo
- `players-by-team` — jugadores de un equipo (todos los torneos)
- `tournament-teams` — equipos de un torneo

## Tipos de eventos (match_events.type)
No hay enum en DB, es varchar libre. Valores usados:
`goal`, `assist`, `yellow`, `red`, `sub`, `save`
- `save`: penal atajado, registrado para el arquero del equipo que atajó

## ESPN Import (ESPNImportModal.tsx)
5 pasos: auth → input → mapping → reconcile → preview → done
- API pública: `https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/summary?event={id}`
- Ligas: `arg.1` (LPF), `conmebol.libertadores`, `conmebol.sudamericana`, `uefa.champions`, etc.
- Eventos en `data.keyEvents`, lineups en `data.rosters`
- Penales atajados: `type.includes('saved')` → registrar `save` para arquero contrario
- Posiciones ESPN: `GK→Arquero`, `DF→Defensor`, `MF→Volante`, `FW→Delantero` (y variantes)
- Minuto: parsear `clock.displayValue` (puede ser "90 + 3") — `clock.value` se clava en 5400
- Reconciliación: auto-match por apellido, confirmar con botón "Vincular" que bloquea el select
- Jugadores nuevos se crean con `mutateAsync` antes de crear los eventos

## Wikidata
Hook `useWikidata(teamName)` busca info del club:
- P154: logo, P18: imagen (fallback), P571: fundación, P115: estadio, P1083: capacidad, P856: web
- CORS habilitado, se llama directo desde el cliente
- Cache de 24h

## Variables de entorno (.env)
```
FOOTBALL_API_KEY=
DATABASE_URL=
NEWS_API_KEY=
ADMIN_PASSWORD=
PORT=3000
CLIENT_URL=http://localhost:5173
R2_ACCOUNT_ID=
R2_ACCESS_KEY=
R2_SECRET_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
BLOB_READ_WRITE_TOKEN=
```

## Bugs conocidos / resueltos (no reintroducir)
1. **e.player vs e.event.player** — ver sección de filtros de eventos arriba
2. **Fechas timezone** — ver sección de fechas arriba
3. **Cross-group standings** — ver sección arriba
4. **tournamentId: 0** — bloquea el handler, no pasar ese valor
5. **getTournamentEvents scope** — debe estar fuera del handler
6. **shortName truncation** — `(shortName || name).slice(0, 20)` al insertar equipo
7. **favorites en schema** — NO existe, no agregar, pantalla eliminada
8. **Fechas knockout** — usar `dateValue + ':00.000Z'` al guardar, no `new Date(dateValue).toISOString()`
9. **LineupPanel** — un solo botón guarda ambos equipos; `homeSelected`/`awaySelected` son estados separados para no perder selección al cambiar de tab

## Stack
- **Frontend**: React + TypeScript + Tailwind + Vite + TanStack Router/Query
- **Backend**: Express (dev) / Vercel Serverless Functions (prod)
- **DB**: Neon PostgreSQL + Drizzle ORM
- **API externa**: API-Football (api-sports.io) — plan free, season 2024
- **Deploy**: Vercel (Hobby plan, máx 12 funciones serverless)
- **PWA**: vite-plugin-pwa, orientation: 'any' en manifest
- **Storage logos**: Cloudflare R2

## Estructura de archivos clave
```
api/
  admin.ts          ← CRUD partidos, jugadores, eventos, lineup, torneo
  local.ts          ← endpoints de lectura: standings, fixtures, stats, etc.
  bracket/index.ts  ← cálculo de eliminatoria
  _lib/
    tournament-schema.ts  ← schema Drizzle completo
    helpers.ts

client/src/
  routes/
    index.tsx           ← Home
    standings.tsx       ← Posiciones
    fixtures.tsx        ← Fixtures
    bracket.tsx         ← Eliminatoria
    players.tsx         ← Jugadores / stats
    team.$teamId.tsx    ← Plantel + partidos del equipo
    match.$matchId.tsx  ← Detalle del partido
  components/
    MatchEventsPanel.tsx   ← Cargar/editar incidencias
    LineupPanel.tsx        ← Cargar alineación
    ESPNImportModal.tsx    ← Importar desde ESPN API
    LocalPlayerModal.tsx   ← Stats del jugador
    AddPlayerModal.tsx     ← Agregar jugador
    TeamBadge.tsx          ← Logo o iniciales con color determinístico
  hooks/
    useActiveTournament.ts
    useLocalPlayers.ts     ← incluye usePlayerStats, useTournamentTeams, useTeamTournaments
    useMatchEvents.ts
    useMatchLineup.ts
    useTeamFixtures.ts
    useWikidata.ts
```

## Schema DB (tablas principales)
- `tournaments`: id, name, shortName, season, hasGroups, qualifiersPerGroup, active, allowCrossGroup
- `teams`: id, name, shortName, logoUrl, country, externalId
- `groups`: id, tournamentId, name
- `groupTeams`: groupId, teamId
- `matches`: id, tournamentId, phase, status, groupId, matchday, knockoutRound, bracketPosition, homeTeamId, awayTeamId, homeScore, awayScore, homePenalties, awayPenalties, scheduledAt
- `bracketRules`: tournamentId, knockoutRound, bracketPosition, homeGroupId, homePosition, awayGroupId, awayPosition, homeWinnerOf, awayWinnerOf
- `localPlayers`: id, firstName, lastName, teamId, tournamentId, position
- `matchEvents`: id, matchId, minute, type, playerId, playerOutId, teamId, isPenalty, isOwnGoal
- `matchLineups`: id, matchId, teamId, playerId, isStarter, shirtNumber

## Decisiones técnicas críticas

### Stats calculadas desde eventos
Los campos `goals`, `assists`, `yellowCards`, `redCards` NO existen en `local_players`.
Todas las stats se calculan desde `match_events` en los endpoints `local-topscorers`, `local-topassists`, `local-topcards`, `player-stats`.

### Filtros de eventos — CRÍTICO
Siempre usar `e.player` y NUNCA `e.event.player` en los filtros de eventos.
El join pone el jugador en `e.player`, no en `e.event.player`.
```ts
// CORRECTO:
const goalEvents = events.filter((e: any) => e.event.type === 'goal' && e.player)
// INCORRECTO (bug conocido):
const goalEvents = events.filter((e: any) => e.event.type === 'goal' && e.event.player)
```

### Favorites solo en localStorage
La tabla `favorites` NO existe en Neon. Los favoritos se manejan únicamente con localStorage en el cliente. Nunca crear endpoints de favorites.

### Fechas y timezone
Las fechas se guardan en UTC en Neon. Para mostrarlas siempre parsear sin conversión de timezone:
```ts
// CORRECTO:
const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
return new Date(y, m - 1, d).toLocaleDateString('es-AR', ...)
// INCORRECTO (muestra un día anterior):
new Date(dateStr).toLocaleDateString('es-AR', ...)
```

### Handler de local.ts — orden de recursos
Los recursos que NO necesitan `tournamentId` deben ir ANTES del check `if (!tournamentId) return err(...)`.
Recursos sin tournamentId: `active-tournament`, `team`, `team-fixtures`, `team-tournaments`, `match-lineup`.
Si se agregan nuevos recursos sin tournamentId, ponerlos antes del check.

### tournamentId: 0 bloquea el handler
Nunca pasar `tournamentId: 0` en requests a `/local`. El check `if (!tournamentId)` lo bloquea.
Los hooks que llaman a recursos sin tournamentId no deben incluir el parámetro `tournamentId`.

### allowCrossGroup
Campo en `tournaments`. Cuando es `false`, el form de nuevo partido en admin muestra selector de grupo y filtra equipos por grupo. Cuando es `true`, muestra todos los equipos.

### Cross-group standings — CRÍTICO
Al calcular standings de un grupo, filtrar partidos por los equipos del grupo (NO por groupId):
```ts
// CORRECTO:
const relevantMatches = allMatches.filter(m =>
  m.phase === 'group' && (groupTeamIds.has(m.homeTeamId) || groupTeamIds.has(m.awayTeamId))
)
// INCORRECTO (pierde partidos cross-group):
const relevantMatches = allMatches.filter(m => m.groupId === group.id)
```

### getTournamentEvents — debe estar fuera del handler
Esta función debe estar declarada FUERA del handler de local.ts (no dentro del bloque try).
Firma correcta: `async function getTournamentEvents(db: any, tournamentId: number)`

### Logos en R2
Los logos se almacenan en Cloudflare R2. Variables de entorno: `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`.
El script para poblar logos está en `scripts/seed-logos-wikidata.ts`.

### PWA orientación
- Mobile (teléfonos): se lockea a portrait con `screen.orientation.lock('portrait')`
- Tablet: se detecta por ausencia de "Mobile" en userAgent — puede rotar libremente
- Manifest usa `orientation: 'any'`

## Endpoints admin.ts
Todos requieren header `x-admin-token`. Acciones disponibles:
- `auth` POST — verificar password
- `tournament` GET — datos completos del torneo (grupos, partidos)
- `tournaments` GET — lista todos los torneos
- `activate-tournament` POST — cambia el torneo activo
- `setup-tournament` POST — crea torneo nuevo
- `setup-group` POST — crea grupo
- `setup-teams` POST — agrega equipos a grupo
- `matches` GET/POST/PATCH — CRUD partidos
- `bracket-rules` GET — reglas de eliminatoria
- `create-bracket-rule` POST — crea regla
- `delete-bracket-rule` DELETE — borra regla
- `create-event` POST — crea incidencia
- `update-event` PATCH — edita incidencia (minuto/jugador)
- `delete-event` DELETE — borra incidencia
- `set-lineup` POST — guarda alineación completa de un equipo
- `create-player` POST — crea jugador local
- `teams` GET — lista equipos
- `assign-team` POST — agrega equipo existente a grupo
- `remove-team` DELETE — quita equipo de grupo
- `delete-tournament` DELETE — borra torneo (cascade)

## Tipos de eventos (match_events.type)
No hay enum en DB, es varchar libre. Valores usados:
`goal`, `assist`, `yellow`, `red`, `sub`, `save`
- `save`: penal atajado, registrado para el arquero del equipo que atajó

## ESPN Import
- API pública: `https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/summary?event={id}`
- Ligas: `arg.1` (LPF), `conmebol.libertadores`, `conmebol.sudamericana`, `uefa.champions`, etc.
- Los eventos vienen en `data.keyEvents`
- Penales atajados: `type.includes('saved')` → registrar `save` para arquero contrario
- Posiciones ESPN: `GK→Arquero`, `DF→Defensor`, `MF→Volante`, `FW→Delantero` (y variantes)
- Minuto: parsear `clock.displayValue` (puede ser "90 + 3") en lugar de `clock.value` (se clava en 5400)

## Wikidata
Hook `useWikidata(teamName)` busca info del club:
- P154: logo, P18: imagen (fallback), P571: fundación, P115: estadio, P1083: capacidad, P856: web
- CORS habilitado, se llama directo desde el cliente
- Cache de 24h

## Variables de entorno (.env)
```
FOOTBALL_API_KEY=
DATABASE_URL=
NEWS_API_KEY=
ADMIN_PASSWORD=
PORT=3000
CLIENT_URL=http://localhost:5173
R2_ACCOUNT_ID=
R2_ACCESS_KEY=
R2_SECRET_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
BLOB_READ_WRITE_TOKEN=
```

## Bugs conocidos / resueltos (no reintroducir)
1. **e.player vs e.event.player** — ver sección de filtros de eventos arriba
2. **Fechas timezone** — ver sección de fechas arriba
3. **Cross-group standings** — ver sección arriba
4. **tournamentId: 0** — bloquea el handler, no pasar ese valor
5. **getTournamentEvents scope** — debe estar fuera del handler
6. **shortName truncation** — `(shortName || name).slice(0, 20)` al insertar equipo
7. **favorites en schema** — NO existe, no agregar