import crypto from 'crypto'

// Dura toda una sesion de trabajo (ej. cargar resultados durante una fecha completa)
// sin pedir el password de nuevo. sessionStorage igual lo borra al cerrar la pestaña.
const SESSION_TTL_MS = 24 * 60 * 60 * 1000

function sha256(input: string): Buffer {
  return crypto.createHash('sha256').update(input).digest()
}

function getSecret(): string {
  return process.env.ADMIN_TOKEN_SECRET || process.env.ADMIN_PASSWORD || ''
}

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? ''
  return crypto.timingSafeEqual(sha256(input), sha256(expected))
}

export function createSessionToken(): string {
  const expiresAt = Date.now() + SESSION_TTL_MS
  const payload = String(expiresAt)
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
  return `${payload}.${sig}`
}

export function verifySessionToken(token: unknown): boolean {
  if (typeof token !== 'string') return false
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false

  const expectedSig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expectedSig)
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return false

  const expiresAt = Number(payload)
  return Number.isFinite(expiresAt) && Date.now() < expiresAt
}
