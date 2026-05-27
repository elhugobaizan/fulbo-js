export const ROUND_ORDER = ['round_of_64', 'round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'final']

export const ROUND_LABELS: Record<string, string> = {
  round_of_64: '32avos',
  round_of_32: '16avos',
  round_of_16: 'Octavos',
  quarterfinal: 'Cuartos',
  semifinal: 'Semifinal',
  final: 'Final',
}

export const ROUND_LABELS_LONG: Record<string, string> = {
  round_of_64: '32avos de Final',
  round_of_32: '16avos de Final',
  round_of_16: 'Octavos de Final',
  quarterfinal: 'Cuartos de Final',
  semifinal: 'Semifinales',
  final: 'Final',
}

export const KNOCKOUT_ROUNDS = ROUND_ORDER.map(value => ({ value, label: ROUND_LABELS[value] }))

export const ADMIN_TOKEN_KEY = 'futbol-ar:admin-token'
