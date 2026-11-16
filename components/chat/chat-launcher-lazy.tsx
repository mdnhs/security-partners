"use client"

import dynamic from "next/dynamic"

/**
 * The launcher as its own chunk, fetched only when ChatSlot renders it. A
 * client component imported straight into the (server) site layout joins
 * the layout's bundle, so every page would download the launcher and hint
 * even with chat off. The launcher draws nothing on the server anyway (it
 * waits for hydration to animate in), so skipping SSR changes no markup.
 */
export const ChatLauncherLazy = dynamic(
  () => import("./chat-launcher").then((m) => m.ChatLauncher),
  { ssr: false }
)
