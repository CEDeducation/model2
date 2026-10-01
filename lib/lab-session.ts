"use client"

export type LabProfileRole = "owner" | "researcher" | "student" | "viewer"

export type LabProfileCard = {
  id: string
  workspaceId: string
  displayName: string
  role: LabProfileRole
  avatarColor: string
}

export type ActiveLabSession = {
  mode: "cloud" | "local"
  workspaceId: string
  workspaceName: string
  profile: LabProfileCard
  verifiedAt: number
}

const ACTIVE_KEY = "openlab.active-lab-session.v1"
const SESSION_EVENT = "openlab:lab-session-change"
const PROFILE_TTL_MS = 12 * 60 * 60 * 1000

export function getActiveLabSession(): ActiveLabSession | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(ACTIVE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ActiveLabSession
    if (!parsed?.profile?.id || !parsed.workspaceId) return null
    if (Date.now() - parsed.verifiedAt > PROFILE_TTL_MS) {
      clearActiveLabSession()
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function setActiveLabSession(value: ActiveLabSession) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(value))
  window.dispatchEvent(new Event(SESSION_EVENT))
}

export function clearActiveLabSession() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(ACTIVE_KEY)
  window.dispatchEvent(new Event(SESSION_EVENT))
}

export function requestProfileSwitch() {
  if (typeof window === "undefined") return
  clearActiveLabSession()
  window.dispatchEvent(new Event("openlab:switch-profile"))
}

export const labSessionEvent = SESSION_EVENT
