import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'

const JWT_SECRET = process.env.JWT_SECRET || ''

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const headers = req.headers.authorization
  if (!headers || !headers.startsWith('Bearer')) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  const token = headers.split(' ')[1]
  if (!token) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: number
      exp: number
      time: number
    }
    req.userId = decoded.userId
    req.time = decoded.time
    req.exp = decoded.exp
  } catch {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  next()
}
