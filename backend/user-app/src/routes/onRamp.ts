import { Router } from 'express'
import { PrismaClient } from 'chatpay-db'
import { PrismaPg } from '@prisma/adapter-pg'
import { OnRampSchema } from 'chatpay-common'
import { authMiddleware } from '../middleware/auth'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
export const onRampRouter = Router()

// ─── Simulated Add Money (no Stripe for now) ────────────────
onRampRouter.post('/onramp', authMiddleware, async (req: any, res: any) => {
  const parsed = OnRampSchema.safeParse(req.body)
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: parsed.error.issues[0]?.message ?? 'Invalid input' })
  }

  const { amount } = parsed.data
  const userId = req.userId
  const amountInPaise = amount * 100
  const token = `sim_${Date.now()}_${Math.floor(Math.random() * 1000000)}`

  try {
    // Create the OnRamp transaction as COMPLETED immediately (simulated)
    const txn = await prisma.onRampTransaction.create({
      data: {
        startedAt: new Date(),
        amount: amountInPaise,
        token,
        status: 'COMPLETED',
        userId,
      },
    })

    // Credit the user's balance
    await prisma.balance.upsert({
      where: { userId },
      create: { userId, amount: amountInPaise, locked: 0 },
      update: { amount: { increment: amountInPaise } },
    })

    return res.status(200).json({
      message: 'Money added successfully',
      transaction: txn,
    })
  } catch (e: any) {
    console.error('[onramp error]', e?.message)
    return res
      .status(500)
      .json({ message: 'Error adding money', error: e?.message })
  }
})
