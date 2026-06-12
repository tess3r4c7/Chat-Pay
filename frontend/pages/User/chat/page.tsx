"use client"
import axios from "axios"
import { useEffect, useRef, useState } from "react"
import util from "tweetnacl-util"
import {
  getOrCreateKeyPair,
  encryptMessage,
  decryptMessage,
} from "@/lib/chat/crypto"
import {
  MessageSquare,
  Search,
  Loader2,
  ArrowLeft,
  Send,
  Lock,
  ShieldCheck,
} from "lucide-react"
import { useRouter } from "next/router"
import Head from "next/head"

const CHAT_API =
  process.env.NEXT_PUBLIC_CHAT_SERVER_URL ?? "http://localhost:3003"
const WS_URL = CHAT_API.replace(/^http/, "ws")
const USER_API = process.env.NEXT_PUBLIC_USER_BACKEND_URL

const avatarColors = [
  "bg-orange-500",
  "bg-teal-600",
  "bg-green-600",
  "bg-blue-500",
  "bg-purple-500",
  "bg-red-500",
  "bg-pink-500",
  "bg-indigo-500",
]

function getAvatarColor(seed: string) {
  let hash = 0
  for (const c of seed)
    hash = (hash * 31 + c.charCodeAt(0)) % avatarColors.length
  return avatarColors[Math.abs(hash)]
}

function getInitials(name: string) {
  if (!name) return "?"
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

type ConversationItem = {
  conversationId: number
  otherUserName: string
  otherUserId: number | null
  createdAt: string
}

type DecryptedMessage = {
  id: number
  senderId: string | number
  text: string | null
  createdAt: string
}

export default function Chat() {
  const router = useRouter()
  const [conversationList, setConversationList] = useState<ConversationItem[]>(
    []
  )
  const [conversationId, setConversationId] = useState<number | null>(null)
  const conversationIdRef = useRef<number | null>(null)
  const otherUserId = useRef<number | null>(null)
  const [messages, setMessages] = useState<DecryptedMessage[]>([])
  const [conLoading, setConLoading] = useState(true)
  const [msgLoading, setMsgLoading] = useState(false)
  const keyPairRef = useRef<{
    publicKey: Uint8Array
    privateKey: Uint8Array
  } | null>(null)
  const otherUserPublicKeyRef = useRef<Uint8Array | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [chatError, setChatError] = useState("")
  const [unreadMap, setUnreadMap] = useState<Record<number, number>>({})

  // ── Search for users ──
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }
    const token = localStorage.getItem("token")
    setSearching(true)
    const t = setTimeout(() => {
      axios
        .get(
          `${USER_API}/api/v1/users/search?q=${encodeURIComponent(searchQuery.trim())}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        .then((res) => setSearchResults(res.data.users ?? []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  // ── Start or open a conversation ──
  async function startConversation(user: any) {
    setChatError("")
    try {
      const token = localStorage.getItem("token")
      const res = await axios.post(
        `${CHAT_API}/api/conversations`,
        { otherUserId: user.id },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const newId = res.data.conversationId

      // Refresh conversation list
      const listRes = await axios.get(`${CHAT_API}/api/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setConversationList(listRes.data)

      conversationIdRef.current = newId
      setConversationId(newId)
      otherUserId.current = user.id
      setSearchQuery("")
      setSearchResults([])
    } catch (e: any) {
      console.error(
        "Failed to start conversation",
        e?.response?.status,
        e?.message
      )
      setChatError(
        `Couldn't start chat (${e?.response?.status ?? e?.message}). Is the chat server reachable?`
      )
    }
  }

  // ── Initialize: fetch conversations, keypair, WebSocket ──
  useEffect(() => {
    async function init() {
      try {
        const token = localStorage.getItem("token")
        if (!token) {
          router.replace("/")
          return
        }

        // Load conversations
        const res = await axios.get(`${CHAT_API}/api/conversations`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setConversationList(res.data)
        setConLoading(false)

        // Generate/load keypair + register public key
        const keyPair = await getOrCreateKeyPair(CHAT_API, token)
        keyPairRef.current = keyPair

        // Connect WebSocket
        wsRef.current = new WebSocket(`${WS_URL}?token=${token}`)
        wsRef.current.onopen = () => console.log("[ws] connected")

        wsRef.current.onmessage = (e) => {
          const data = JSON.parse(e.data)

          // Typing indicator
          if (data.type === "USER_TYPING") {
            // Could show "typing..." UI here
            return
          }

          // Message for the active conversation
          if (
            data.conversationId === conversationIdRef.current &&
            data.senderId === otherUserId.current &&
            otherUserPublicKeyRef.current
          ) {
            const decryptedMessage = decryptMessage(
              data.cipherText,
              data.nonce,
              keyPairRef.current!.privateKey,
              otherUserPublicKeyRef.current!
            )
            setMessages((prev) => [
              ...prev,
              {
                id: data.id,
                senderId: data.senderId,
                text: decryptedMessage ?? "",
                createdAt: data.createdAt,
              },
            ])
          } else if (data.conversationId !== conversationIdRef.current) {
            // Message for a different conversation — show unread badge
            setUnreadMap((prev) => ({
              ...prev,
              [data.conversationId]:
                (prev[data.conversationId] ?? 0) + 1,
            }))
          }
        }
      } catch (e) {
        console.error("Failed to initialize chat", e)
        setConLoading(false)
      }
    }

    init()
    return () => {
      wsRef.current?.close()
    }
  }, [])

  // ── Load messages when conversation changes ──
  useEffect(() => {
    async function fetchMessages() {
      if (!conversationId || !keyPairRef.current) return
      setMsgLoading(true)
      setChatError("")

      try {
        const token = localStorage.getItem("token")

        // Get the other user's public key
        const pubRes = await axios.get(
          `${CHAT_API}/api/users/${otherUserId.current}/publickey`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const otherPubKey = pubRes.data.publicKey

        if (!otherPubKey) {
          otherUserPublicKeyRef.current = null
          setMessages([])
          setChatError(
            "This user hasn't opened Chat&Pay chat yet, so there's no encryption key for them. Ask them to open the Chat page once."
          )
          return
        }

        otherUserPublicKeyRef.current = util.decodeBase64(otherPubKey)

        // Fetch and decrypt messages
        const msgRes = await axios.get(
          `${CHAT_API}/api/messages/${conversationIdRef.current}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const messagesData = msgRes.data.messages ?? []

        const decrypted = messagesData.map((m: any) => ({
          id: m.id,
          senderId: m.senderId,
          createdAt: m.createdAt,
          text: decryptMessage(
            m.cipherText,
            m.nonce,
            keyPairRef.current!.privateKey,
            util.decodeBase64(otherPubKey)
          ),
        }))

        setMessages(decrypted)
      } catch (e) {
        console.error("Failed to load messages", e)
      } finally {
        setMsgLoading(false)
      }
    }

    fetchMessages()
  }, [conversationId])

  // ── Auto-scroll to bottom ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ── Send a message ──
  function sendMessage() {
    const text = inputRef.current?.value?.trim()
    if (!text) return

    if (!otherUserPublicKeyRef.current) {
      setChatError(
        "Can't send — this user hasn't set up their chat encryption key yet."
      )
      return
    }

    // Optimistically add to UI
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random(),
        senderId: "me",
        text,
        createdAt: new Date().toISOString(),
      },
    ])

    // Encrypt and send via WebSocket
    const encrypted = encryptMessage(
      text,
      keyPairRef.current!.privateKey,
      otherUserPublicKeyRef.current!
    )

    wsRef.current?.send(
      JSON.stringify({
        type: "message",
        conversationId,
        cipherText: encrypted.cipherText,
        nonce: encrypted.nonce,
      })
    )

    inputRef.current!.value = ""
  }

  // Find the active conversation's info for the header
  const activeConv = conversationList.find(
    (c) => c.conversationId === conversationId
  )

  return (
    <>
      <Head>
        <title>Chat — Chat&Pay</title>
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

      <div className="h-screen bg-[#f5f5f0] flex overflow-hidden font-sans">
        {/* ═══════════════ LEFT PANEL — Conversations ═══════════════ */}
        <div
          className={`w-full lg:w-80 bg-white border-r border-gray-200 flex-col lg:shrink-0 ${conversationId ? "hidden lg:flex" : "flex"}`}
        >
          {/* Header + search */}
          <div className="p-5 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => router.push("/User/dashboard/page")}
                title="Back to dashboard"
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h1 className="text-xl font-semibold text-gray-900 tracking-tight">
                Messages
              </h1>
              <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                <Lock className="w-3 h-3" />
                <span className="font-medium">E2E encrypted</span>
              </div>
            </div>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-gray-400 transition-colors">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by phone or name"
                className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
              />
              {searching && (
                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
              )}
            </div>
            {chatError && (
              <p className="mt-2 text-xs text-red-500">{chatError}</p>
            )}
          </div>

          {/* Search results */}
          {searchQuery.trim().length >= 2 && (
            <div className="border-b border-gray-200 max-h-72 overflow-y-auto">
              {searchResults.length === 0 && !searching ? (
                <div className="p-4 text-center text-sm text-gray-400">
                  No users found
                </div>
              ) : (
                searchResults.map((u: any) => (
                  <div
                    key={u.id}
                    onClick={() => startConversation(u)}
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0 ${getAvatarColor(u.name)}`}
                    >
                      {getInitials(u.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 text-sm truncate">
                        {u.name}
                      </div>
                      <div className="text-xs text-gray-400">{u.number}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {conLoading ? (
              <div className="flex items-center justify-center p-8 text-gray-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Loading conversations...
              </div>
            ) : conversationList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                  <MessageSquare className="w-7 h-7 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-500">
                  No conversations yet
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Search for a user to start chatting
                </p>
              </div>
            ) : (
              conversationList.map((c) => (
                <div
                  key={c.conversationId}
                  onClick={() => {
                    conversationIdRef.current = c.conversationId
                    setConversationId(c.conversationId)
                    otherUserId.current = c.otherUserId
                    setUnreadMap((prev) => {
                      const n = { ...prev }
                      delete n[c.conversationId]
                      return n
                    })
                  }}
                  className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                    conversationId === c.conversationId
                      ? "bg-emerald-50 border-l-4 border-l-emerald-500"
                      : ""
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0 ${getAvatarColor(c.otherUserName)}`}
                  >
                    {getInitials(c.otherUserName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 text-sm truncate">
                      {c.otherUserName}
                    </div>
                    <div className="text-xs text-gray-400">
                      #{c.conversationId}
                    </div>
                  </div>
                  {(unreadMap[c.conversationId] ?? 0) > 0 && (
                    <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {unreadMap[c.conversationId]}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ═══════════════ RIGHT PANEL — Message Thread ═══════════════ */}
        <div
          className={`flex-1 flex-col min-w-0 ${conversationId ? "flex" : "hidden lg:flex"}`}
        >
          {!conversationId ? (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mb-2 shadow-sm">
                <MessageSquare className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-base font-medium text-gray-500">
                Select a conversation to start chatting
              </p>
              <p className="text-sm text-gray-400">
                Choose from your conversations on the left
              </p>
              <div className="flex items-center gap-1.5 mt-4 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Messages are end-to-end encrypted</span>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center gap-3">
                <button
                  onClick={() => {
                    setConversationId(null)
                    conversationIdRef.current = null
                  }}
                  title="Back to conversations"
                  className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors shrink-0 lg:hidden"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                {activeConv && (
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0 ${getAvatarColor(activeConv.otherUserName)}`}
                    >
                      {getInitials(activeConv.otherUserName)}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">
                        {activeConv.otherUserName}
                      </div>
                      <div className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        Encrypted
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-3">
                {msgLoading ? (
                  <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Decrypting messages...
                  </div>
                ) : chatError ? (
                  <div className="flex items-center justify-center py-8 px-6 text-center text-amber-600 text-sm">
                    {chatError}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
                    <ShieldCheck className="w-8 h-8 text-emerald-300" />
                    <p className="text-sm text-gray-500">
                      Start your encrypted conversation
                    </p>
                    <p className="text-xs text-gray-400">
                      Messages are encrypted with NaCl — only you and{" "}
                      {activeConv?.otherUserName} can read them
                    </p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.senderId !== otherUserId.current
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[75%] lg:max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                            isMe
                              ? "bg-emerald-600 text-white rounded-br-sm"
                              : "bg-white border border-gray-200 text-gray-900 rounded-bl-sm"
                          }`}
                        >
                          {m.text}
                        </div>
                        <div className="text-xs text-gray-400 mt-1 px-1">
                          {new Date(m.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input bar */}
              <div className="bg-white border-t border-gray-200 p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="flex-1 flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 focus-within:border-gray-400 transition-colors bg-white">
                    <input
                      placeholder="Type a message..."
                      ref={inputRef}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") sendMessage()
                      }}
                      className="flex-1 text-sm text-gray-900 outline-none bg-transparent placeholder:text-gray-400"
                    />
                    <span className="hidden sm:inline text-xs text-gray-400 select-none">
                      ↵ Enter
                    </span>
                  </div>
                  <button
                    onClick={sendMessage}
                    title="Send"
                    className="shrink-0 w-12 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors shadow-sm"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
