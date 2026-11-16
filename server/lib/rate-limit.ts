import "server-only"

import { type DbOrTx, getDb } from "@/server/db/client"
import { hashIp } from "@/server/lib/ip"
import { hitRateLimit, unhitRateLimit } from "@/server/modules/rate-limit/repo"

export type RateLimitResult = {
  allowed: boolean
  count: number
  retryAfterSeconds: number
}

/** Spec §9: 5 enquiries per 10 minutes per IP. */
export const LEAD_RATE_LIMIT = {
  bucket: "leads",
  max: 5,
  windowMs: 10 * 60_000,
} as const

/** Careers applications: 5 attempts per 10 minutes per IP. */
export const CAREERS_RATE_LIMIT = {
  bucket: "careers",
  max: 5,
  windowMs: 10 * 60_000,
} as const

/** Live chat. Start: per IP, middleware. */
export const CHAT_START_RATE_LIMIT = {
  bucket: "chat-start",
  max: 5,
  windowMs: 10 * 60_000,
} as const
/** New chats site-wide, key "chat:start:site". */
export const CHAT_START_SITE_RATE_LIMIT = {
  max: 60,
  windowMs: 60 * 60_000,
} as const
/** Visitor messages per IP, key rateLimitKey("chat-send", ip). */
export const CHAT_SEND_RATE_LIMIT = {
  bucket: "chat-send",
  max: 20,
  windowMs: 60_000,
} as const
/** Visitor messages per chat, key "chat:send:chat:{id}". */
export const CHAT_SEND_CHAT_RATE_LIMIT = {
  max: 60,
  windowMs: 60 * 60_000,
} as const
/** Bot replies site-wide, key "chat:bot:site". */
export const CHAT_BOT_SITE_RATE_LIMIT = {
  max: 300,
  windowMs: 60 * 60_000,
} as const
/** Visitor polls per IP, key rateLimitKey("chat-poll", ip). */
export const CHAT_POLL_RATE_LIMIT = {
  bucket: "chat-poll",
  max: 120,
  windowMs: 60_000,
} as const

export function rateLimitKey(bucket: string, ip: string | null): string {
  return `${bucket}:${ip ? hashIp(ip) : "unknown"}`
}

export async function consumeRateLimit(
  key: string,
  opts: { max: number; windowMs: number; now?: Date },
  db: DbOrTx = getDb()
): Promise<RateLimitResult> {
  const now = opts.now ?? new Date()
  const { count, resetAt } = await hitRateLimit(db, key, now, opts.windowMs)
  return {
    allowed: count <= opts.max,
    count,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((resetAt.getTime() - now.getTime()) / 1000)
    ),
  }
}

/** Undo one consumeRateLimit hit (an attempt that should not count). */
export async function refundRateLimit(
  key: string,
  now: Date = new Date(),
  db: DbOrTx = getDb()
): Promise<void> {
  await unhitRateLimit(db, key, now)
}
