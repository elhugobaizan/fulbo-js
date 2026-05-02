import type { VercelRequest, VercelResponse } from '@vercel/node'

export function ok(res: VercelResponse, data: unknown) {
  return res.status(200).json({ data })
}

export function err(res: VercelResponse, message: string, status = 500) {
  return res.status(status).json({ error: message })
}

export function requireParam(
  req: VercelRequest,
  res: VercelResponse,
  param: string
): string | null {
  const val = req.query[param]
  if (!val || Array.isArray(val)) {
    err(res, `${param} is required`, 400)
    return null
  }
  return val
}
