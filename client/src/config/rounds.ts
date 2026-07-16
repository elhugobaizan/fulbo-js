export const ROUND_ORDER = ['round_of_64', 'round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final']

export const ROUND_LABELS: Record<string, string> = {
  round_of_64: '32avos',
  round_of_32: '16avos',
  round_of_16: 'Octavos',
  quarterfinal: 'Cuartos',
  semifinal: 'Semifinal',
  third_place: '3er puesto',
  final: 'Final',
}

export const ROUND_LABELS_LONG: Record<string, string> = {
  round_of_64: '32avos de Final',
  round_of_32: '16avos de Final',
  round_of_16: 'Octavos de Final',
  quarterfinal: 'Cuartos de Final',
  semifinal: 'Semifinales',
  third_place: 'Tercer puesto',
  final: 'Final',
}

// El 3er puesto no usa bracket rules (se genera solo, con los perdedores de las
// semis), asi que no aparece en el selector de rondas del form de reglas.
export const KNOCKOUT_ROUNDS = ROUND_ORDER
  .filter(value => value !== 'third_place')
  .map(value => ({ value, label: ROUND_LABELS[value] }))

export const ADMIN_TOKEN_KEY = 'futbol-ar:admin-token'
