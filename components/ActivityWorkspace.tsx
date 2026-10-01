"use client"

import { useEffect, useMemo, useState } from "react"
import { storage } from "@/lib/storage"
import type { AuditEvent } from "@/lib/types"

export default function ActivityWorkspace() {
  const [items, setItems] = useState<AuditEvent[]>([])
  const [filter, setFilter] = useState("All")

  const refresh = () => setItems(storage.getAudit())
  useEffect(() => {
    refresh()
    window.addEventListener(storage.eventName, refresh)
    return () => window.removeEventListener(storage.eventName, refresh)
  }, [])

  const types = useMemo(() => [...new Set(items.map(item => item.objectType))].sort(), [items])
  const visible = items.filter(item => filter === "All" || item.objectType === filter)

  return (
    <div className="pageBody">
      <div className="pageHeading compact"><div><div className="sectionEyebrow">AUDIT TRAIL</div><h1>Workspace activity</h1><p>OpenLab records create, edit and delete events locally. Cloud deployments can persist audit events under workspace RLS.</p></div><select value={filter} onChange={event => setFilter(event.target.value)}><option>All</option>{types.map(type => <option key={type}>{type}</option>)}</select></div>
      <section className="surfaceCard activityCard">
        {visible.map(item => <div className="activityRow" key={item.id}><div className="activityDot"/><div><strong>{item.action}</strong><span>{item.detail}</span></div><div><small>{item.actor}</small><time>{new Date(item.createdAt).toLocaleString()}</time></div></div>)}
        {!visible.length && <div className="emptyState"><strong>No activity yet</strong><p>Edits will appear here as you work.</p></div>}
      </section>
    </div>
  )
}
