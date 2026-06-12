import express from 'express'
import { Router } from 'express'
import { PrismaClient } from 'chatpay-db'
import { PrismaPg } from '@prisma/adapter-pg'
import { authMiddleware } from '../middleware/auth'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
export const chatRouter = Router()
chatRouter.use(express.json())
chatRouter.use(authMiddleware)

// ─── List user's conversations ───────────────────────────────
chatRouter.get('/api/conversations', async (req: any, res) => {
  const userId = req.userId
  try {
    const myParticipations = await prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: {
              include: { user: { select: { id: true, name: true } } },
            },
          },
        },
      },
    })

    if (myParticipations.length === 0) {
      return res.status(200).json([])
    }

    const conversations = myParticipations.map((p: any) => {
      const other = p.conversation.participants.find(
        (cp: any) => cp.userId !== userId
      )
      return {
        conversationId: p.conversationId,
        otherUserName: other?.user?.name ?? 'Unknown',
        otherUserId: other?.userId ?? null,
        createdAt: p.conversation.createdAt,
      }
    })

    return res.status(200).json(conversations)
  } catch (e: any) {
    return res.status(400).json({ message: e.message })
  }
})

// ─── Create or return existing conversation ──────────────────
chatRouter.post('/api/conversations', async (req: any, res: any) => {
  const otherUserId = Number(req.body.otherUserId)
  const userId = Number(req.userId)

  if (!otherUserId || !userId) {
    return res.status(400).json({ message: 'Invalid user id' })
  }
  if (otherUserId === userId) {
    return res
      .status(400)
      .json({ message: 'Cannot start a conversation with yourself' })
  }

  try {
    // Check if conversation already exists between these two users
    const existing = await prisma.conversationParticipant.findFirst({
      where: {
        userId,
        conversation: {
          participants: { some: { userId: otherUserId } },
        },
      },
    })

    if (existing) {
      return res.status(200).json({
        message: 'Conversation already exists',
        conversationId: existing.conversationId,
      })
    }

    // Look up both users to get their public keys
    const me = await prisma.user.findUnique({ where: { id: userId } })
    const other = await prisma.user.findUnique({ where: { id: otherUserId } })
    if (!other) {
      return res.status(404).json({ message: 'User not found' })
    }

    const conversation = await prisma.conversation.create({
      data: {
        participants: {
          create: [
            { userId, publickey: me?.publicKey ?? '' },
            { userId: otherUserId, publickey: other.publicKey ?? '' },
          ],
        },
      },
    })

    return res.status(201).json({
      message: 'Conversation created',
      conversationId: conversation.id,
    })
  } catch (e: any) {
    return res.status(400).json({ message: e.message })
  }
})

// ─── Get messages for a conversation ─────────────────────────
chatRouter.get('/api/messages/:conversationId', async (req: any, res) => {
  try {
    const conversationId = Number(req.params.conversationId)

    // Verify the user is a participant
    const checkUser = await prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: req.userId },
    })
    if (!checkUser) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const messageQuery = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    })

    const messages = messageQuery.map((m: any) => ({
      id: m.id,
      senderId: m.senderId,
      cipherText: m.cipherText,
      nonce: m.nonce,
      createdAt: m.createdAt,
    }))

    return res.status(200).json({ messages })
  } catch (e: any) {
    return res.status(400).json({ message: e.message })
  }
})

// ─── Save/update user's NaCl public key ──────────────────────
chatRouter.post('/api/users/publickey', async (req: any, res: any) => {
  const userId = req.userId
  const { publicKey } = req.body

  if (!publicKey) {
    return res.status(400).json({ message: 'Public key is required' })
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { publicKey },
    })
    return res.status(200).json({ message: 'Public key saved' })
  } catch (e: any) {
    return res.status(400).json({ message: e.message })
  }
})

// ─── Get another user's public key ───────────────────────────
chatRouter.get('/api/users/:userId/publickey', async (req: any, res: any) => {
  const userId = Number(req.params.userId)
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }
    return res.status(200).json({ publicKey: user.publicKey })
  } catch (e: any) {
    return res.status(400).json({ message: e.message })
  }
})
