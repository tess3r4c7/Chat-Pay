import { Router } from 'express'
import { PrismaClient } from 'chatpay-db'
import { PrismaPg } from '@prisma/adapter-pg'
import { authMiddleware } from '../middleware/auth'
import { z } from 'zod'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
export const p2pRouter = Router()

const walletInput = z.object({
  phoneNumber: z.union([z.string(), z.number()]),
  amount: z.number().positive(),
})

// ─── P2P Wallet Transfer ────────────────────────────────────
p2pRouter.post('/payAtWallet', authMiddleware, async (req: any, res: any) => {
  const parsed = walletInput.safeParse(req.body)
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: parsed.error.issues[0]?.message ?? 'Invalid input' })
  }

  const { phoneNumber, amount } = parsed.data

  let numberBig: bigint
  try {
    numberBig = BigInt(phoneNumber)
  } catch {
    return res.status(400).json({ message: 'Invalid phone number' })
  }

  const userId = req.userId
  const amountInPaise = amount * 100

  try {
    const userBalance = await prisma.balance.findUnique({ where: { userId } })
    if (!userBalance) {
      return res.status(404).json({ message: 'Balance not found' })
    }

    const availableBalance = userBalance.amount - userBalance.locked
    if (amountInPaise > availableBalance) {
      return res.status(400).json({ message: 'Insufficient Balance' })
    }

    const recipient = await prisma.user.findFirst({
      where: { number: numberBig },
    })
    if (!recipient) {
      return res
        .status(404)
        .json({ message: 'Recipient not found with given phone number' })
    }

    await prisma.$transaction(async (txn: any) => {
      // Lock the sender's balance row to prevent race conditions
      await txn.$queryRaw`SELECT * FROM "Balance" WHERE "userId"=${userId} FOR UPDATE`

      // Debit sender
      await txn.balance.update({
        where: { userId },
        data: { amount: { decrement: amountInPaise } },
      })

      // Credit receiver
      await txn.balance.upsert({
        where: { userId: recipient.id },
        create: { userId: recipient.id, amount: amountInPaise, locked: 0 },
        update: { amount: { increment: amountInPaise } },
      })

      // Record the transfer
      await txn.p2pTransfer.create({
        data: {
          senderId: userId,
          receiverId: recipient.id,
          amount: amountInPaise,
          timestamp: new Date(),
        },
      })
    })

    return res.status(200).json({ message: 'Payment Successful' })
  } catch (e: any) {
    return res.status(400).json({ message: e.message })
  }
})
