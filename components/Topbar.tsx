"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { storage } from "@/lib/storage"
import { getCloudConfig, getStoredSession } from "@/lib/cloud"
import { getActiveLabSession, labSessionEvent, requestProfileSwitch } from "@/lib/lab-session"
import { cloudSyncStatusEvent } from "./CloudAutoSync"
import { CloudIcon, SearchIcon } from "./Icons"

type SearchRecord = { type: string; label: string; detail: string; href: string }
type SyncStatus = "local" | "syncing" | "synced" | "error"

const routeLabels: Record<string, string> = {
  "/": "Home",
  "/platform": "Platform",
  "/projects": "Projects",
  "/notebook": "Notebook",
  "/protocols": "Protocols",
  "/registry": "Registry",
  "/plasmids": "Molecular biology",
  "/workflows": "Workflows",
  "/sources": "Evidence",
  "/activity": "Activity",
  "/help": "Help",
  "/settings": "Settings & sync",
}

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2) || "OL").toUpperCase()
}

export default function Topbar() {
  const pathname = usePathname()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [records, setRecords] = useState<SearchRecord[]>([])
  const [cloudLabel, setCloudLabel] = useState("Local")
  const [workspaceName, setWorkspaceName] = useState("My Lab")
  const [profileName, setProfileName] = useState("OpenLab")
  const [profileColor, setProfileColor] = useState("#2d6f63")
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local")
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const rebuild = () => {
      const state = storage.getState()
      const all: SearchRecord[] = [
        ...state.projects.map(item => ({ type: "Project", label: item.name, detail: item.status, href: "/projects" })),
        ...state.notebook.map(item => ({ type: "Experiment", label: item.title, detail: item.status, href: "/notebook" })),
        ...state.protocols.map(item => ({ type: "Protocol", label: item.name, detail: `v${item.version} · ${item.category}`, href: "/protocols" })),
        ...state.registry.map(item => ({ type: item.type, label: item.name, detail: item.schema || "Registry entity", href: "/registry" })),
        ...state.sequences.map(item => ({ type: "Sequence", label: item.name, detail: `${item.sequence.length.toLocaleString()} bp · ${item.topology}`, href: "/plasmids" })),
        ...state.tasks.map(item => ({ type: "Task", label: item.title, detail: item.status, href: "/workflows" })),
        ...state.sources.map(item => ({ type: "Evidence", label: item.title, detail: item.url || "Workspace source", href: "/sources" })),
      ]
      setRecords(all)
      setCloudLabel(getCloudConfig() && getStoredSession() ? "Cloud" : getCloudConfig() ? "Cloud ready" : "Local")
      const lab = getActiveLabSession()
      if (lab) {
        setWorkspaceName(lab.workspaceName)
        setProfileName(lab.profile.displayName)
        setProfileColor(lab.profile.avatarColor)
      }
    }

    const syncChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ status?: SyncStatus }>).detail
      if (detail?.status) setSyncStatus(detail.status)
    }

    rebuild()
    window.addEventListener(storage.eventName, rebuild)
    window.addEventListener(labSessionEvent, rebuild)
    window.addEventListener(cloudSyncStatusEvent, syncChanged)
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    window.addEventListener("keydown", shortcut)
    return () => {
      window.removeEventListener(storage.eventName, rebuild)
      window.removeEventListener(labSessionEvent, rebuild)
      window.removeEventListener(cloudSyncStatusEvent, syncChanged)
      window.removeEventListener("keydown", shortcut)
    }
  }, [])

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    return records.filter(item => `${item.type} ${item.label} ${item.detail}`.toLowerCase().includes(needle)).slice(0, 10)
  }, [query, records])

  const statusText = syncStatus === "syncing" ? "Saving…" : syncStatus === "synced" ? "Saved" : syncStatus === "error" ? "Sync issue" : cloudLabel

  return (
    <header className="topbar">
      <div className="topbarContext"><span>{workspaceName}</span><b>/</b><strong>{routeLabels[pathname] || "Workspace"}</strong></div>
      <div className="globalSearchWrap">
        <label className="searchBox">
          <SearchIcon size={18}/>
          <input ref={inputRef} value={query} onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true) }} placeholder="Search experiments, entities, sequences and evidence…" aria-label="Global search" />
          <kbd>⌘ K</kbd>
        </label>
        {open && query && (
          <div className="globalSearchMenu">
            {results.length ? results.map((item, index) => (
              <Link href={item.href} key={`${item.type}-${item.label}-${index}`} onClick={() => { setOpen(false); setQuery("") }}>
                <span>{item.type}</span><div><strong>{item.label}</strong><small>{item.detail}</small></div>
              </Link>
            )) : <div className="globalSearchEmpty">No records match “{query}”.</div>}
          </div>
        )}
      </div>
      <div className="topActions">
        <Link href="/settings" className={`localBadge syncState-${syncStatus}`}><CloudIcon size={15}/>{statusText}</Link>
        <button className="profileSwitcherButton" onClick={requestProfileSwitch} title="Switch OpenLab profile">
          <span className="topAvatar" style={{ background: profileColor }}>{initials(profileName)}</span>
          <span className="profileSwitcherText"><strong>{profileName}</strong><small>Switch profile</small></span>
        </button>
      </div>
    </header>
  )
}
