"use client"

import type { LabProfileCard, LabProfileRole } from "./lab-session"

const MAIN_KEY = "openlab.local-main-account.v1"
const MAIN_SESSION_KEY = "openlab.local-main-session.v1"
const MAIN_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const PROFILE_KEY = "openlab.local-profiles.v1"

const encoder = new TextEncoder()

type LocalMainAccount = {
  email: string
  labName: string
  salt: string
  passwordHash: string
  workspaceId: string
}

type LocalProfileRecord = LabProfileCard & {
  salt: string
  pinHash: string
}

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, "0")).join("")
}

function randomToken(bytes = 16) {
  const values = new Uint8Array(bytes)
  crypto.getRandomValues(values)
  return [...values].map(value => value.toString(16).padStart(2, "0")).join("")
}

async function deriveSecret(secret: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    salt: encoder.encode(salt),
    iterations: 120_000,
    hash: "SHA-256",
  }, key, 256)
  return bytesToHex(bits)
}

function readMain(): LocalMainAccount | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(MAIN_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as LocalMainAccount } catch { return null }
}

function readProfileRecords(): LocalProfileRecord[] {
  if (typeof window === "undefined") return []
  const raw = window.localStorage.getItem(PROFILE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as LocalProfileRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function writeProfileRecords(records: LocalProfileRecord[]) {
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(records))
}

export function hasLocalMainAccount() {
  return Boolean(readMain())
}

export function getLocalMainAccount() {
  const account = readMain()
  if (!account) return null
  return { email: account.email, labName: account.labName, workspaceId: account.workspaceId }
}

export function hasLocalMainSession() {
  if (typeof window === "undefined") return false
  const raw = window.localStorage.getItem(MAIN_SESSION_KEY)
  const issuedAt = Number(raw || 0)
  if (!issuedAt || Date.now() - issuedAt > MAIN_SESSION_TTL_MS) {
    window.localStorage.removeItem(MAIN_SESSION_KEY)
    return false
  }
  return true
}

export async function createLocalMainAccount(email: string, password: string, labName: string) {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail || password.length < 8 || !labName.trim()) throw new Error("Enter a valid email, a password of at least 8 characters, and a lab name.")
  const salt = randomToken()
  const passwordHash = await deriveSecret(password, salt)
  const workspaceId = `local-${crypto.randomUUID()}`
  const account: LocalMainAccount = { email: normalizedEmail, labName: labName.trim().slice(0, 120), salt, passwordHash, workspaceId }
  window.localStorage.setItem(MAIN_KEY, JSON.stringify(account))
  window.localStorage.setItem(MAIN_SESSION_KEY, String(Date.now()))
  return { email: account.email, labName: account.labName, workspaceId: account.workspaceId }
}

export async function localMainSignIn(email: string, password: string) {
  const account = readMain()
  if (!account) throw new Error("No local OpenLab account exists on this browser yet.")
  const candidate = await deriveSecret(password, account.salt)
  if (account.email !== email.trim().toLowerCase() || candidate !== account.passwordHash) throw new Error("Email or password is incorrect.")
  window.localStorage.setItem(MAIN_SESSION_KEY, String(Date.now()))
  return { email: account.email, labName: account.labName, workspaceId: account.workspaceId }
}

export function localMainSignOut() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(MAIN_SESSION_KEY)
}

export function listLocalProfiles(): LabProfileCard[] {
  return readProfileRecords().map(({ salt: _salt, pinHash: _pinHash, ...card }) => card)
}

export async function createLocalProfile(displayName: string, role: LabProfileRole, pin: string) {
  const account = readMain()
  if (!account) throw new Error("Create the main account first.")
  const records = readProfileRecords()
  if (records.length >= 4) throw new Error("This lab already has the maximum of 4 profiles.")
  if (!displayName.trim()) throw new Error("Enter a profile name.")
  if (!/^\d{4,8}$/.test(pin)) throw new Error("Use a 4–8 digit profile PIN.")
  const salt = randomToken()
  const pinHash = await deriveSecret(pin, salt)
  const palette = ["#2d6f63", "#6b63d9", "#b96849", "#4f7ca5"]
  const card: LocalProfileRecord = {
    id: `profile-${crypto.randomUUID()}`,
    workspaceId: account.workspaceId,
    displayName: displayName.trim().slice(0, 60),
    role,
    avatarColor: palette[records.length % palette.length],
    salt,
    pinHash,
  }
  writeProfileRecords([...records, card])
  return card as LabProfileCard
}

export async function verifyLocalProfile(profileId: string, pin: string) {
  const profile = readProfileRecords().find(item => item.id === profileId)
  if (!profile) return false
  const candidate = await deriveSecret(pin, profile.salt)
  return candidate === profile.pinHash
}
