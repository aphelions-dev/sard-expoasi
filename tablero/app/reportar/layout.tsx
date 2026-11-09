import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "SARD · Reportar emergencia",
  description:
    "Reporta una emergencia a la central de riesgo, con o sin internet.",
  manifest: "/reportar.webmanifest",
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

export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children
}
