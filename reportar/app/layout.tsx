import type { Metadata, Viewport } from "next"
import { Fira_Code, Fira_Sans } from "next/font/google"

import "./globals.css"
import { cn } from "@/lib/utils"

const firaSans = Fira_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fira-sans",
})
const firaCode = Fira_Code({ subsets: ["latin"], variable: "--font-fira-code" })

export const metadata: Metadata = {
  title: "SARD · Reportar emergencia",
  description:
    "Reporta una emergencia a la central de riesgo, con o sin internet.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: {
    capable: true,
    title: "SARD",
    statusBarStyle: "black-translucent",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c0f11",
}

// Siempre en oscuro, como la sala: en una emergencia de noche no encandila, y el contraste de los
// colores de estado está pensado para ese fondo.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={cn("dark antialiased", firaSans.variable, firaCode.variable)}
    >
      <body>{children}</body>
    </html>
  )
}
