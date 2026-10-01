import type { Metadata } from "next"
import "./globals.css"
import AppShell from "@/components/AppShell"
import AuthGate from "@/components/AuthGate"

export const metadata: Metadata = {
  title: "OpenLab",
  description: "Local-first research operating system for experiment records, biological registry, inventory, molecular biology and grounded scientific assistance",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AuthGate><AppShell>{children}</AppShell></AuthGate></body></html>
}
