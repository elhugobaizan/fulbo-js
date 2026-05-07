import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { apiClient } from '../lib/api'
import type { Bracket, BracketSlot } from '../hooks/useBracket'

const ROUND_LABELS: Record<string, string> = {
  round_of_16: 'Octavos',
  quarterfinal: 'Cuartos',
  semifinal: 'Semifinal',
  final: 'Final',
}

// ─── Match Card ───────────────────────────────────────────────────────────────

function MatchCard({ slot, onEdit, compact = false }: { slot: BracketSlot; onEdit: () => void; compact?: boolean }) {
  const match = slot.match
  const isFinished = match?.status === 'finished'

  const homeWon = isFinished && match && (
    match.homePenalties !== null
      ? match.homePenalties > (match.awayPenalties ?? 0)
      : (match.homeScore ?? 0) > (match.awayScore ?? 0)
  )
  const awayWon = isFinished && !homeWon

  const dateStr = !isFinished && match?.scheduledAt
    ? (() => { const [, m, d] = match.scheduledAt.split('T')[0].split('-').map(Number); return { day: d, month: new Date(2000, m - 1, 1).toLocaleDateString('es-AR', { month: 'short' }) } })()
    : null

  return (
    <button
      onClick={onEdit}
      style={{ minWidth: compact ? 140 : 160 }}
      className={`
        w-full rounded-xl border overflow-hidden transition-all text-left
        ${isFinished ? 'border-gray-700 bg-gray-900/60' : 'border-dashed border-gray-700 bg-gray-900/30 hover:border-gray-500'}
      `}
    >
      <div className="flex items-stretch">
        {/* Date column */}
        {dateStr && (
          <div className="flex flex-col items-center justify-center px-1.5 border-r border-gray-800 min-w-[28px]">
            <span className="text-[9px] text-gray-500 capitalize leading-none">{dateStr.month}</span>
            <span className="text-xs font-bold text-gray-400 leading-none mt-0.5">{dateStr.day}</span>
          </div>
        )}
        {/* Teams column */}
        <div className="flex-1 min-w-0">
          <div className={`flex items-center gap-1.5 px-2.5 py-2 ${homeWon ? 'bg-gray-700/60' : ''}`}>
            {slot.homeTeam?.logoUrl
              ? <img src={slot.homeTeam.logoUrl} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
              : <div className="w-4 h-4 rounded-full bg-gray-700 flex-shrink-0" />
            }
            <span className={`text-xs flex-1 truncate ${homeWon ? 'text-white font-medium' : 'text-gray-300'}`}>
              {slot.homeLabel}
            </span>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {match?.homePenalties != null && (
                <span className="text-[9px] text-yellow-400">({match.homePenalties})</span>
              )}
              <span className={`text-xs font-bold w-4 text-center ${homeWon ? 'text-white' : 'text-gray-500'}`}>
                {isFinished ? match?.homeScore ?? 0 : ''}
              </span>
            </div>
          </div>
          <div className="h-px bg-gray-800" />
          <div className={`flex items-center gap-1.5 px-2.5 py-2 ${awayWon ? 'bg-gray-700/60' : ''}`}>
            {slot.awayTeam?.logoUrl
              ? <img src={slot.awayTeam.logoUrl} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
              : <div className="w-4 h-4 rounded-full bg-gray-700 flex-shrink-0" />
            }
            <span className={`text-xs flex-1 truncate ${awayWon ? 'text-white font-medium' : 'text-gray-300'}`}>
              {slot.awayLabel}
            </span>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {match?.awayPenalties != null && (
                <span className="text-[9px] text-yellow-400">({match.awayPenalties})</span>
              )}
              <span className={`text-xs font-bold w-4 text-center ${awayWon ? 'text-white' : 'text-gray-500'}`}>
                {isFinished ? match?.awayScore ?? 0 : ''}
              </span>
            </div>
          </div>
        </div>
      </div>
    </button>
  )
}

// ─── Result Modal ─────────────────────────────────────────────────────────────

async function createOrUpdateKnockoutMatch(token: string, slot: BracketSlot, homeScore: number, awayScore: number, homePen: number | null, awayPen: number | null) {
  if (slot.match) {
    const { data } = await apiClient.patch('/admin?action=matches', {
      matchId: slot.match.id, homeScore, awayScore,
      homePenalties: homePen, awayPenalties: awayPen, status: 'finished',
    }, { headers: { 'x-admin-token': token } })
    return data.data
  } else {
    const { data } = await apiClient.post('/admin?action=matches', {
      tournamentId: 1, phase: 'knockout',
      knockoutRound: slot.knockoutRound, bracketPosition: slot.bracketPosition,
      homeTeamId: slot.homeTeam?.id, awayTeamId: slot.awayTeam?.id,
      homeScore, awayScore, homePenalties: homePen, awayPenalties: awayPen, status: 'finished',
    }, { headers: { 'x-admin-token': token } })
    return data.data
  }
}

const STORAGE_KEY = 'futbol-ar:admin-token'

function ResultModal({ slot, onClose }: { slot: BracketSlot; onClose: () => void }) {
  const token = sessionStorage.getItem(STORAGE_KEY) ?? ''
  const [homeScore, setHomeScore] = useState(String(slot.match?.homeScore ?? ''))
  const [awayScore, setAwayScore] = useState(String(slot.match?.awayScore ?? ''))
  const [homePen, setHomePen] = useState(String(slot.match?.homePenalties ?? ''))
  const [awayPen, setAwayPen] = useState(String(slot.match?.awayPenalties ?? ''))
  const queryClient = useQueryClient()

  const showPenalties = homeScore !== '' && awayScore !== '' && Number(homeScore) === Number(awayScore)
  const teamsResolved = slot.homeTeam !== null && slot.awayTeam !== null

  const saveMutation = useMutation<any, Error, void>({
    mutationFn: () => createOrUpdateKnockoutMatch(
      token, slot, Number(homeScore), Number(awayScore),
      showPenalties && homePen !== '' ? Number(homePen) : null,
      showPenalties && awayPen !== '' ? Number(awayPen) : null,
    ),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bracket'] }); onClose() },
  })

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 z-50 bg-gray-900 rounded-xl border border-gray-800 w-full max-w-sm p-6 space-y-4"
        style={{ transform: 'translate(-50%, -50%)' }}>
        <h3 className="font-bold text-white">{ROUND_LABELS[slot.knockoutRound]} · Cruce {slot.bracketPosition}</h3>
        <div className="text-sm text-center space-y-1">
          <p className="text-white font-medium">{slot.homeLabel}</p>
          <p className="text-gray-500 text-xs">vs</p>
          <p className="text-white font-medium">{slot.awayLabel}</p>
        </div>

        {!teamsResolved ? (
          <p className="text-gray-400 text-sm text-center py-2">Los equipos todavía no están definidos.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-white flex-1 text-right truncate">{slot.homeLabel}</span>
              <div className="flex items-center gap-2">
                <input type="number" min="0" value={homeScore} onChange={(e) => setHomeScore(e.target.value)}
                  className="w-14 text-center py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white font-bold text-lg focus:outline-none focus:border-[#74ACDF]" autoFocus />
                <span className="text-gray-500 font-bold">-</span>
                <input type="number" min="0" value={awayScore} onChange={(e) => setAwayScore(e.target.value)}
                  className="w-14 text-center py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white font-bold text-lg focus:outline-none focus:border-[#74ACDF]" />
              </div>
              <span className="text-sm text-white flex-1 truncate">{slot.awayLabel}</span>
            </div>
            {showPenalties && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 flex-1 text-right">Penales</span>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" value={homePen} onChange={(e) => setHomePen(e.target.value)}
                    className="w-14 text-center py-1 rounded-lg bg-gray-800 border border-yellow-600/50 text-yellow-400 font-bold focus:outline-none" />
                  <span className="text-gray-500">-</span>
                  <input type="number" min="0" value={awayPen} onChange={(e) => setAwayPen(e.target.value)}
                    className="w-14 text-center py-1 rounded-lg bg-gray-800 border border-yellow-600/50 text-yellow-400 font-bold focus:outline-none" />
                </div>
                <span className="flex-1" />
              </div>
            )}
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || homeScore === '' || awayScore === ''}
              className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              <Check size={14} />{saveMutation.isPending ? 'Guardando...' : 'Guardar resultado'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}


// ─── Desktop tree bracket ─────────────────────────────────────────────────────
// Layout:
// Octavos 1 ─┐
//             ├─ Cuartos 1 ─┐
// Octavos 8 ─┘              │
//                            ├─ Semi 1 ─┐
// Octavos 4 ─┐              │           │
//             ├─ Cuartos 2 ─┘           ├─ Final
// Octavos 5 ─┘                          │
//                            ├─ Semi 2 ─┘
// Octavos 2 ─┐              │
//             ├─ Cuartos 3 ─┘
// Octavos 7 ─┘
// Octavos 3 ─┐
//             ├─ Cuartos 4 ─┘
// Octavos 6 ─┘

function DesktopBracket({ bracket, onEdit }: { bracket: any; onEdit: (slot: BracketSlot) => void }) {
  const r16 = bracket.round_of_16 ?? []
  const qf = bracket.quarterfinal ?? []
  const sf = bracket.semifinal ?? []
  const fin = bracket.final ?? []

  // Mapas por bracketPosition
  const r16m = Object.fromEntries(r16.map((s: BracketSlot) => [s.bracketPosition, s]))
  const qfm = Object.fromEntries(qf.map((s: BracketSlot) => [s.bracketPosition, s]))
  const sfm = Object.fromEntries(sf.map((s: BracketSlot) => [s.bracketPosition, s]))
  const finm = fin[0] ?? null

  // Grupos de cruces: [octavos top, octavos bottom] → cuarto
  const groups = [
    { r16top: 1, r16bot: 8, qf: 1, sf: 1 },
    { r16top: 4, r16bot: 5, qf: 2, sf: 1 },
    { r16top: 2, r16bot: 7, qf: 3, sf: 2 },
    { r16top: 3, r16bot: 6, qf: 4, sf: 2 },
  ]

  const SlotOrEmpty = ({ slot }: { slot: BracketSlot | undefined }) =>
    slot ? <MatchCard slot={slot} onEdit={() => onEdit(slot)} compact /> : (
      <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/20 p-4 text-center" style={{ minWidth: 140 }}>
        <span className="text-xs text-gray-700">Sin cruce</span>
      </div>
    )

  // Conectores SVG entre columnas
  const CARD_H = 66 // altura aprox de cada card
  const GAP = 8     // gap entre cards del mismo grupo

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-0 items-stretch" style={{ minWidth: 720 }}>

        {/* Octavos */}
        <div className="flex flex-col gap-2" style={{ width: 164 }}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center mb-1">Octavos</p>
          {groups.map(({ r16top, r16bot }, i) => (
            <div key={i} className="flex flex-col gap-2">
              <SlotOrEmpty slot={r16m[r16top]} />
              <SlotOrEmpty slot={r16m[r16bot]} />
              {i < groups.length - 1 && <div className="h-2" />}
            </div>
          ))}
        </div>

        {/* Conectores octavos → cuartos */}
        <div className="flex flex-col" style={{ width: 24, rowGap: '6px' }}>
          <div className="h-5" />
          {groups.map((_, i) => (
            <div key={i} className="flex flex-col" style={{ height: CARD_H * 2 + GAP * 2 + (i < groups.length - 1 ? 10 : 0) }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ width: '50%', height: 1, background: 'rgba(255,255,255,0.15)' }} />
              </div>
              <div style={{ width: '50%', height: CARD_H / 2 + GAP, borderRight: '1px solid rgba(255,255,255,0.15)' }} />
              <div style={{ width: '50%', height: 1, background: 'rgba(255,255,255,0.15)', alignSelf: 'flex-end' }} />
              <div style={{ width: '50%', height: CARD_H / 2 + GAP - 1, borderRight: '1px solid rgba(255,255,255,0.15)' }} />
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start' }}>
                <div style={{ width: '50%', height: 1, background: 'rgba(255,255,255,0.15)' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Cuartos */}
        <div className="flex flex-col" style={{ width: 164, rowGap: '6px' }}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center mb-1">Cuartos</p>
          {groups.map(({ qf: qfPos }, i) => (
            <div key={i} className="flex flex-col" style={{ height: CARD_H * 2 + GAP * 2 + (i < groups.length - 1 ? 10 : 0), justifyContent: 'center' }}>
              <SlotOrEmpty slot={qfm[qfPos]} />
            </div>
          ))}
        </div>

        {/* Conectores cuartos → semis */}
        <div className="flex flex-col" style={{ width: 24, rowGap: '9px' }}>
          <div className="h-5" />
          <div style={{ height: (CARD_H * 2 + GAP * 2 + 10) * 2, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ width: '50%', height: 1, background: 'rgba(255,255,255,0.15)' }} />
            </div>
            <div style={{ width: '50%', height: (CARD_H * 2 + GAP * 2 + 10) / 2, borderRight: '1px solid rgba(255,255,255,0.15)' }} />
            <div style={{ width: '50%', height: 1, background: 'rgba(255,255,255,0.15)', alignSelf: 'flex-end' }} />
            <div style={{ width: '50%', height: (CARD_H * 2 + GAP * 2 + 10) / 2 - 1, borderRight: '1px solid rgba(255,255,255,0.15)' }} />
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ width: '50%', height: 1, background: 'rgba(255,255,255,0.15)' }} />
            </div>
          </div>
          <div style={{ height: (CARD_H * 2 + GAP * 2 + 10) * 2, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ width: '50%', height: 1, background: 'rgba(255,255,255,0.15)' }} />
            </div>
            <div style={{ width: '50%', height: (CARD_H * 2 + GAP * 2 + 10) / 2, borderRight: '1px solid rgba(255,255,255,0.15)' }} />
            <div style={{ width: '50%', height: 1, background: 'rgba(255,255,255,0.15)', alignSelf: 'flex-end' }} />
            <div style={{ width: '50%', height: (CARD_H * 2 + GAP * 2 + 10) / 2 - 1, borderRight: '1px solid rgba(255,255,255,0.15)' }} />
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ width: '50%', height: 1, background: 'rgba(255,255,255,0.15)' }} />
            </div>
          </div>
        </div>

        {/* Semis */}
        <div className="flex flex-col" style={{ width: 164, rowGap: '9px' }}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center mb-1">Semifinal</p>
          {/* Semi 1 centrada entre cuartos 1 y 2 */}
          <div style={{ height: (CARD_H * 2 + GAP * 2 + 10) * 2, display: 'flex', alignItems: 'center' }}>
            <SlotOrEmpty slot={sfm[1]} />
          </div>
          {/* Semi 2 centrada entre cuartos 3 y 4 */}
          <div style={{ height: (CARD_H * 2 + GAP * 2 + 10) * 2, display: 'flex', alignItems: 'center' }}>
            <SlotOrEmpty slot={sfm[2]} />
          </div>
        </div>

        {/* Conector semis → final */}
        <div className="flex flex-col" style={{ width: 24, rowGap: '11px' }}>
          <div className="h-5" />
          <div style={{ height: (CARD_H * 2 + GAP * 2 + 10) * 4, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ width: '50%', height: 1, background: 'rgba(255,255,255,0.15)' }} />
            </div>
            <div style={{ width: '50%', height: (CARD_H * 2 + GAP * 2 + 10), borderRight: '1px solid rgba(255,255,255,0.15)' }} />
            <div style={{ width: '50%', height: 1, background: 'rgba(255,255,255,0.15)', alignSelf: 'flex-end' }} />
            <div style={{ width: '50%', height: (CARD_H * 2 + GAP * 2 + 10) - 1, borderRight: '1px solid rgba(255,255,255,0.15)' }} />
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ width: '50%', height: 1, background: 'rgba(255,255,255,0.15)' }} />
            </div>
          </div>
        </div>

        {/* Final */}
        <div className="flex flex-col" style={{ width: 164, rowGap: '11px' }}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center mb-1">Final</p>
          <div style={{ height: (CARD_H * 2 + GAP * 2 + 10) * 4, display: 'flex', alignItems: 'center' }}>
            {finm ? <MatchCard slot={finm} onEdit={() => onEdit(finm)} compact /> : (
              <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/20 p-4 text-center" style={{ minWidth: 140 }}>
                <span className="text-xs text-gray-700">Sin cruce</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Bracket View ─────────────────────────────────────────────────────────────

interface BracketViewProps {
  bracket: Bracket
}

const ROUNDS = ['round_of_16', 'quarterfinal', 'semifinal', 'final'] as const

export function BracketView({ bracket }: BracketViewProps) {
  const [editingSlot, setEditingSlot] = useState<BracketSlot | null>(null)

  return (
    <>
      {/* Desktop: árbol con conectores */}
      <div className="hidden md:block">
        <DesktopBracket bracket={bracket} onEdit={setEditingSlot} />
      </div>

      {/* Mobile: secciones verticales */}
      <div className="md:hidden space-y-6">
        {ROUNDS.map((round) => (
          (bracket[round] ?? []).length > 0 && (
            <div key={round} className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {ROUND_LABELS[round]}
              </h3>
              {(bracket[round] ?? []).map((slot: BracketSlot) => (
                <MatchCard key={slot.ruleId} slot={slot} onEdit={() => setEditingSlot(slot)} />
              ))}
            </div>
          )
        ))}
      </div>

      {editingSlot && (
        <ResultModal slot={editingSlot} onClose={() => setEditingSlot(null)} />
      )}
    </>
  )
}