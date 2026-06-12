"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import axios from "axios"
import Link from "next/link"
import Head from "next/head"
import {
  Home,
  Send,
  PlusCircle,
  MessageCircle,
  Bell,
  LogOut,
  ArrowDownLeft,
  Menu,
  X,
} from "lucide-react"

const API = process.env.NEXT_PUBLIC_USER_BACKEND_URL

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const MONEY_NAV: NavItem[] = [
  { href: "/User/dashboard/page", label: "Dashboard", icon: Home },
  { href: "/User/SendMoney/page", label: "Send Money", icon: Send },
  { href: "/User/AddMoney/page", label: "Add Money", icon: PlusCircle },
]

const SOCIAL_NAV: NavItem[] = [
  { href: "/User/chat/page", label: "Chat", icon: MessageCircle },
]

function getInitials(name: string) {
  if (!name) return "U"
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatPhone(number: string | null) {
  if (!number) return ""
  if (number.length === 10)
    return `+91 ${number.slice(0, 5)} ${number.slice(5)}`
  if (number.length === 12)
    return `+${number.slice(0, 2)} ${number.slice(2, 7)} ${number.slice(7)}`
  return number
}

export function UserLayout({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  const router = useRouter()
  const [me, setMe] = useState<{
    name: string
    number: string | null
  } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) {
      router.replace("/")
      return
    }
    axios
      .get(`${API}/api/v1/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setMe({ name: res.data.name, number: res.data.number })
        setAuthChecked(true)
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem("token")
          router.replace("/")
        } else {
          setAuthChecked(true)
        }
      })
  }, [])

  // ── Notifications (polls credit transactions) ──
  const [notifications, setNotifications] = useState<any[]>([])
  const [unread, setUnread] = useState(0)
  const [showNotifs, setShowNotifs] = useState(false)

  useEffect(() => {
    if (!authChecked) return
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) return
    let lastSeen = Number(localStorage.getItem("notif_last_seen") ?? 0)
    let initialized = false

    async function poll() {
      try {
        const res = await axios.get(`${API}/api/v1/transactions`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const credits = (res.data.transactions ?? [])
          .filter((t: any) => t.direction === "credit")
          .sort(
            (a: any, b: any) =>
              new Date(b.date).getTime() - new Date(a.date).getTime()
          )
        setNotifications(credits.slice(0, 10))
        if (!initialized) {
          lastSeen = credits.length
            ? new Date(credits[0].date).getTime()
            : Date.now()
          localStorage.setItem("notif_last_seen", String(lastSeen))
          initialized = true
          return
        }
        const newCount = credits.filter(
          (t: any) => new Date(t.date).getTime() > lastSeen
        ).length
        if (newCount > 0) setUnread(newCount)
      } catch {}
    }

    poll()
    const interval = setInterval(poll, 15000)
    return () => clearInterval(interval)
  }, [authChecked])

  function openNotifications() {
    setShowNotifs((v) => !v)
    if (!showNotifs && notifications.length) {
      const newest = new Date(notifications[0].date).getTime()
      localStorage.setItem("notif_last_seen", String(newest))
      setUnread(0)
    }
  }

  async function handleSignout() {
    localStorage.removeItem("token")
    router.push("/")
  }

  const isActive = (href: string) =>
    router.pathname === href || router.asPath === href

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f7f3]">
        <div className="flex items-center gap-3 text-gray-400">
          <span className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{title} — Chat&Pay</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="min-h-screen flex bg-[#f7f7f3]">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          />
        )}

        {/* ── Sidebar ── */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#0d1421] text-gray-300 flex flex-col shrink-0 transform transition-transform duration-200 lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Brand */}
          <div className="p-5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
              C
            </div>
            <span className="text-white font-semibold text-lg">Chat&Pay</span>
            <button
              onClick={() => setSidebarOpen(false)}
              title="Close menu"
              className="ml-auto w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors lg:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
            <div>
              <div className="px-3 mb-2 text-[10px] font-semibold tracking-widest text-gray-500">
                MONEY
              </div>
              <div className="space-y-0.5">
                {MONEY_NAV.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        active
                          ? "bg-white text-gray-900 font-semibold"
                          : "text-gray-300 hover:bg-white/5"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
            <div>
              <div className="px-3 mb-2 text-[10px] font-semibold tracking-widest text-gray-500">
                SOCIAL
              </div>
              <div className="space-y-0.5">
                {SOCIAL_NAV.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        active
                          ? "bg-white text-gray-900 font-semibold"
                          : "text-gray-300 hover:bg-white/5"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </nav>

          {/* User card */}
          {me && (
            <div className="p-4 border-t border-white/10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white text-xs font-bold">
                {getInitials(me.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white truncate">
                  {me.name}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {formatPhone(me.number)}
                </div>
              </div>
              <button
                onClick={handleSignout}
                title="Sign out"
                className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 flex flex-col min-w-0">
          <header className="flex items-center justify-between gap-3 px-4 sm:px-8 py-5 border-b border-gray-200/60 bg-[#f7f7f3]">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                title="Open menu"
                className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition-colors shrink-0 lg:hidden"
              >
                <Menu className="w-4 h-4 text-gray-600" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-sm text-gray-500 mt-0.5 truncate">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {action}
              {/* Notification bell */}
              <div className="relative">
                <button
                  onClick={openNotifications}
                  className="relative w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition-colors"
                >
                  <Bell className="w-4 h-4 text-gray-500" />
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
                {showNotifs && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm text-gray-900">
                      Notifications
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                      {notifications.length === 0 ? (
                        <div className="py-8 text-center text-sm text-gray-400">
                          No payments yet
                        </div>
                      ) : (
                        notifications.map((n: any) => (
                          <div
                            key={n.id}
                            className="flex items-center gap-3 px-4 py-3"
                          >
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                              <ArrowDownLeft className="w-4 h-4 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-gray-900 truncate">
                                Received from {n.name}
                              </div>
                              <div className="text-xs text-gray-400">
                                {new Date(n.date).toLocaleString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                            <div className="text-sm font-semibold text-green-600 tabular-nums">
                              +₹{(n.amount / 100).toLocaleString("en-IN")}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </main>
      </div>
    </>
  )
}
