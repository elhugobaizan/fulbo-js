import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { apiClient } from '../lib/api'
import { useNavigate } from '@tanstack/react-router'
import type { BracketSlot } from '../hooks/useBracket'
import { ROUND_LABELS, ROUND_ORDER, ADMIN_TOKEN_KEY } from '../config/rounds'
import { formatMatchDateShort } from '../lib/date'

const CARD_W = 160
const CARD_H = 70
const COL_GAP = 24 // horizontal gap between columns

// ─── Match Card ───────────────────────────────────────────────────────────────

function MatchCard({ slot, onEdit, isFinal = false, knockoutStarted = true }: { slot: BracketSlot; onEdit: () => void; isFinal?: boolean; knockoutStarted?: boolean }) {
  const navigate = useNavigate()
  const match = slot.match
  const isFinished = match?.status === 'finished'
  const hasTeams = slot.homeTeam && slot.awayTeam
  const canEdit = hasTeams && !isFinished && !!match?.scheduledAt
  const homeWon = isFinished && match && (
    match.homePenalties !== null
      ? match.homePenalties > (match.awayPenalties ?? 0)
      : (match.homeScore ?? 0) > (match.awayScore ?? 0)
  )
  const awayWon = isFinished && match && !homeWon

  const dateStr = !isFinished && match?.scheduledAt ? formatMatchDateShort(match.scheduledAt) : null

  const handleClick = () => {
    if (isFinished && match?.id) {
      navigate({ to: '/match/$matchId', params: { matchId: String(match.id) } })
    } else if (canEdit) {
      onEdit()
    }
  }

  return (
    <button
      onClick={handleClick}
      style={{ width: CARD_W }}
      className={`rounded-xl border overflow-hidden transition-all text-left flex-shrink-0 ${isFinal
        ? 'border-yellow-600/60 bg-yellow-950/20 hover:border-yellow-500'
        : isFinished
          ? 'border-gray-700 bg-gray-900/60 hover:bg-gray-900/80'
          : canEdit
            ? 'border-dashed border-gray-700 bg-gray-900/30 hover:border-gray-500'
            : 'border-dashed border-gray-800 bg-gray-900/10 cursor-default opacity-60 hover:border-gray-600 hover:bg-gray-800/30 hover:opacity-80'
        }`}
    >
      <div className={`flex items-center gap-1.5 px-2.5 py-2 ${homeWon ? 'bg-gray-700/60' : ''}`}>
        {knockoutStarted && slot.homeTeam?.logoUrl
          ? <img src={slot.homeTeam.logoUrl} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
          : <div className="w-4 h-4 rounded-full bg-gray-700 flex-shrink-0" />}
        <span className={`text-xs flex-1 truncate ${homeWon ? 'text-white font-bold' : isFinal ? 'text-gray-200' : 'text-gray-300'}`}>{slot.homeLabel}</span>
        <span className={`text-xs font-bold ${homeWon ? 'text-white' : 'text-gray-500'}`}>{isFinished ? match?.homeScore ?? 0 : ''}</span>
      </div>
      <div className="h-px bg-gray-800" />
      <div className={`flex items-center gap-1.5 px-2.5 py-2 ${awayWon ? 'bg-gray-700/60' : ''}`}>
        {knockoutStarted && slot.awayTeam?.logoUrl
          ? <img src={slot.awayTeam.logoUrl} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
          : <div className="w-4 h-4 rounded-full bg-gray-700 flex-shrink-0" />}
        <span className={`text-xs flex-1 truncate ${awayWon ? 'text-white font-bold' : isFinal ? 'text-gray-200' : 'text-gray-300'}`}>{slot.awayLabel}</span>
        <span className={`text-xs font-bold ${awayWon ? 'text-white' : 'text-gray-500'}`}>{isFinished ? match?.awayScore ?? 0 : ''}</span>
      </div>
      {dateStr && (
        <div className="px-2.5 py-1 border-t border-gray-800/60">
          <span className="text-[10px] text-gray-500 capitalize">{dateStr}</span>
        </div>
      )}
    </button>
  )
}

// ─── Result Modal ─────────────────────────────────────────────────────────────

function ResultModal({ slot, onClose }: { slot: BracketSlot; onClose: () => void }) {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? ''
  const [homeScore, setHomeScore] = useState(String(slot.match?.homeScore ?? ''))
  const [awayScore, setAwayScore] = useState(String(slot.match?.awayScore ?? ''))
  const [homePen, setHomePen] = useState(String(slot.match?.homePenalties ?? ''))
  const [awayPen, setAwayPen] = useState(String(slot.match?.awayPenalties ?? ''))
  const queryClient = useQueryClient()
  const showPenalties = homeScore !== '' && awayScore !== '' && Number(homeScore) === Number(awayScore)

  const saveMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      if (slot.match?.id) {
        await apiClient.patch('/admin?action=matches', {
          matchId: slot.match.id, homeScore: Number(homeScore), awayScore: Number(awayScore),
          homePenalties: showPenalties && homePen !== '' ? Number(homePen) : null,
          awayPenalties: showPenalties && awayPen !== '' ? Number(awayPen) : null,
          status: 'finished',
        }, { headers: { 'x-admin-token': token } })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bracket'] })
      queryClient.invalidateQueries({ queryKey: ['knockout-fixtures'] })
      queryClient.invalidateQueries({ queryKey: ['knockout-matches'] })
      onClose()
    },
  })

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-xs pointer-events-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <h3 className="font-bold text-white">{ROUND_LABELS[slot.knockoutRound]} · Cruce {slot.bracketPosition}</h3>
          <div className="flex items-center gap-3">
            <span className="text-sm text-white flex-1 text-right truncate">{slot.homeLabel}</span>
            <div className="flex items-center gap-2">
              <input type="number" min="0" value={homeScore} onChange={e => setHomeScore(e.target.value)}
                className="w-12 text-center py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white font-bold text-lg focus:outline-none focus:border-[#74ACDF]" autoFocus />
              <span className="text-gray-500">-</span>
              <input type="number" min="0" value={awayScore} onChange={e => setAwayScore(e.target.value)}
                className="w-12 text-center py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white font-bold text-lg focus:outline-none focus:border-[#74ACDF]" />
            </div>
            <span className="text-sm text-white flex-1 truncate">{slot.awayLabel}</span>
          </div>
          {showPenalties && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 flex-1 text-right">Penales</span>
              <div className="flex items-center gap-2">
                <input type="number" min="0" value={homePen} onChange={e => setHomePen(e.target.value)}
                  className="w-12 text-center py-1 rounded-lg bg-gray-800 border border-yellow-600/50 text-yellow-400 font-bold focus:outline-none" />
                <span className="text-gray-500">-</span>
                <input type="number" min="0" value={awayPen} onChange={e => setAwayPen(e.target.value)}
                  className="w-12 text-center py-1 rounded-lg bg-gray-800 border border-yellow-600/50 text-yellow-400 font-bold focus:outline-none" />
              </div>
              <span className="flex-1" />
            </div>
          )}
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || homeScore === '' || awayScore === ''}
            className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            <Check size={14} />{saveMutation.isPending ? 'Guardando...' : 'Guardar resultado'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Dynamic Bracket (CSS absolute positioning) ───────────────────────────────

function DynamicBracket({ bracket, onEdit, knockoutStarted = false }: { bracket: any; onEdit: (slot: BracketSlot) => void; knockoutStarted?: boolean }) {
  const rounds = ROUND_ORDER.filter(r => (bracket[r] ?? []).length > 0)
  if (rounds.length === 0) return null

  const firstRound = rounds[0]
  const firstRoundSlots = (bracket[firstRound] ?? []) as BracketSlot[]
  const totalSlots = firstRoundSlots.length
  const half = totalSlots / 2

  // Determine left/right split using next round rules
  const nextRound = rounds[1]
  const nextSlots = nextRound ? [...(bracket[nextRound] ?? [])] as BracketSlot[] : []
  const nextSorted = nextSlots.sort((a, b) => a.bracketPosition - b.bracketPosition)
  const halfNext = Math.ceil(nextSorted.length / 2)

  let leftPositions: Set<number>
  let rightPositions: Set<number>

  if (nextSorted.length > 0) {
    leftPositions = new Set()
    rightPositions = new Set()
    nextSorted.forEach((s, i) => {
      const hp = (s as any).homeWinnerOfPosition
      const ap = (s as any).awayWinnerOfPosition
      if (i < halfNext) {
        if (hp) leftPositions.add(hp)
        if (ap) leftPositions.add(ap)
      } else {
        if (hp) rightPositions.add(hp)
        if (ap) rightPositions.add(ap)
      }
    })
  } else {
    leftPositions = new Set(firstRoundSlots.filter(s => s.bracketPosition <= half).map(s => s.bracketPosition))
    rightPositions = new Set(firstRoundSlots.filter(s => s.bracketPosition > half).map(s => s.bracketPosition))
  }

  // Order first round slots for left/right
  function orderSlots(slots: BracketSlot[], isLeft: boolean): BracketSlot[] {
    if (nextSorted.length === 0) return [...slots].sort((a, b) => a.bracketPosition - b.bracketPosition)
    const relevant = isLeft ? nextSorted.slice(0, halfNext) : nextSorted.slice(halfNext)
    const ordered: BracketSlot[] = []
    const used = new Set<number>()
    for (const next of relevant) {
      const hp = (next as any).homeWinnerOfPosition
      const ap = (next as any).awayWinnerOfPosition
      const hs = slots.find(s => s.bracketPosition === hp)
      const as_ = slots.find(s => s.bracketPosition === ap)
      if (hs && !used.has(hs.bracketPosition)) { ordered.push(hs); used.add(hs.bracketPosition) }
      if (as_ && !used.has(as_.bracketPosition)) { ordered.push(as_); used.add(as_.bracketPosition) }
    }
    for (const s of [...slots].sort((a, b) => a.bracketPosition - b.bracketPosition)) {
      if (!used.has(s.bracketPosition)) ordered.push(s)
    }
    return ordered
  }

  // Build Y positions for each slot using averaging from previous round
  // Key: `${round}:${bracketPosition}` → Y center
  const yMap: Record<string, number> = {}
  const ROW_H = CARD_H + 10 // card + gap

  // First round: evenly spaced
  const leftFirst = orderSlots(firstRoundSlots.filter(s => leftPositions.has(s.bracketPosition)), true)
  const rightFirst = orderSlots(firstRoundSlots.filter(s => rightPositions.has(s.bracketPosition)), false)

  leftFirst.forEach((slot, i) => {
    yMap[`${firstRound}:${slot.bracketPosition}`] = i * ROW_H
  })
  rightFirst.forEach((slot, i) => {
    yMap[`${firstRound}:${slot.bracketPosition}`] = i * ROW_H
  })

  // Subsequent rounds: Y = average of the two feeders
  const sideRounds = rounds.filter(r => r !== 'final')
  for (let ri = 1; ri < sideRounds.length; ri++) {
    const round = sideRounds[ri]
    const slots = (bracket[round] ?? []) as BracketSlot[]
    for (const slot of slots) {
      const hp = (slot as any).homeWinnerOfPosition
      const ap = (slot as any).awayWinnerOfPosition
      const hRound = (slot as any).homeWinnerOfRound ?? sideRounds[ri - 1]
      const aRound = (slot as any).awayWinnerOfRound ?? sideRounds[ri - 1]
      const y1 = hp !== null ? yMap[`${hRound}:${hp}`] : undefined
      const y2 = ap !== null ? yMap[`${aRound}:${ap}`] : undefined
      if (y1 !== undefined && y2 !== undefined) {
        yMap[`${round}:${slot.bracketPosition}`] = (y1 + y2) / 2
      } else if (y1 !== undefined) {
        yMap[`${round}:${slot.bracketPosition}`] = y1
      } else if (y2 !== undefined) {
        yMap[`${round}:${slot.bracketPosition}`] = y2
      } else {
        yMap[`${round}:${slot.bracketPosition}`] = 0
      }
    }
  }

  // Build left/right position sets for ALL rounds by tracing back through rules
  const leftPosByRound: Record<string, Set<number>> = { [firstRound]: leftPositions }
  const rightPosByRound: Record<string, Set<number>> = { [firstRound]: rightPositions }

  for (let ri = 1; ri < sideRounds.length; ri++) {
    const round = sideRounds[ri]
    const slots = (bracket[round] ?? []) as BracketSlot[]
    const leftSet = new Set<number>()
    const rightSet = new Set<number>()
    const prevRound = sideRounds[ri - 1]
    const prevLeft = leftPosByRound[prevRound]
    const prevRight = rightPosByRound[prevRound]
    for (const slot of slots) {
      const hp = (slot as any).homeWinnerOfPosition
      const ap = (slot as any).awayWinnerOfPosition
      // A slot is on the left if its feeders are on the left
      const feederLeft = (hp && prevLeft?.has(hp)) || (ap && prevLeft?.has(ap))
      const feederRight = (hp && prevRight?.has(hp)) || (ap && prevRight?.has(ap))
      if (feederLeft) leftSet.add(slot.bracketPosition)
      else if (feederRight) rightSet.add(slot.bracketPosition)
    }
    leftPosByRound[round] = leftSet
    rightPosByRound[round] = rightSet
  }

  const totalH = half * ROW_H

  // Column X positions
  // Left: col 0 = first round, col 1 = second round, ...
  // Right: mirrored, col 0 (first round) = rightmost
  // Center: final
  const numSideRounds = sideRounds.length
  const totalW = numSideRounds * 2 * (CARD_W + COL_GAP)

  function leftX(ri: number) { return ri * (CARD_W + COL_GAP) }
  function rightX(ri: number) { return totalW - CARD_W - ri * (CARD_W + COL_GAP) }
  const finalX = (totalW - CARD_W) / 2

  // Final Y = average of the two semi Y positions
  const sfRound = sideRounds[sideRounds.length - 1]
  const sfSlots = sfRound ? (bracket[sfRound] ?? []) as BracketSlot[] : []
  const sfYs = sfSlots.map(s => yMap[`${sfRound}:${s.bracketPosition}`]).filter(y => y !== undefined)
  const finalY = sfYs.length > 0 ? sfYs.reduce((a, b) => a + b, 0) / sfYs.length - CARD_H - 36 : totalH / 2 - CARD_H / 2

  return (
    <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <div style={{ position: 'relative', width: totalW, height: totalH + CARD_H, minHeight: 400, margin: '0 auto' }}>
        {/* Left side */}
        {sideRounds.map((round, ri) => {
          const slots = (bracket[round] ?? []) as BracketSlot[]
          const sideSlots = ri === 0
            ? orderSlots(slots.filter(s => leftPositions.has(s.bracketPosition)), true)
            : slots.filter(s => leftPosByRound[round]?.has(s.bracketPosition))
              .sort((a, b) => {
                const ya = yMap[`${round}:${a.bracketPosition}`] ?? 0
                const yb = yMap[`${round}:${b.bracketPosition}`] ?? 0
                return ya - yb
              })
          return sideSlots.map(slot => {
            const y = yMap[`${round}:${slot.bracketPosition}`]
            if (y === undefined) return null
            return (
              <div key={`L-${slot.ruleId}`} style={{ position: 'absolute', left: leftX(ri), top: y }}>
                <MatchCard slot={slot} onEdit={() => onEdit(slot)} knockoutStarted={knockoutStarted} />
              </div>
            )
          })
        })}

        {/* Right side */}
        {sideRounds.map((round, ri) => {
          const slots = (bracket[round] ?? []) as BracketSlot[]
          const sideSlots = ri === 0
            ? orderSlots(slots.filter(s => rightPositions.has(s.bracketPosition)), false)
            : slots.filter(s => rightPosByRound[round]?.has(s.bracketPosition))
              .sort((a, b) => {
                const ya = yMap[`${round}:${a.bracketPosition}`] ?? 0
                const yb = yMap[`${round}:${b.bracketPosition}`] ?? 0
                return ya - yb
              })
          return sideSlots.map(slot => {
            const y = yMap[`${round}:${slot.bracketPosition}`]
            if (y === undefined) return null
            return (
              <div key={`R-${slot.ruleId}`} style={{ position: 'absolute', left: rightX(ri), top: y }}>
                <MatchCard slot={slot} onEdit={() => onEdit(slot)} knockoutStarted={knockoutStarted} />
              </div>
            )
          })
        })}

        {/* Final */}
        {(bracket['final'] ?? []).map((slot: BracketSlot) => {
          const match = slot.match
          const isFinished = match?.status === 'finished'

          let champion: { name: string; logoUrl?: string | null } | null = null
          if (isFinished) {
            const homeWon = (match?.homePenalties != null)
              ? (match.homePenalties ?? 0) > (match.awayPenalties ?? 0)
              : (match?.homeScore ?? 0) > (match?.awayScore ?? 0)
            champion = homeWon
              ? { name: slot.homeTeam?.name ?? slot.homeLabel, logoUrl: slot.homeTeam?.logoUrl }
              : { name: slot.awayTeam?.name ?? slot.awayLabel, logoUrl: slot.awayTeam?.logoUrl }
          }
          return (
            <div key={`F-${slot.ruleId}`}>
              {champion && (
                <div style={{ position: 'absolute', left: finalX - 40, top: finalY + 250, width: CARD_W + 80 }}
                  className="text-center">
                  <div className="text-3xl mb-1">🏆</div>
                  <div className="text-yellow-400 text-[10px] font-bold uppercase tracking-widest mb-2">Campeón</div>
                  <div
                    className="rounded-2xl px-4 py-3 flex items-center justify-center gap-3"
                    style={{ background: 'linear-gradient(135deg, rgba(234,179,8,0.15) 0%, rgba(234,179,8,0.05) 100%)', border: '1px solid rgba(234,179,8,0.35)', boxShadow: '0 0 24px rgba(234,179,8,0.12)' }}
                  >
                    {champion.logoUrl && (
                      <img src={champion.logoUrl} alt="" className="w-10 h-10 object-contain flex-shrink-0" />
                    )}
                    <span className="text-white font-bold text-lg leading-tight">{champion.name}</span>
                  </div>
                </div>
              )}
              <div style={{ position: 'absolute', left: finalX, top: finalY }}>
                <MatchCard slot={slot} onEdit={() => onEdit(slot)} isFinal knockoutStarted={knockoutStarted} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Mobile Bracket ───────────────────────────────────────────────────────────

function MobileBracket({ bracket, onEdit, knockoutStarted = false }: { bracket: any; onEdit: (slot: BracketSlot) => void; knockoutStarted?: boolean }) {
  const rounds = ROUND_ORDER.filter(r => (bracket[r] ?? []).length > 0)
  return (
    <div className="space-y-6">
      {rounds.map(round => (
        <div key={round} className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{ROUND_LABELS[round]}</h3>
          {(bracket[round] ?? []).map((slot: BracketSlot) => (
            <MatchCard key={slot.ruleId} slot={slot} onEdit={() => onEdit(slot)} knockoutStarted={knockoutStarted} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function BracketView({ bracket, knockoutStarted = true }: { bracket: any; knockoutStarted?: boolean }) {
  const [editingSlot, setEditingSlot] = useState<BracketSlot | null>(null)

  return (
    <>
      <div className="hidden md:block overflow-x-auto pb-4">
        <DynamicBracket bracket={bracket} onEdit={setEditingSlot} knockoutStarted={knockoutStarted} />
      </div>
      <div className="md:hidden">
        <MobileBracket bracket={bracket} onEdit={setEditingSlot} />
      </div>
      {editingSlot && <ResultModal slot={editingSlot} onClose={() => setEditingSlot(null)} />}
    </>
  )
}