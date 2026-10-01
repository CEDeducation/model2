"use client"

import { ChangeEvent, useEffect, useState } from "react"
import {
  createCloudWorkspace,
  getCloudConfig,
  getStoredSession,
  listCloudWorkspaces,
  pullWorkspace,
  pushWorkspace,
  uploadCloudAttachment,
  downloadCloudAttachment,
  signIn,
  signOutLocal,
  signUp,
} from "@/lib/cloud"
import { storage } from "@/lib/storage"
import { getAttachmentBlob, saveAttachmentBlob } from "@/lib/file-store"
import type { WorkspaceState } from "@/lib/types"
import { CloudIcon, DownloadIcon, UploadIcon } from "./Icons"

type CloudWorkspace = { id: string; name: string; created_at?: string; updated_at?: string }

async function syncAttachmentsUp(workspaceId: string, state: WorkspaceState) {
  let count = 0
  for (const entry of state.notebook) {
    for (const attachment of entry.attachments) {
      const blob = await getAttachmentBlob(attachment.id)
      if (!blob) continue
      await uploadCloudAttachment(workspaceId, attachment.id, attachment.name, blob)
      count += 1
    }
  }
  return count
}

async function syncAttachmentsDown(workspaceId: string, state: WorkspaceState) {
  let count = 0
  for (const entry of state.notebook) {
    for (const attachment of entry.attachments) {
      const blob = await downloadCloudAttachment(workspaceId, attachment.id, attachment.name)
      if (!blob) continue
      await saveAttachmentBlob(attachment.id, blob)
      count += 1
    }
  }
  return count
}

export default function SettingsWorkspace() {
  const [configured, setConfigured] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [cloudWorkspaces, setCloudWorkspaces] = useState<CloudWorkspace[]>([])
  const [activeCloudId, setActiveCloudId] = useState("")

  useEffect(() => {
    setConfigured(Boolean(getCloudConfig()))
    setSignedIn(Boolean(getStoredSession()))
    if (getCloudConfig() && getStoredSession()) void refreshCloud()
  }, [])

  async function refreshCloud() {
    try {
      const rows = await listCloudWorkspaces()
      setCloudWorkspaces(rows || [])
      if (!activeCloudId && rows?.[0]) setActiveCloudId(rows[0].id)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load cloud workspaces.")
    }
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setMessage("")
    try { await action() } catch (error) { setMessage(error instanceof Error ? error.message : "Action failed.") }
    finally { setBusy(false) }
  }

  async function login() {
    await run(async () => {
      await signIn(email.trim(), password)
      setSignedIn(true)
      setPassword("")
      setMessage("Signed in. You can now create or sync a cloud workspace.")
      await refreshCloud()
    })
  }

  async function register() {
    await run(async () => {
      await signUp(email.trim(), password)
      setSignedIn(Boolean(getStoredSession()))
      setPassword("")
      setMessage("Account created. If email confirmation is enabled in Supabase, confirm the email before signing in.")
    })
  }

  async function createWorkspace() {
    await run(async () => {
      const name = window.prompt("Cloud workspace name", storage.getState().workspace.name)?.trim()
      if (!name) return
      const created = await createCloudWorkspace(name)
      if (!created) throw new Error("Workspace was not created.")
      setActiveCloudId(created.id)
      const state = storage.getState()
      await pushWorkspace(created.id, state)
      await syncAttachmentsUp(created.id, state)
      await refreshCloud()
      setMessage("Cloud workspace created and current local data uploaded.")
    })
  }

  async function push() {
    if (!activeCloudId) return setMessage("Choose a cloud workspace first.")
    await run(async () => {
      const state = storage.getState()
      await pushWorkspace(activeCloudId, state)
      const uploaded = await syncAttachmentsUp(activeCloudId, state)
      setMessage(`Local workspace uploaded to the cloud${uploaded ? ` with ${uploaded} attachment${uploaded === 1 ? "" : "s"}` : ""}.`)
      await refreshCloud()
    })
  }

  async function pull() {
    if (!activeCloudId) return setMessage("Choose a cloud workspace first.")
    if (!window.confirm("Replace the current local workspace with the selected cloud version? Export a backup first if needed.")) return
    await run(async () => {
      const remote = await pullWorkspace(activeCloudId)
      if (!remote?.data) throw new Error("No cloud snapshot exists for this workspace yet.")
      storage.importWorkspace(remote.data)
      const restored = await syncAttachmentsDown(activeCloudId, remote.data)
      setMessage(`Cloud workspace downloaded and loaded locally${restored ? `; ${restored} attachment${restored === 1 ? "" : "s"} restored` : ""}.`)
    })
  }

  function downloadBackup() {
    const value = storage.getState()
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `openlab-workspace-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as WorkspaceState
      storage.importWorkspace(parsed)
      setMessage("Workspace backup imported successfully.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not import backup.")
    } finally {
      event.target.value = ""
    }
  }

  return (
    <div className="pageBody settingsPage">
      <div className="pageHeading compact"><div><div className="sectionEyebrow">SETTINGS & SYNC</div><h1>Data, accounts and cloud sync</h1><p>OpenLab remains usable offline. A Supabase project adds authentication, workspace membership, RLS-protected storage and cloud persistence.</p></div></div>

      {message && <div className="statusBanner">{message}</div>}

      <div className="settingsGrid">
        <section className="surfaceCard settingsCard">
          <div className="settingsCardHead"><CloudIcon size={20}/><div><strong>Supabase cloud</strong><span>{configured ? "Environment variables detected" : "Not configured on this deployment"}</span></div></div>
          {!configured ? (
            <div className="settingsInstructions">
              <p>Add these Vercel environment variables after creating your OpenLab Supabase project:</p>
              <code>NEXT_PUBLIC_SUPABASE_URL</code>
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
              <p>Then run <strong>supabase/migrations/0001_init.sql</strong> once in the Supabase SQL editor and redeploy.</p>
            </div>
          ) : !signedIn ? (
            <div className="authForm">
              <label><span>Email</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email"/></label>
              <label><span>Password</span><input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password"/></label>
              <div className="buttonRow"><button className="primaryButton" disabled={busy || !email || password.length < 6} onClick={login}>Sign in</button><button className="ghostButton" disabled={busy || !email || password.length < 6} onClick={register}>Create account</button></div>
            </div>
          ) : (
            <div className="cloudControls">
              <div className="signedInRow"><span>Authenticated cloud session</span><button className="textButton" onClick={() => { signOutLocal(); setSignedIn(false); setCloudWorkspaces([]); setActiveCloudId("") }}>Sign out</button></div>
              <label><span>Cloud workspace</span><select value={activeCloudId} onChange={event => setActiveCloudId(event.target.value)}><option value="">Choose workspace…</option>{cloudWorkspaces.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
              <div className="buttonRow wrap"><button className="ghostButton" disabled={busy} onClick={createWorkspace}>+ New cloud workspace</button><button className="primaryButton" disabled={busy || !activeCloudId} onClick={push}>Upload local → cloud</button><button className="ghostButton" disabled={busy || !activeCloudId} onClick={pull}>Download cloud → local</button></div>
              <p className="subtleInfo">This v1 sync uses a RLS-protected workspace snapshot plus the private OpenLab Storage bucket for notebook attachments. The SQL schema also contains normalized research tables for a future server-first migration.</p>
            </div>
          )}
        </section>

        <section className="surfaceCard settingsCard">
          <div className="settingsCardHead"><DownloadIcon size={20}/><div><strong>Local backup</strong><span>Portable JSON workspace file</span></div></div>
          <p>Export before large edits or cloud pulls. The JSON backup contains structured records (projects, experiments, registry records, inventory, sequences, protocols, tasks, sources and activity history). Attachment file bytes remain in this browser; use cloud sync to copy those files between devices.</p>
          <div className="buttonRow"><button className="primaryButton" onClick={downloadBackup}><DownloadIcon size={15}/> Export workspace</button><label className="ghostButton fileButton"><UploadIcon size={15}/> Import backup<input type="file" accept="application/json,.json" onChange={importBackup}/></label></div>
        </section>

        <section className="surfaceCard settingsCard">
          <div className="settingsCardHead"><div className="settingsGlyph">↺</div><div><strong>Reset local workspace</strong><span>Destructive local action</span></div></div>
          <p>This removes local edits and recreates a clean workspace with the bundled pUC19 reference record.</p>
          <button className="dangerGhost" onClick={() => { if (window.confirm("Reset all local OpenLab data? This cannot be undone unless you exported a backup.")) { storage.resetWorkspace(); setMessage("Local workspace reset.") } }}>Reset local data</button>
        </section>
      </div>
    </div>
  )
}
