import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { authRouter } from './routes/auth'
import { balanceRouter } from './routes/balance'
import { onRampRouter } from './routes/onRamp'
import { p2pRouter } from './routes/p2p'

const app = express()
const port = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Mount all routes under /api/v1
app.use('/api/v1', authRouter)
app.use('/api/v1', balanceRouter)
app.use('/api/v1', onRampRouter)
app.use('/api/v1', p2pRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(port, () => {
  console.log(`✓ Chat&Pay user-app running on port ${port}`)
})
