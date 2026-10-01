"use client"

import { useEffect, useRef } from "react"
import { getActiveLabSession, labSessionEvent } from "@/lib/lab-session"
import { downloadCloudAttachment, getCloudConfig, getStoredSession, pullWorkspace, pushWorkspace, uploadCloudAttachment } from "@/lib/cloud"
import { getAttachmentBlob, saveAttachmentBlob } from "@/lib/file-store"
import { storage } from "@/lib/storage"

const STATUS_EVENT = "openlab:sync-status"

type SyncStatus = "local" | "syncing" | "synced" | "error"

function announce(status: SyncStatus, detail = "") {
  window.dispatchEvent(new CustomEvent(STATUS_EVENT, { detail: { status, detail } }))
}

export const cloudSyncStatusEvent = STATUS_EVENT

async function uploadAttachments(workspaceId: string) {
  const state = storage.getState()
  for (const entry of state.notebook) {
    for (const attachment of entry.attachments) {
      const blob = await getAttachmentBlob(attachment.id)
      if (blob) await uploadCloudAttachment(workspaceId, attachment.id, attachment.name, blob)
    }
  }
}

async function downloadAttachments(workspaceId: string) {
  const state = storage.getState()
  for (const entry of state.notebook) {
    for (const attachment of entry.attachments) {
      const local = await getAttachmentBlob(attachment.id)
      if (local) continue
      const blob = await downloadCloudAttachment(workspaceId, attachment.id, attachment.name)
      if (blob) await saveAttachmentBlob(attachment.id, blob)
    }
  }
}

export default function CloudAutoSync() {
  const timer = useRef<number | null>(null)
  const hydratedWorkspace = useRef("")

  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      const lab = getActiveLabSession()
      if (!lab || lab.mode !== "cloud" || !getCloudConfig() || !getStoredSession()) {
        announce("local")
        return
      }
      if (hydratedWorkspace.current === lab.workspaceId) return

      announce("syncing", "Loading the latest cloud workspace")
      try {
        const remote = await pullWorkspace(lab.workspaceId)
        if (cancelled) return
        const local = storage.getState()
        if (remote?.data) {
          const remoteTime = Date.parse(remote.updated_at || remote.data.workspace.updatedAt || "") || 0
          const localTime = Date.parse(local.workspace.updatedAt || "") || 0
          if (remoteTime >= localTime) {
            storage.importWorkspace(remote.data)
            await downloadAttachments(lab.workspaceId)
          } else {
            await pushWorkspace(lab.workspaceId, local)
            await uploadAttachments(lab.workspaceId)
          }
        } else {
          await pushWorkspace(lab.workspaceId, local)
          await uploadAttachments(lab.workspaceId)
        }
        hydratedWorkspace.current = lab.workspaceId
        announce("synced", "Cloud workspace is current")
      } catch (error) {
        announce("error", error instanceof Error ? error.message : "Cloud sync failed")
      }
    }

    async function pushAfterChange() {
      const lab = getActiveLabSession()
      if (!lab || lab.mode !== "cloud" || !getCloudConfig() || !getStoredSession()) return
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(async () => {
        announce("syncing", "Saving changes")
        try {
          await pushWorkspace(lab.workspaceId, storage.getState())
          await uploadAttachments(lab.workspaceId)
          if (!cancelled) announce("synced", "Saved")
        } catch (error) {
          if (!cancelled) announce("error", error instanceof Error ? error.message : "Cloud save failed")
        }
      }, 1200)
    }

    void hydrate()
    window.addEventListener(storage.eventName, pushAfterChange)
    window.addEventListener(labSessionEvent, hydrate)
    return () => {
      cancelled = true
      if (timer.current) window.clearTimeout(timer.current)
      window.removeEventListener(storage.eventName, pushAfterChange)
      window.removeEventListener(labSessionEvent, hydrate)
    }
  }, [])

  return null
}
