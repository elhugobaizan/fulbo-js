# Fútbol AR — Contexto del Proyecto

> Este archivo es la referencia rápida para cualquier agente de IA (o persona) que trabaje en este repo. Mantenerlo actualizado cuando cambie algo acá descripto — es más rápido de leer que descubrir todo esto de nuevo leyendo código.

## Qué es

App de fútbol argentino. Combina datos de ligas profesionales vía API-Football (standings, fixtures, noticias) con un sistema propio de **torneos locales** — grupos, fixtures, fase eliminatoria con wildcards, jugadores, eventos de partido — administrado desde un panel protegido por token. Soporta tanto torneos de clubes como de **selecciones nacionales** (ej. tipo Mundial/Copa América).

## Stack

- **Frontend**: React 18 + TypeScript + Tailwind + Vite + TanStack Router/Query
- **Backend**: Express (dev, `server.ts`) / Vercel Serverless Functions (prod, `api/*.ts`) — mismo código de handler en ambos casos, `server.ts` solo envuelve los handlers con `wrap()`
- **DB**: Neon PostgreSQL + Drizzle ORM (`drizzle-orm/neon-http`, driver HTTP, no pool TCP)
- **API externa**: API-Football (api-sports.io) — plan free, season 2024
- **Deploy**: Vercel (Hobby plan, máx 12 funciones serverless — hoy usa 5: `admin`, `local`, `bracket`, `football`, `news`). Vercel **no** acepta Dockerfile para este modelo de deploy; construye las funciones directo desde `api/*.ts`.
- **PWA**: vite-plugin-pwa, orientation: `'any'` en manifest, lock a portrait en móviles vía JS
- **Storage logos**: Cloudflare R2

## Estructura de archivos clave

```
api/
  admin.ts          ← CRUD partidos, jugadores, eventos, lineup, torneo, selecciones, bracket-rules (protegido por x-admin-token)
  local.ts          ← endpoints de lectura pública: standings, fixtures, stats, etc.
  bracket/index.ts  ← cálculo de eliminatoria (árbol completo para BracketView)
  football.ts       ← proxy a API-Football
  news/index.ts     ← proxy a News API
  _lib/
    tournament-schema.ts  ← schema Drizzle completo
    helpers.ts             ← ok()/err()/requireParam()
    footballApi.ts

client/src/
  routes/
    index.tsx           ← Home (favoritos, en vivo, noticias)
    standings.tsx        ← Posiciones
    fixtures.tsx          ← Fixtures (grupos + eliminatoria integrada)
    bracket.tsx            ← Eliminatoria (árbol visual público)
    players.tsx             ← Jugadores / stats
    team.$teamId.tsx         ← Partidos + Plantel del equipo
    match.$matchId.tsx        ← Detalle del partido
    favorites.tsx              ← Página de favoritos (ver nota más abajo)
    setup.tsx                   ← Wizard admin: crear torneo → grupos → equipos/selecciones (protegido)
    admin.tsx                    ← Panel admin: torneo activo, partidos, eventos, lineups, bracket-rules, fase eliminatoria
  components/
    BracketView.tsx        ← Árbol de eliminatoria desktop + lista mobile (vista pública, sin token puede solo ver; con token en sessionStorage puede cargar resultados)
    KnockoutSection.tsx    ← Sección de fase eliminatoria dentro del panel admin: generar rondas, editar fecha, editar equipo de un slot wildcard
    MatchEventsPanel.tsx   ← Cargar/editar incidencias
    LineupPanel.tsx        ← Cargar alineación (un solo botón guarda ambos equipos)
    ESPNImportModal.tsx    ← Importar partido desde ESPN API (5 pasos)
    LocalPlayerModal.tsx   ← Stats del jugador
    AddPlayerModal.tsx     ← Agregar jugador
    TeamBadge.tsx          ← Logo o iniciales con color determinístico
  hooks/
    useActiveTournament.ts
    useBracket.ts           ← trae el árbol completo desde /api/bracket
    useLocalPlayers.ts      ← incluye usePlayerStats, useTournamentTeams, useTeamTournaments
    useMatchEvents.ts       ← incluye useUpdateEvent
    useMatchLineup.ts
    useTeamFixtures.ts      ← acepta all=true para traer todos los partidos
    useFavorites.ts
    useWikidata.ts
  lib/
    api.ts       ← axios client, baseURL '/api'
    date.ts       ← formatMatchDate, formatMatchDateShort, formatMatchDateParts, formatTimeAgo — todos parsean sin conversión de timezone
    favorites.ts
```

## Schema DB (tablas principales)

- `tournaments`: id, name, shortName, country, season, logoUrl, hasGroups, active, qualifiersPerGroup, allowCrossGroup, knockoutStarted, teamType (`'club' | 'national'`), wildcardQualifiers
- `teams`: id, name, shortName, logoUrl, country, externalId, color, alternateColor
- `nationalTeams`: id, name, fifaCode, confederation, flagUrl, color, alternateColor — selecciones, tabla separada de `teams`
- `groups`: id, tournamentId, name
- `groupTeams`: id, groupId, teamId (nullable), nationalTeamId (nullable) — uno de los dos según `tournament.teamType`
- `matches`: id, tournamentId, phase (`group|knockout`), status, groupId, matchday, knockoutRound, bracketPosition, homeTeamId, awayTeamId, homeNationalTeamId, awayNationalTeamId, homeScore, awayScore, homePenalties, awayPenalties, espnMatchId, scheduledAt
- `bracketRules`: tournamentId, knockoutRound, bracketPosition, homeGroupId, homePosition, awayGroupId, awayPosition, homeWinnerOf, awayWinnerOf, wildcardGroupIds (varchar, ids separados por coma)
- `localPlayers`: id, firstName, lastName, teamId, tournamentId, position, externalId
- `matchEvents`: id, matchId, minute, type, playerId, playerOutId, teamId, isPenalty, isOwnGoal
- `matchLineups`: id, matchId, teamId, playerId, isStarter, shirtNumber

**Importante**: aunque `matches` tiene columnas dedicadas `homeNationalTeamId`/`awayNationalTeamId`, **no se usan en ningún lado del código**. Los partidos de torneos de selecciones guardan el id de la selección en las mismas columnas `homeTeamId`/`awayTeamId` que los de clubes; se resuelve cuál tabla mirar (`teams` vs `nationalTeams`) según `tournament.teamType === 'national'`.

## Fase eliminatoria

- `tournaments.knockoutStarted = true` habilita la generación de partidos knockout
- `admin.ts` endpoint `generate-knockout` genera los partidos de una ronda desde standings + `bracketRules`
- Los partidos knockout tienen `phase: 'knockout'` y `knockoutRound: 'round_of_16' | 'quarterfinal' | 'semifinal' | 'final'` (también existen `round_of_64`/`round_of_32`/`third_place` en el enum, sin uso actual)
- `set-match-date` PATCH actualiza solo la fecha de un partido knockout
- En fixtures, la "Eliminatoria" aparece como una fecha especial después de la última fecha de grupos
- Al guardar fecha desde el frontend: usar `dateValue + ':00.000Z'` para evitar conversión de timezone

### Wildcards (ej. "3° de B, C o D")

Un slot de `bracketRules` es wildcard cuando `homeGroupId`/`awayGroupId` es `null` y `wildcardGroupIds` tiene valor (ids de grupos separados por coma). El label se arma como `{homePosition}° {grupos}` (ver `WildcardSlotLabel` en `KnockoutSection.tsx`).

**Ojo con la discrepancia entre generación y edición manual:**
- `generate-knockout` (auto) arma un **pool global compartido** por ronda: junta TODOS los grupos referenciados por CUALQUIER regla wildcard de esa ronda, los rankea juntos usando `tournament.qualifiersPerGroup` como posición, y va asignando el siguiente mejor equipo del pool a cada slot en orden de `bracketPosition` (home antes que away). Es decir, qué equipo real termina en qué cruce depende del orden de iteración, no necesariamente coincide con un sorteo real — de ahí que a veces "no se generen como en la realidad".
- El endpoint `wildcard-candidates` (usado para la edición manual, ver abajo) en cambio calcula candidatos **por regla individual**: usa `wildcardGroupIds` y `homePosition`/`awayPosition` de ESA regla puntual, no el pool global. Es el scope correcto para "elegí cuál de estos va acá", pero no intentes usarlo para replicar/depurar la lógica de auto-generación — son cálculos distintos a propósito.

**Corregir manualmente un cruce wildcard mal generado:**
- `GET /admin?action=wildcard-candidates&tournamentId&knockoutRound&bracketPosition&side=home|away` → lista los equipos elegibles (los que terminaron en la posición configurada, dentro de los grupos de `wildcardGroupIds` de esa regla) con sus stats.
- `PATCH /admin?action=set-match-team` con `{ matchId, side, teamId }` → sobreescribe directamente `homeTeamId`/`awayTeamId` del partido, sin tocar la lógica de generación.
- En el panel admin (`KnockoutSection.tsx`), cada equipo de un cruce wildcard no finalizado tiene un ícono de lápiz para disparar este flujo.

## Decisiones técnicas críticas

### Stats calculadas desde eventos
Los campos `goals`, `assists`, `yellowCards`, `redCards` NO existen en `local_players`. Todas las stats se calculan desde `match_events` en los endpoints `local-topscorers`, `local-topassists`, `local-topcards`, `player-stats`.

### Filtros de eventos — CRÍTICO
Siempre usar `e.player` y NUNCA `e.event.player` en los filtros de eventos. El join pone el jugador en `e.player`, no en `e.event.player`.
```ts
// CORRECTO:
const goalEvents = events.filter((e: any) => e.event.type === 'goal' && e.player)
// INCORRECTO (bug conocido):
const goalEvents = events.filter((e: any) => e.event.type === 'goal' && e.event.player)
```

### Favorites solo en localStorage
La tabla `favorites` NO existe en Neon. Los favoritos se manejan únicamente con localStorage en el cliente (`lib/favorites.ts` + `useFavorites.ts`). No crear endpoints de favorites.

**La ruta `/favorites` no está enlazada en `BottomNav` — es intencional, no "arreglarlo".** La sección "Mis equipos" del Home ya cubre ese uso; la página sigue existiendo y es accesible por URL directa, pero no se agrega al nav.

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
Los recursos que NO necesitan `tournamentId` deben ir ANTES del check `if (!tournamentId) return err(...)`. Recursos sin tournamentId hoy: `active-tournament`, `team`, `team-fixtures`, `team-tournaments`, `match-lineup`. Si se agregan nuevos recursos sin tournamentId, ponerlos antes del check.

### tournamentId: 0 bloquea el handler
Nunca pasar `tournamentId: 0` en requests a `/local`. El check `if (!tournamentId)` lo bloquea. Los hooks que llaman a recursos sin tournamentId no deben incluir el parámetro `tournamentId`.

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
Esta función debe estar declarada FUERA del handler de local.ts (no dentro del bloque try). Firma correcta: `async function getTournamentEvents(db: any, tournamentId: number)`.

### Logos en R2
Los logos se almacenan en Cloudflare R2. Variables de entorno: `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`. Scripts de seed en `scripts/seed-logos*.ts`.

### Autenticación admin — token de sesión firmado, no el password
`api/_lib/auth.ts` centraliza todo. El flujo es:
- `action=auth` POST: compara el password contra `ADMIN_PASSWORD` con `crypto.timingSafeEqual` sobre hashes SHA-256 (no `===` directo, evita timing attacks). Si es correcto, devuelve `{ authenticated: true, token }` — el `token` es `"{expiresAt}.{hmacSha256Hex}"`, firmado con `ADMIN_TOKEN_SECRET` (o `ADMIN_PASSWORD` como fallback si esa env var no está seteada), válido 24hs.
- `checkAuth()` en `admin.ts` valida la firma HMAC (constant-time) y la expiración del token — nunca compara contra el password.
- El cliente guarda ese `token` (no el password) en `sessionStorage` bajo la key `'futbol-ar:admin-token'` (constante `ADMIN_TOKEN_KEY` en `config/rounds.ts` — varios componentes la redeclaran como `STORAGE_KEY` local en vez de importarla, es duplicación menor conocida) y lo reenvía en el header `x-admin-token`.
- **Por qué importa**: antes el token ERA el password en texto plano — cualquier lugar que lo leyera (sessionStorage, un log, XSS) exponía la credencial real y sin expiración. Ahora un token filtrado expira solo y no revela el password.
- Todos los flujos de login (`LoginForm` en `admin.tsx`/`setup.tsx`, y los mini-forms de password en `AddPlayerModal`, `ESPNImportModal`, `LineupPanel`, `MatchEventsPanel`, `ResultModal` en `fixtures.tsx`) comparten la misma key de sessionStorage, así que autenticarse en cualquiera de ellos autentica a todos — pedir el password una sola vez por sesión de pestaña sigue siendo el comportamiento esperado, no cambiarlo.

### PWA orientación
- Mobile (teléfonos): se lockea a portrait con `screen.orientation.lock('portrait')`
- Detección: `/iPhone|Android.*Mobile|Windows Phone/i.test(navigator.userAgent)`
- Tablet: no tiene "Mobile" en userAgent — puede rotar libremente
- Manifest usa `orientation: 'any'`

## Endpoints admin.ts

Todos (salvo `auth`) requieren header `x-admin-token`. Acciones disponibles:

| Acción | Método | Qué hace |
|---|---|---|
| `auth` | POST | Verificar password |
| `tournament` | GET | Datos completos del torneo (grupos con equipos, partidos) |
| `tournaments` | GET | Lista todos los torneos |
| `activate-tournament` | POST | Cambia el torneo activo |
| `delete-tournament` | DELETE | Borra torneo (cascade: matches, bracket-rules, group-teams, groups) |
| `setup-tournament` | POST | Crea torneo nuevo (acepta `allowCrossGroup`, `teamType`, `wildcardQualifiers`) |
| `setup-group` | POST | Crea grupo |
| `setup-team` | POST | Crea equipo y lo agrega a grupo |
| `teams` | GET/POST | Lista equipos / crea equipo suelto |
| `assign-team` | POST | Agrega equipo existente a grupo |
| `remove-team` | DELETE | Quita equipo de grupo |
| `national-teams` | GET | Lista selecciones nacionales |
| `setup-national-team` | POST | Crea selección (upsert por `fifaCode`) |
| `assign-national-team` | POST | Agrega selección existente a grupo |
| `remove-national-team` | DELETE | Quita selección de grupo |
| `matches` | POST/PATCH | Crear/actualizar partido (resultado, penales, status, espnMatchId) |
| `bracket-rules` | GET/POST/DELETE | CRUD reglas de eliminatoria (incluye `wildcardGroupIds`) |
| `activate-knockout` | POST | Setea `knockoutStarted=true` en el torneo |
| `generate-knockout` | POST | Genera partidos de una ronda desde standings + bracket-rules |
| `set-match-date` | PATCH | Actualiza solo la fecha de un partido |
| `wildcard-candidates` | GET | Lista equipos elegibles para un slot wildcard puntual (ver sección Fase eliminatoria) |
| `set-match-team` | PATCH | Sobreescribe manualmente `homeTeamId`/`awayTeamId` de un partido |
| `create-event` / `update-event` / `delete-event` | POST/PATCH/DELETE | CRUD incidencias de partido |
| `create-player` / `edit-player` | POST | CRUD jugador local |
| `set-lineup` | POST | Guarda alineación completa de un equipo en un partido |

## Endpoints local.ts (lectura pública)

Recursos sin `tournamentId`: `active-tournament`, `team`, `team-fixtures`, `team-tournaments`, `match-lineup`.

Resto (requieren `tournamentId`): `standings`, `fixtures`, `upcoming`, `knockout-fixtures` (acepta `round` para filtrar), `match-detail`, `match-events`, `local-topscorers`, `local-topassists`, `local-topcards`, `player-stats` (usa lineups si existen, fallback a eventos), `local-players`, `players-by-team`, `tournament-teams`.

## Tipos de eventos (match_events.type)
No hay enum en DB, es varchar libre. Valores usados: `goal`, `assist`, `yellow`, `red`, `sub`, `save`
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
ADMIN_TOKEN_SECRET=   # opcional — si no está, se firma con ADMIN_PASSWORD
PORT=3000
CLIENT_URL=http://localhost:5173
R2_ACCOUNT_ID=
R2_ACCESS_KEY=
R2_SECRET_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
BLOB_READ_WRITE_TOKEN=
```

## Problemas conocidos del entorno (no son bugs de la app)

- **`npm run lint` en `client/` está roto**: el script existe en `package.json` pero no hay `eslint.config.js` ni `eslint` en devDependencies.
- **Verificar UI en sandboxes sin salida TLS libre**: algunos entornos de desarrollo aislados no pueden conectar a Neon (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`) — no es un bug del código, es una restricción del entorno. Para verificar cambios visuales sin DB real, montar una ruta temporal que renderice el componente con props/datos mockeados, tomar screenshot, y borrar la ruta antes de terminar.

## Bugs conocidos / resueltos (no reintroducir)
1. **e.player vs e.event.player** — ver sección de filtros de eventos arriba
2. **Fechas timezone** — ver sección de fechas arriba
3. **Cross-group standings** — ver sección arriba
4. **tournamentId: 0** — bloquea el handler, no pasar ese valor
5. **getTournamentEvents scope** — debe estar fuera del handler
6. **shortName truncation** — `(shortName || name).slice(0, 20)` al insertar equipo
7. **favorites en schema** — NO existe la tabla, no agregarla; la pantalla sí existe pero fuera del nav (intencional)
8. **Fechas knockout** — usar `dateValue + ':00.000Z'` al guardar, no `new Date(dateValue).toISOString()`
9. **LineupPanel** — un solo botón guarda ambos equipos; `homeSelected`/`awaySelected` son estados separados para no perder selección al cambiar de tab
10. **Wildcard: pool global vs candidatos por regla** — ver sección "Wildcards" arriba, no son el mismo cálculo a propósito
