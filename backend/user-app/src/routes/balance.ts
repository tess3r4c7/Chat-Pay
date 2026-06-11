import { Router } from 'express'
import { PrismaClient } from 'chatpay-db'
import { PrismaPg } from '@prisma/adapter-pg'
import { authMiddleware } from '../middleware/auth'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
export const balanceRouter = Router()

// ─── Get wallet balance ──────────────────────────────────────
balanceRouter.get('/api/balance', authMiddleware, async (req: any, res: any) => {
  const userId = req.userId
  try {
    const dbData = await prisma.balance.findUnique({ where: { userId } })
    if (dbData) {
      return res
        .status(200)
        .json({ balance: dbData.amount, locked: dbData.locked })
    }
    return res.status(404).json({ message: 'Balance not found' })
  } catch (e) {
    return res.status(500).json({ message: 'Error fetching balance' })
  }
})

// ─── Transaction history ─────────────────────────────────────
balanceRouter.get(
  '/transactions',
  authMiddleware,
  async (req: any, res: any) => {
    const userId = req.userId
    try {
      const [onRamp, p2pSent, p2pReceived] = await Promise.all([
        prisma.onRampTransaction.findMany({
          where: { userId },
          orderBy: { startedAt: 'desc' },
          take: 20,
        }),
        prisma.p2pTransfer.findMany({
          where: { senderId: userId },
          include: { receiver: { select: { name: true } } },
          orderBy: { timestamp: 'desc' },
          take: 20,
        }),
        prisma.p2pTransfer.findMany({
          where: { receiverId: userId },
          include: { sender: { select: { name: true } } },
          orderBy: { timestamp: 'desc' },
          take: 20,
        }),
      ])

      const getInitials = (name: string) =>
        name
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)

      const transactions = [
        ...onRamp.map((t: any) => ({
          id: `onramp-${t.id}`,
          name: 'Wallet Top-up',
          initials: 'W',
          date: t.startedAt,
          type: 'OnRamp',
          amount: t.amount,
          direction: 'credit',
          status: t.status,
        })),
        ...p2pSent.map((t: any) => ({
          id: `p2p-sent-${t.id}`,
          name: t.receiver.name,
          initials: getInitials(t.receiver.name),
          date: t.timestamp,
          type: 'P2P',
          amount: t.amount,
          direction: 'debit',
          status: 'SUCCESS',
        })),
        ...p2pReceived.map((t: any) => ({
          id: `p2p-recv-${t.id}`,
          name: t.sender.name,
          initials: getInitials(t.sender.name),
          date: t.timestamp,
          type: 'P2P',
          amount: t.amount,
          direction: 'credit',
          status: 'SUCCESS',
        })),
      ]
        .sort(
          (a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        )
        .slice(0, 10)

      return res.status(200).json({ transactions })
    } catch (e: any) {
      return res.status(500).json({ message: e.message })
    }
  }
)

// ─── Monthly stats (12 months) ───────────────────────────────
balanceRouter.get(
  '/monthly-stats',
  authMiddleware,
  async (req: any, res: any) => {
    const userId = req.userId
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11)
    twelveMonthsAgo.setDate(1)
    twelveMonthsAgo.setHours(0, 0, 0, 0)

    try {
      const [onRamp, p2pSent, p2pReceived] = await Promise.all([
        prisma.onRampTransaction.findMany({
          where: {
            userId,
            startedAt: { gte: twelveMonthsAgo },
            status: 'COMPLETED',
          },
          select: { amount: true, startedAt: true },
        }),
        prisma.p2pTransfer.findMany({
          where: {
            senderId: userId,
            timestamp: { gte: twelveMonthsAgo },
          },
          select: { amount: true, timestamp: true },
        }),
        prisma.p2pTransfer.findMany({
          where: {
            receiverId: userId,
            timestamp: { gte: twelveMonthsAgo },
          },
          select: { amount: true, timestamp: true },
        }),
      ])

      const monthly: Record<string, { sent: number; received: number }> = {}
      for (let i = 0; i < 12; i++) {
        const d = new Date()
        d.setMonth(d.getMonth() - 11 + i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        monthly[key] = { sent: 0, received: 0 }
      }

      const getKey = (date: Date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      onRamp.forEach((t: any) => {
        const k = getKey(new Date(t.startedAt))
        if (monthly[k]) monthly[k].received += t.amount
      })
      p2pReceived.forEach((t: any) => {
        const k = getKey(new Date(t.timestamp))
        if (monthly[k]) monthly[k].received += t.amount
      })
      p2pSent.forEach((t: any) => {
        const k = getKey(new Date(t.timestamp))
        if (monthly[k]) monthly[k].sent += t.amount
      })

      return res.status(200).json({ monthly })
    } catch (e: any) {
      return res.status(500).json({ message: e.message })
    }
  }
)
