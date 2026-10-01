"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { getActiveLabSession } from "@/lib/lab-session"

const SAFE_ROUTES = new Set(["/", "/projects", "/notebook", "/protocols", "/registry", "/inventory", "/plasmids", "/workflows", "/sources", "/activity", "/settings"])

export default function ResumeLocation() {
  const pathname = usePathname()
  const router = useRouter()
  const restored = useRef(false)

  useEffect(() => {
    const lab = getActiveLabSession()
    if (!lab) return
    const key = `openlab.last-route.${lab.profile.id}`

    if (!restored.current) {
      restored.current = true
      const remembered = window.localStorage.getItem(key)
      if (pathname === "/" && remembered && remembered !== "/" && SAFE_ROUTES.has(remembered)) {
        router.replace(remembered)
        return
      }
    }

    if (SAFE_ROUTES.has(pathname)) window.localStorage.setItem(key, pathname)
  }, [pathname, router])

  return null
}
