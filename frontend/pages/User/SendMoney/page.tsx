"use client"
import { useState, useEffect, useRef } from "react"
import { Delete, Send, Search, Loader2 } from "lucide-react"
import axios from "axios"
import { UserLayout } from "@/components/UserLayout"

const API = process.env.NEXT_PUBLIC_USER_BACKEND_URL

const AVATAR_COLORS = [
  "bg-orange-500",
  "bg-teal-600",
  "bg-green-600",
  "bg-blue-500",
  "bg-purple-500",
  "bg-red-500",
  "bg-pink-500",
  "bg-indigo-500",
]
function avatarColor(seed: string) {
  let h = 0
  for (const c of seed)
    h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length
  return AVATAR_COLORS[Math.abs(h)]
}
function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}
function formatPhone(number: string) {
  if (number?.length === 10)
    return `+91 ${number.slice(0, 5)} ${number.slice(5)}`
  return number
}

type Recipient = { id: number; name: string; number: string }

export default function SendMoney() {
  const [amount, setAmount] = useState("0")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Recipient[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Recipient | null>(null)
  const [availableBalance, setAvailableBalance] = useState(0)
  const [sending, setSending] = useState(false)
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

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const token = localStorage.getItem("token")
    setSearching(true)
    const t = setTimeout(() => {
      axios
        .get(
          `${API}/api/v1/users/search?q=${encodeURIComponent(query.trim())}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        .then((res) => setResults(res.data.users ?? []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const handleSendRef = useRef<() => void>(() => {})

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

  async function handleSend() {
    setMessage(null)
    if (numericAmount <= 0) {
      setMessage({ type: "error", text: "Enter an amount" })
      return
    }
    if (numericAmount > availableINR) {
      setMessage({ type: "error", text: "Insufficient balance" })
      return
    }
    if (!selected) {
      setMessage({ type: "error", text: "Select a recipient first" })
      return
    }

    const token = localStorage.getItem("token")
    const headers = { Authorization: `Bearer ${token}` }
    setSending(true)
    try {
      await axios.post(
        `${API}/api/v1/payAtWallet`,
        { phoneNumber: Number(selected.number), amount: numericAmount },
        { headers }
      )
      setMessage({
        type: "success",
        text: `Sent ₹${numericAmount.toLocaleString("en-IN")} to ${selected.name}`,
      })
      setSelected(null)
      setQuery("")
      setAmount("0")
      setAvailableBalance((prev) => prev - numericAmount * 100)
    } catch (e: any) {
      setMessage({
        type: "error",
        text: e.response?.data?.message ?? "Payment failed",
      })
    } finally {
      setSending(false)
    }
  }

  handleSendRef.current = handleSend

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
        handleSendRef.current()
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

  return (
    <UserLayout
      title="Send money"
      subtitle="Peer-to-peer transfer · instant settlement"
    >
      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-5xl">
        {/* ── Recipient panel ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Recipient
          </h2>
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-2.5 mb-4 focus-within:border-gray-400 transition-colors">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by phone or name"
              className="flex-1 text-sm outline-none bg-transparent"
            />
            {searching && (
              <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
            )}
          </div>

          <div className="divide-y divide-gray-100">
            {selected ? (
              <div className="flex items-center gap-3 py-3">
                <div
                  className={`w-10 h-10 rounded-full ${avatarColor(selected.name)} flex items-center justify-center text-white text-sm font-bold`}
                >
                  {getInitials(selected.name)}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900">
                    {selected.name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatPhone(selected.number)}
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-xs text-gray-500 hover:text-gray-800"
                >
                  Change
                </button>
              </div>
            ) : query.trim().length < 2 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                Search for someone to pay
              </div>
            ) : results.length === 0 && !searching ? (
              <div className="py-10 text-center text-sm text-gray-400">
                No users found
              </div>
            ) : (
              results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="w-full flex items-center gap-3 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div
                    className={`w-10 h-10 rounded-full ${avatarColor(r.name)} flex items-center justify-center text-white text-sm font-bold`}
                  >
                    {getInitials(r.name)}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-900">
                      {r.name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatPhone(r.number)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Amount + Keypad ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-base font-semibold text-gray-900">Amount</h2>
            <span className="text-sm text-gray-500">
              Available ₹
              {availableINR.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>

          <div className="text-4xl sm:text-5xl font-semibold tracking-tight text-center my-6">
            <span className="text-gray-900">₹{intPart}</span>
            {amount.includes(".") && (
              <span className="text-gray-900">.{decPart}</span>
            )}
            <span className="text-gray-400">{ghostDec}</span>
          </div>

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

          {message && (
            <div
              className={`mb-3 px-4 py-2.5 rounded-xl text-sm ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}
            >
              {message.text}
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={sending || numericAmount <= 0 || !selected}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            {selected ? `Pay ${selected.name}` : "Select recipient"}
          </button>
        </div>
      </div>
    </UserLayout>
  )
}
