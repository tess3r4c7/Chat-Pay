import { useState, useEffect } from "react"
import { useRouter } from "next/router"
import axios from "axios"
import { Loader2 } from "lucide-react"
import Head from "next/head"

const USER_API = process.env.NEXT_PUBLIC_USER_BACKEND_URL

export default function AuthPage() {
  const router = useRouter()
  const [tab, setTab] = useState<"signin" | "signup">("signin")
  const [form, setForm] = useState({ name: "", email: "", password: "", number: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    if (localStorage.getItem("token")) {
      router.push("/User/dashboard/page")
    }
  }, [])

  function field(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  async function handleUserSignIn() {
    setLoading(true)
    setError("")
    setSuccess("")
    try {
      const res = await axios.post(`${USER_API}/api/v1/signin`, {
        email: form.email,
        password: form.password,
      })
      if (!res.data.token) {
        setError(res.data.message ?? "Sign in failed")
        return
      }
      localStorage.setItem("token", res.data.token)
      router.push("/User/dashboard/page")
    } catch {
      setError("Sign in failed. Please check your credentials.")
    } finally {
      setLoading(false)
    }
  }

  async function handleUserSignUp() {
    setLoading(true)
    setError("")
    setSuccess("")
    try {
      const res = await axios.post(`${USER_API}/api/v1/signup`, {
        name: form.name,
        email: form.email,
        password: form.password,
        number: form.number,
      })
      setSuccess("Account created! Sign in to continue.")
      setTab("signin")
      setForm((f) => ({ ...f, password: "" }))
    } catch (e: any) {
      const msg = e?.response?.data?.message
      if (msg === "User already exists") {
        setError("An account with this email or phone already exists.")
      } else {
        setError(msg || "Sign up failed. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400 transition-colors placeholder:text-gray-400 bg-white"

  return (
    <>
      <Head>
        <title>Chat&Pay — Sign In</title>
        <meta name="description" content="Chat&Pay — A digital payments platform with wallet transfers and secure chat" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center p-6">
        <div className="w-full max-w-sm">

          {/* ── Logo ── */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4 shadow-lg shadow-emerald-200">
              <span className="text-white font-bold text-2xl">C</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Chat&Pay
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Payments built for everyone
            </p>
          </div>

          {/* ── Card ── */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">

            {/* Tab toggle */}
            <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
              {(["signin", "signup"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTab(t)
                    setError("")
                    setSuccess("")
                  }}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
                    tab === t
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t === "signin" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>

            {/* Form fields */}
            <div className="space-y-3">
              {tab === "signup" && (
                <input
                  type="text"
                  placeholder="Full name"
                  value={form.name}
                  onChange={field("name")}
                  className={inputClass}
                />
              )}
              <input
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={field("email")}
                className={inputClass}
              />
              <input
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={field("password")}
                className={inputClass}
              />
              {tab === "signup" && (
                <input
                  type="tel"
                  placeholder="Phone number (10 digits)"
                  value={form.number}
                  onChange={field("number")}
                  className={inputClass}
                />
              )}
            </div>

            {/* Error / success messages */}
            {error && (
              <p className="mt-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </p>
            )}
            {success && (
              <p className="mt-4 text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                {success}
              </p>
            )}

            {/* Submit */}
            <button
              onClick={tab === "signin" ? handleUserSignIn : handleUserSignUp}
              disabled={loading}
              className="mt-5 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl text-sm transition-all shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {tab === "signin" ? "Signing in…" : "Creating account…"}
                </>
              ) : tab === "signin" ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </button>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 mt-6">
            Chat&Pay · A Digital Payments Platform
          </p>
        </div>
      </div>
    </>
  )
}
