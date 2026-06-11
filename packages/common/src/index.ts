import zod from "zod"

export const UserSchema = zod.object({
  name: zod.string().min(1, "Name is required"),
  email: zod.email("Invalid email address"),
  password: zod.string().min(6, "Password must be at least 6 characters"),
  number: zod.string().min(10, "Phone number must be at least 10 digits"),
})

export const OnRampSchema = zod.object({
  amount: zod.number().positive("Amount must be positive"),
})

export const p2pWSchema = zod.object({
  phoneNumber: zod.union([zod.string(), zod.number()]),
  amount: zod.number().positive("Amount must be positive"),
})
