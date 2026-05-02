import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'

import footballHandler from './api/football.js'
import localHandler from './api/local.js'
import adminHandler from './api/admin.js'
import bracketHandler from './api/bracket/index.js'
import newsHandler from './api/news/index.js'

const app = express()
app.use(cors())
app.use(express.json())

function wrap(handler: Function) {
  return (req: express.Request, res: express.Response) => handler(req as any, res as any)
}

app.get('/api/football', wrap(footballHandler))
app.get('/api/local', wrap(localHandler))
app.get('/api/bracket', wrap(bracketHandler))
app.get('/api/news', wrap(newsHandler))

// Admin - all methods
const adminWrap = wrap(adminHandler)
app.get('/api/admin', adminWrap)
app.post('/api/admin', adminWrap)
app.patch('/api/admin', adminWrap)
app.delete('/api/admin', adminWrap)

app.listen(3000, () => {
  console.log('🚀 Dev server running on http://localhost:3000')
})
