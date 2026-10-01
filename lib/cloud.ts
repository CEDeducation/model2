"use client"

import type { WorkspaceState } from "./types"

const SESSION_KEY = "openlab.supabase.session.v1"

type AuthSession = {
  access_token: string
  refresh_token: string
  expires_at?: number
  expires_in?: number
  user: { id: string; email?: string }
}

type CloudConfig = { url: string; anonKey: string }

export function getCloudConfig(): CloudConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "")
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  return url && anonKey ? { url, anonKey } : null
}

export function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as AuthSession } catch { return null }
}

function saveSession(session: AuthSession | null) {
  if (typeof window === "undefined") return
  if (session) {
    const normalized = { ...session }
    if (!normalized.expires_at && normalized.expires_in) normalized.expires_at = Math.floor(Date.now() / 1000) + normalized.expires_in
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(normalized))
  } else {
    window.localStorage.removeItem(SESSION_KEY)
  }
}

async function authRequest(path: string, body: Record<string, unknown>) {
  const config = getCloudConfig()
  if (!config) throw new Error("Supabase is not configured for this deployment.")
  const response = await fetch(`${config.url}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: config.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) throw new Error(String(payload.msg || payload.error_description || payload.message || "Authentication failed"))
  return payload
}


async function activeSession() {
  const current = getStoredSession()
  if (!current) return null
  const now = Math.floor(Date.now() / 1000)
  if (!current.expires_at || current.expires_at > now + 60) return current
  if (!current.refresh_token) { saveSession(null); return null }
  const payload = await authRequest("token?grant_type=refresh_token", { refresh_token: current.refresh_token })
  const refreshed = payload as unknown as AuthSession
  if (!refreshed.access_token) { saveSession(null); return null }
  saveSession(refreshed)
  return getStoredSession()
}

export async function signIn(email: string, password: string) {
  const payload = await authRequest("token?grant_type=password", { email, password })
  const session = payload as unknown as AuthSession
  saveSession(session)
  return session
}

export async function signUp(email: string, password: string) {
  const payload = await authRequest("signup", { email, password })
  const maybeSession = payload as unknown as AuthSession
  if (maybeSession.access_token) saveSession(maybeSession)
  return payload
}

export function signOutLocal() {
  saveSession(null)
}

async function rest(path: string, init: RequestInit = {}) {
  const config = getCloudConfig()
  if (!config) throw new Error("Supabase is not configured for this deployment.")
  const session = await activeSession()
  if (!session?.access_token) throw new Error("Sign in before using cloud sync.")
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>
    throw new Error(String(payload.message || payload.hint || `Cloud request failed (${response.status})`))
  }
  if (response.status === 204) return null
  return response.json().catch(() => null)
}

export async function listCloudWorkspaces() {
  return rest("workspaces?select=id,name,created_at,updated_at&order=updated_at.desc") as Promise<Array<{ id: string; name: string; created_at: string; updated_at: string }>>
}

export async function createCloudWorkspace(name: string) {
  const rows = await rest("workspaces", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ name }),
  }) as Array<{ id: string; name: string }>
  return rows?.[0]
}

export async function pushWorkspace(workspaceId: string, state: WorkspaceState) {
  await rest("workspace_snapshots?on_conflict=workspace_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ workspace_id: workspaceId, data: state, updated_at: new Date().toISOString() }),
  })
}

export async function pullWorkspace(workspaceId: string) {
  const rows = await rest(`workspace_snapshots?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=data,updated_at&limit=1`) as Array<{ data: WorkspaceState; updated_at: string }>
  return rows?.[0] || null
}


async function storageHeaders(extra: HeadersInit = {}) {
  const config = getCloudConfig()
  if (!config) throw new Error("Supabase is not configured for this deployment.")
  const session = await activeSession()
  if (!session?.access_token) throw new Error("Sign in before using cloud file sync.")
  return { apikey: config.anonKey, Authorization: `Bearer ${session.access_token}`, ...extra }
}

function attachmentPath(workspaceId: string, attachmentId: string, fileName: string) {
  const safe = fileName.replace(/[\/\\]/g, "_").slice(0, 180) || "attachment"
  return `${encodeURIComponent(workspaceId)}/attachments/${encodeURIComponent(attachmentId)}/${encodeURIComponent(safe)}`
}

export async function uploadCloudAttachment(workspaceId: string, attachmentId: string, fileName: string, blob: Blob) {
  const config = getCloudConfig()
  if (!config) throw new Error("Supabase is not configured for this deployment.")
  const path = attachmentPath(workspaceId, attachmentId, fileName)
  const response = await fetch(`${config.url}/storage/v1/object/openlab-files/${path}`, {
    method: "POST",
    headers: await storageHeaders({ "Content-Type": blob.type || "application/octet-stream", "x-upsert": "true" }),
    body: blob,
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>
    throw new Error(String(payload.message || payload.error || `Attachment upload failed (${response.status})`))
  }
}

export async function downloadCloudAttachment(workspaceId: string, attachmentId: string, fileName: string) {
  const config = getCloudConfig()
  if (!config) throw new Error("Supabase is not configured for this deployment.")
  const path = attachmentPath(workspaceId, attachmentId, fileName)
  const response = await fetch(`${config.url}/storage/v1/object/authenticated/openlab-files/${path}`, { headers: await storageHeaders() })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Attachment download failed (${response.status}).`)
  return response.blob()
}

export type CloudLabProfile = {
  id: string
  workspaceId: string
  displayName: string
  role: "owner" | "researcher" | "student" | "viewer"
  avatarColor: string
}

export async function listCloudLabProfiles(workspaceId: string): Promise<CloudLabProfile[]> {
  const rows = await rest(`lab_profiles?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=id,workspace_id,display_name,role,avatar_color,created_at&order=created_at.asc`) as Array<{
    id: string
    workspace_id: string
    display_name: string
    role: CloudLabProfile["role"]
    avatar_color: string
  }>
  return (rows || []).map(row => ({
    id: row.id,
    workspaceId: row.workspace_id,
    displayName: row.display_name,
    role: row.role,
    avatarColor: row.avatar_color || "#2d6f63",
  }))
}

export async function createCloudLabProfile(workspaceId: string, displayName: string, role: CloudLabProfile["role"], pin: string) {
  const id = await rest("rpc/create_lab_profile", {
    method: "POST",
    body: JSON.stringify({
      target_workspace: workspaceId,
      profile_name: displayName,
      profile_role: role,
      profile_pin: pin,
    }),
  }) as string
  return id
}

export async function verifyCloudLabProfilePin(profileId: string, pin: string) {
  const result = await rest("rpc/verify_lab_profile_pin", {
    method: "POST",
    body: JSON.stringify({ profile_id: profileId, profile_pin: pin }),
  }) as boolean
  return Boolean(result)
}
