"use client"
import { useState, useEffect } from "react"
import axios from "axios"
import { useRouter } from "next/router"
import {
  PlusCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Download,
  Send,
} from "lucide-react"
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

function getAvatarColor(name: string) {
  let hash = 0
  for (const c of name)
    hash = (hash * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length
  return AVATAR_COLORS[Math.abs(hash)]
}

function formatAmount(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
  })}`
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const time = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  if (d.toDateString() === now.toDateString()) return `Today, ${time}`
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: "bg-green-100 text-green-700",
  COMPLETED: "bg-green-100 text-green-700",
  PENDING: "bg-gray-100 text-gray-600",
  FAILED: "bg-red-100 text-red-700",
}

type MonthlyData = Record<string, { sent: number; received: number }>
type ChartFilter = "all" | "sent" | "received"

function ActivityChart({
  data,
  filter,
}: {
  data: MonthlyData
  filter: ChartFilter
}) {
  const months = Object.keys(data).sort()
  const LABELS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ]

  if (months.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
        Not enough data yet
      </div>
    )
  }

  const W = 800,
    H = 180
  const PAD = { top: 10, bottom: 28, left: 52, right: 16 }
  const cW = W - PAD.left - PAD.right
  const cH = H - PAD.top - PAD.bottom

  const vals = months.flatMap((m) => {
    const d = data[m]
    if (filter === "sent") return [d.sent]
    if (filter === "received") return [d.received]
    return [d.sent, d.received]
  })
  const maxVal = Math.max(...vals, 1)

  const px = (i: number) => PAD.left + (i / (months.length - 1)) * cW
  const py = (v: number) => PAD.top + cH - (v / maxVal) * cH

  const linePoints = (key: "sent" | "received") =>
    months.map((m, i) => `${px(i)},${py(data[m][key])}`).join(" ")

  const areaPoints = (key: "sent" | "received") => {
    const line = months
      .map((m, i) => `${px(i)},${py(data[m][key])}`)
      .join(" ")
    return `${line} ${px(months.length - 1)},${PAD.top + cH} ${px(0)},${PAD.top + cH}`
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = maxVal * f
    const label =
      v >= 10000000
        ? `₹${(v / 10000000).toFixed(1)}Cr`
        : v >= 100000
          ? `₹${(v / 100000).toFixed(1)}L`
          : `₹${(v / 100).toLocaleString("en-IN")}`
    return { y: py(v), label }
  })

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="gGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="rGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {yTicks.map(({ y, label }) => (
        <g key={label}>
          <line
            x1={PAD.left}
            y1={y}
            x2={W - PAD.right}
            y2={y}
            stroke="#f3f4f6"
            strokeWidth="1"
          />
          <text
            x={PAD.left - 6}
            y={y + 4}
            textAnchor="end"
            fontSize="9"
            fill="#9ca3af"
          >
            {label}
          </text>
        </g>
      ))}

      {(filter === "all" || filter === "received") && (
        <polygon points={areaPoints("received")} fill="url(#gGrad)" />
      )}
      {(filter === "all" || filter === "sent") && (
        <polygon points={areaPoints("sent")} fill="url(#rGrad)" />
      )}
      {(filter === "all" || filter === "received") && (
        <polyline
          points={linePoints("received")}
          fill="none"
          stroke="#22c55e"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}
      {(filter === "all" || filter === "sent") && (
        <polyline
          points={linePoints("sent")}
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}

      {months.map((m, i) => {
        const mIdx = parseInt(m.split("-")[1]) - 1
        return (
          <text
            key={m}
            x={px(i)}
            y={H - 4}
            textAnchor="middle"
            fontSize="9"
            fill="#9ca3af"
          >
            {LABELS[mIdx]}
          </text>
        )
      })}
    </svg>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const [balance, setBalance] = useState(0)
  const [locked, setLocked] = useState(0)
  const [transactions, setTransactions] = useState<any[]>([])
  const [monthly, setMonthly] = useState<MonthlyData>({})
  const [chartFilter, setChartFilter] = useState<ChartFilter>("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null
    const headers = { Authorization: `Bearer ${token}` }

    Promise.all([
      axios.get(`${API}/api/v1/api/balance`, { headers }),
      axios.get(`${API}/api/v1/transactions`, { headers }),
      axios.get(`${API}/api/v1/monthly-stats`, { headers }),
    ])
      .then(([balRes, txRes, statsRes]) => {
        setBalance(balRes.data.balance ?? 0)
        setLocked(balRes.data.locked ?? 0)
        setTransactions(txRes.data.transactions ?? [])
        setMonthly(statsRes.data.monthly ?? {})
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const currentMonthName = now
    .toLocaleString("en-IN", { month: "long" })
    .toUpperCase()
  const sentThisMonth = monthly[currentMonthKey]?.sent ?? 0
  const receivedThisMonth = monthly[currentMonthKey]?.received ?? 0
  const sentCount = transactions.filter((t) => t.direction === "debit").length
  const receivedCount = transactions.filter(
    (t) => t.direction === "credit"
  ).length
  const available = balance - locked

  const sendAction = (
    <button
      onClick={() => router.push("/User/SendMoney/page")}
      className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
    >
      <Send className="w-4 h-4" /> Send money
    </button>
  )

  return (
    <UserLayout
      title="Good afternoon"
      subtitle="Here's what's moving in your wallet today."
      action={sendAction}
    >
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
        {/* ── Balance + Stats ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Balance card */}
          <div
            className="lg:col-span-2 rounded-2xl p-6 flex flex-col gap-5"
            style={{
              background: "linear-gradient(135deg, #0d1a2d 0%, #0a2a1a 100%)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs tracking-widest text-gray-400 uppercase">
                Available Balance
              </span>
              <span className="text-sm text-gray-300 flex items-center gap-1.5">
                <svg
                  className="w-3.5 h-3.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" />
                </svg>
                Locked {formatAmount(locked)}
              </span>
            </div>
            <div>
              <div className="text-4xl sm:text-5xl font-bold tracking-tight text-white break-words">
                {formatAmount(available)}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                Total {formatAmount(balance)}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push("/User/AddMoney/page")}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <PlusCircle className="w-4 h-4" /> Add money
              </button>
            </div>
          </div>

          {/* Sent / Received cards */}
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 flex-1">
              <div className="text-xs tracking-widest text-gray-400 uppercase mb-3">
                Sent · {currentMonthName}
              </div>
              <div className="text-3xl font-bold text-gray-900 tabular-nums">
                {formatAmount(sentThisMonth)}
              </div>
              <div className="flex items-center gap-1 text-sm text-red-500 mt-2">
                <ArrowUpRight className="w-4 h-4" />
                {sentCount} transactions
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 flex-1">
              <div className="text-xs tracking-widest text-gray-400 uppercase mb-3">
                Received · {currentMonthName}
              </div>
              <div className="text-3xl font-bold text-gray-900 tabular-nums">
                {formatAmount(receivedThisMonth)}
              </div>
              <div className="flex items-center gap-1 text-sm text-green-600 mt-2">
                <ArrowDownLeft className="w-4 h-4" />
                {receivedCount} transactions
              </div>
            </div>
          </div>
        </div>

        {/* ── Monthly activity chart ── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Monthly activity
              </h2>
              <p className="text-sm text-gray-400">Last 12 months · in ₹</p>
            </div>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(["all", "sent", "received"] as ChartFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setChartFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                    chartFilter === f
                      ? "bg-white shadow-sm text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <ActivityChart data={monthly} filter={chartFilter} />
        </div>

        {/* ── Recent transactions ── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Recent transactions
              </h2>
              <p className="text-sm text-gray-400">
                {transactions.length} entries
              </p>
            </div>
            <button className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {loading ? (
              <div className="py-10 text-center text-sm text-gray-400">
                Loading...
              </div>
            ) : transactions.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                No transactions yet
              </div>
            ) : (
              transactions.map((t: any) => (
                <div key={t.id} className="flex items-center gap-4 py-3.5">
                  <div
                    className={`w-10 h-10 rounded-full ${getAvatarColor(t.name)} flex items-center justify-center text-white text-sm font-semibold flex-shrink-0`}
                  >
                    {t.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm">
                      {t.name}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {formatDate(t.date)} · {t.type}
                    </div>
                  </div>
                  <div
                    className={`font-semibold tabular-nums text-sm ${t.direction === "credit" ? "text-green-600" : "text-red-500"}`}
                  >
                    {t.direction === "credit" ? "+" : "-"}
                    {formatAmount(t.amount)}
                  </div>
                  <div
                    className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_STYLES[t.status] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    ● {t.status.charAt(0) + t.status.slice(1).toLowerCase()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </UserLayout>
  )
}
