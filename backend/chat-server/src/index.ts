import 'dotenv/config'
import { WebSocketServer } from 'ws'
import { PrismaClient } from 'chatpay-db'
import { PrismaPg } from '@prisma/adapter-pg'
import http from 'http'
import express from 'express'
import cors from 'cors'
import url from 'url'
import jwt from 'jsonwebtoken'
import { chatRouter } from './routes/chat'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
const JWT_SECRET = process.env.JWT_SECRET as string
const activeConnections = new Map<number, any>()

const app = express()
app.use(cors())
app.use(chatRouter)

// Health check (unauthenticated)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    connections: activeConnections.size,
    timestamp: new Date().toISOString(),
  })
})

const wss = new WebSocketServer({ noServer: true })
const server = http.createServer(app)

// ─── WebSocket upgrade: verify JWT from query string ─────────
server.on('upgrade', (req, socket, head) => {
  const { query } = url.parse(req.url as string, true)
  const token = query.token as string

  if (!token) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
    socket.destroy()
    return
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload
    const userId = Number(decoded.userId)

    wss.handleUpgrade(req, socket as any, head as any, (ws) => {
      ;(ws as any).userId = userId
      activeConnections.set(userId, ws)

      ws.on('close', () => {
        activeConnections.delete(userId)
      })

      wss.emit('connection', ws, req)
    })
  } catch (e) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
    socket.destroy()
  }
})

// ─── WebSocket message handler ───────────────────────────────
wss.on('connection', (socket) => {
  const userId = (socket as any).userId
  console.log(`[ws] user ${userId} connected | online: ${activeConnections.size}`)

  socket.on('message', async (rawMessage: any) => {
    try {
      const data = JSON.parse(rawMessage.toString())
      const conversationId = Number(data.conversationId)

      // ── Typing indicator (not persisted) ──
      if (data.type === 'TYPING') {
        const participants = await prisma.conversationParticipant.findMany({
          where: { conversationId },
        })
        for (const p of participants) {
          if (p.userId !== userId) {
            const ws = activeConnections.get(p.userId)
            if (ws) {
              ws.send(
                JSON.stringify({
                  type: 'USER_TYPING',
                  conversationId,
                  typerId: userId,
                })
              )
            }
          }
        }
        return
      }

      // ── Verify sender is a member of the conversation ──
      const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId },
      })
      const isMember = participants.some((p: any) => p.userId === userId)
      if (!isMember) {
        console.error('[ws] not a member', {
          userId,
          conversationId,
          participantIds: participants.map((p: any) => p.userId),
        })
        return
      }

      // ── Save encrypted message to database ──
      const savedMessage = await prisma.message.create({
        data: {
          conversationId,
          senderId: userId,
          cipherText: data.cipherText,
          nonce: data.nonce,
          createdAt: new Date(),
        },
      })

      console.log(
        `[ws] saved message ${savedMessage.id} in conversation ${conversationId}`
      )

      // ── Relay to other participants if online ──
      for (const p of participants) {
        if (p.userId !== userId) {
          const ws = activeConnections.get(p.userId)
          console.log(
            `[ws] delivering to ${p.userId} — connected: ${!!ws} | online: [${[...activeConnections.keys()]}]`
          )
          if (ws) {
            ws.send(JSON.stringify(savedMessage))
          }
        }
      }
    } catch (e: any) {
      console.error('[ws] message handling error:', e.message)
    }
  })

  socket.on('close', () => {
    activeConnections.delete(userId)
    console.log(`[ws] user ${userId} disconnected | online: ${activeConnections.size}`)
  })
})

const PORT = process.env.PORT ? Number(process.env.PORT) : 3003
server.listen(PORT, () =>
  console.log(`✓ Chat&Pay chat-server running on port ${PORT}`)
)
