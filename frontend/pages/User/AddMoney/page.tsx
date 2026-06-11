"use client"
import { useState, useEffect, useRef } from "react"
import { Delete, PlusCircle, Loader2, CheckCircle2 } from "lucide-react"
import axios from "axios"
import { UserLayout } from "@/components/UserLayout"

const API = process.env.NEXT_PUBLIC_USER_BACKEND_URL

export default function AddMoney() {
  const [amount, setAmount] = useState("0")
  const [availableBalance, setAvailableBalance] = useState(0)
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  const availableINR = availableBalance / 100
  const numericAmount = parseFloat(amount) || 0

  useEffect(() => {
    const token = localStorage.getItem("token")
    axios
      .get(`${API}/api/v1/api/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) =>
        setAvailableBalance(
          (res.data.balance ?? 0) - (res.data.locked ?? 0)
        )
      )
      .catch(console.error)
  }, [])

  const handleAddRef = useRef<() => void>(() => {})

  const handlePress = (val: string) => {
    setMessage(null)
    setAmount((prev) => {
      if (val === "backspace")
        return prev.length > 1 ? prev.slice(0, -1) : "0"
      if (val === ".") return prev.includes(".") ? prev : prev + "."
      if (prev === "0") return val
      if (prev.includes(".")) {
        const dec = prev.split(".")[1]
        if (dec && dec.length >= 2) return prev
      }
      return prev + val
    })
  }

  async function handleAdd() {
    setMessage(null)
    if (numericAmount <= 0) {
      setMessage({ type: "error", text: "Enter an amount" })
      return
    }

    const token = localStorage.getItem("token")
    const headers = { Authorization: `Bearer ${token}` }
    setAdding(true)
    try {
      await axios.post(
        `${API}/api/v1/onramp`,
        { amount: numericAmount },
        { headers }
      )
      setMessage({
        type: "success",
        text: `₹${numericAmount.toLocaleString("en-IN")} added to your wallet!`,
      })
      setAmount("0")
      setAvailableBalance((prev) => prev + numericAmount * 100)
    } catch (e: any) {
      setMessage({
        type: "error",
        text: e.response?.data?.message ?? "Failed to add money",
      })
    } finally {
      setAdding(false)
    }
  }

  handleAddRef.current = handleAdd

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return
      if (/^[0-9]$/.test(e.key)) {
        handlePress(e.key)
        e.preventDefault()
      } else if (e.key === ".") {
        handlePress(".")
        e.preventDefault()
      } else if (e.key === "Backspace") {
        handlePress("backspace")
        e.preventDefault()
      } else if (e.key === "Enter") {
        handleAddRef.current()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const intPart = amount.includes(".") ? amount.split(".")[0] : amount
  const decPart = amount.includes(".") ? amount.split(".")[1] : ""
  const ghostDec = !amount.includes(".")
    ? ".00"
    : decPart.length === 0
      ? "00"
      : decPart.length === 1
        ? "0"
        : ""
  const keypad = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    ".",
    "0",
    "backspace",
  ]

  const quickAmounts = [100, 500, 1000, 5000]

  return (
    <UserLayout
      title="Add money"
      subtitle="Top up your wallet balance instantly"
    >
      <div className="p-4 sm:p-6 max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          {/* Current balance */}
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-base font-semibold text-gray-900">
              Top up amount
            </h2>
            <span className="text-sm text-gray-500">
              Balance ₹
              {availableINR.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>

          {/* Amount display */}
          <div className="text-4xl sm:text-5xl font-semibold tracking-tight text-center my-6">
            <span className="text-gray-900">₹{intPart}</span>
            {amount.includes(".") && (
              <span className="text-gray-900">.{decPart}</span>
            )}
            <span className="text-gray-400">{ghostDec}</span>
          </div>

          {/* Quick amount buttons */}
          <div className="flex gap-2 justify-center mb-5">
            {quickAmounts.map((qa) => (
              <button
                key={qa}
                onClick={() => {
                  setAmount(String(qa))
                  setMessage(null)
                }}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 transition-colors"
              >
                ₹{qa.toLocaleString("en-IN")}
              </button>
            ))}
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {keypad.map((btn) => (
              <button
                key={btn}
                onClick={() => handlePress(btn)}
                className="h-14 rounded-2xl border border-gray-200 text-xl font-medium text-gray-800 hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center justify-center"
              >
                {btn === "backspace" ? (
                  <Delete className="w-5 h-5 text-gray-700" />
                ) : (
                  btn
                )}
              </button>
            ))}
          </div>

          {/* Messages */}
          {message && (
            <div
              className={`mb-3 px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}
            >
              {message.type === "success" && (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              {message.text}
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleAdd}
            disabled={adding || numericAmount <= 0}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-200"
          >
            {adding ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <PlusCircle className="w-5 h-5" />
            )}
            Add ₹{numericAmount > 0 ? numericAmount.toLocaleString("en-IN") : "0"} to wallet
          </button>

          <p className="text-xs text-gray-400 text-center mt-4">
            Simulated top-up · Stripe integration coming soon
          </p>
        </div>
      </div>
    </UserLayout>
  )
}
