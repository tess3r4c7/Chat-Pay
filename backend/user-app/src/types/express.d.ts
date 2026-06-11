export {}

declare module 'express-serve-static-core' {
  interface Request {
    userId?: number
    time?: number
    exp?: number
  }
}
