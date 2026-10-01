"use client"

import { ChangeEvent, useEffect, useMemo, useState } from "react"
import { deleteAttachmentBlob, getAttachmentBlob, saveAttachmentBlob } from "@/lib/file-store"
import { makeId } from "@/lib/id"
import { storage } from "@/lib/storage"
import type { AttachmentMeta, NotebookEntry, WorkspaceState } from "@/lib/types"
import { DownloadIcon, PlusIcon, TrashIcon, UploadIcon } from "./Icons"

function newEntry(): NotebookEntry {
  const now = new Date().toISOString()
  return {
    id: makeId("exp"),
    projectId: null,
    title: "Untitled experiment",
    status: "Draft",
    tags: [],
    objective: "",
    protocol: "",
    results: "",
    notes: "",
    linkedEntityIds: [],
    attachments: [],
    createdAt: now,
    updatedAt: now,
  }
}

export default function NotebookWorkspace() {
  const [state, setState] = useState<WorkspaceState | null>(null)
  const [activeId, setActiveId] = useState("")
  const [savedAt, setSavedAt] = useState("")

  const refresh = () => {
    const next = storage.getState()
    setState(next)
    if (!activeId && next.notebook[0]) setActiveId(next.notebook[0].id)
  }

  useEffect(() => {
    refresh()
    window.addEventListener(storage.eventName, refresh)
    return () => window.removeEventListener(storage.eventName, refresh)
  }, [])

  const active = useMemo(() => state?.notebook.find(entry => entry.id === activeId), [state, activeId])

  function patch(patchValue: Partial<NotebookEntry>) {
    if (!active) return
    storage.saveNotebookEntry({ ...active, ...patchValue, updatedAt: new Date().toISOString() })
    setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))
  }

  function create() {
    const entry = newEntry()
    storage.saveNotebookEntry(entry)
    setActiveId(entry.id)
  }

  function remove() {
    if (!active || !window.confirm(`Delete “${active.title}”?`)) return
    void Promise.all(active.attachments.map(item => deleteAttachmentBlob(item.id).catch(() => undefined)))
    storage.deleteNotebookEntry(active.id)
    setActiveId("")
  }

  async function addAttachments(event: ChangeEvent<HTMLInputElement>) {
    if (!active) return
    const files = (Array.from(event.target.files || []) as File[]).slice(0, 20)
    if (!files.length) return
    const metadata: AttachmentMeta[] = []
    for (const file of files) {
      const id = makeId("file")
      await saveAttachmentBlob(id, file)
      metadata.push({ id, name: file.name, type: file.type || "application/octet-stream", size: file.size, createdAt: new Date().toISOString() })
    }
    patch({ attachments: [...active.attachments, ...metadata] })
    event.target.value = ""
  }

  async function downloadAttachment(item: AttachmentMeta) {
    const blob = await getAttachmentBlob(item.id)
    if (!blob) return window.alert("This attachment blob is not available in this browser.")
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = item.name
    link.click()
    URL.revokeObjectURL(url)
  }

  async function removeAttachment(item: AttachmentMeta) {
    if (!active) return
    await deleteAttachmentBlob(item.id)
    patch({ attachments: active.attachments.filter(value => value.id !== item.id) })
  }

  return (
    <div className="notebookWorkspace notebookWorkspaceV1">
      <aside className="notebookList">
        <div className="notebookListHead">
          <div><strong>Experiments</strong><span>{state?.notebook.length || 0} entries</span></div>
          <button className="iconButton" onClick={create} aria-label="New experiment"><PlusIcon size={17}/></button>
        </div>
        <div className="entryList">
          {state?.notebook.map(entry => (
            <button key={entry.id} className={`entryRow ${activeId === entry.id ? "active" : ""}`} onClick={() => setActiveId(entry.id)}>
              <div className="entryRowTop"><span className={`statusDot status-${entry.status.toLowerCase()}`}/><strong>{entry.title}</strong></div>
              <span>{state.projects.find(project => project.id === entry.projectId)?.name || "No project"} · {entry.status}</span>
            </button>
          ))}
          {!state?.notebook.length && <div className="listEmpty">No experiments yet.</div>}
        </div>
      </aside>

      <section className="notebookEditor">
        {!active ? (
          <div className="emptyState documentEmpty"><div className="emptyIcon">✦</div><strong>Start an experiment record</strong><p>Create a structured research note and link it to projects, registry entities and files.</p><button className="primaryButton" onClick={create}>Create entry</button></div>
        ) : (
          <div className="notebookDocument">
            <div className="editorTopline">
              <div className="saveState"><span className="saveDot"/>{savedAt ? `Saved ${savedAt}` : "Local-first autosave"}</div>
              <button className="dangerGhost" onClick={remove}><TrashIcon size={15}/> Delete</button>
            </div>

            <input className="entryTitle" value={active.title} maxLength={180} onChange={event => patch({ title: event.target.value })}/>
            <div className="entrySubline">Created {new Date(active.createdAt).toLocaleString()} · Updated {new Date(active.updatedAt).toLocaleString()}</div>

            <div className="entryMetaGrid">
              <label><span>Status</span><select value={active.status} onChange={event => patch({ status: event.target.value as NotebookEntry["status"] })}><option>Draft</option><option>Running</option><option>Complete</option></select></label>
              <label><span>Project</span><select value={active.projectId || ""} onChange={event => patch({ projectId: event.target.value || null })}><option value="">No project</option>{state?.projects.map(project => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
              <label className="metaSpan"><span>Tags</span><input value={active.tags.join(", ")} onChange={event => patch({ tags: event.target.value.split(",").map((tag: string) => tag.trim()).filter(Boolean).slice(0, 20) })} placeholder="screening, qPCR, cloning…"/></label>
              <label className="metaSpan"><span>Linked registry entities</span><select multiple value={active.linkedEntityIds} onChange={event => patch({ linkedEntityIds: (Array.from(event.target.selectedOptions) as HTMLOptionElement[]).map(option => option.value) })}>{state?.registry.map(entity => <option value={entity.id} key={entity.id}>{entity.type} · {entity.name}</option>)}</select></label>
            </div>

            <NotebookSection label="Objective" hint="State the question, hypothesis or decision this experiment is intended to address." value={active.objective} onChange={value => patch({ objective: value })}/>
            <NotebookSection label="Procedure" hint="Record what was actually done, including deviations from a referenced protocol." value={active.protocol} onChange={value => patch({ protocol: value })} rows={9}/>
            <NotebookSection label="Results & observations" hint="Keep raw observations separate from interpretation where possible." value={active.results} onChange={value => patch({ results: value })} rows={8}/>
            <NotebookSection label="Notes & deviations" hint="Capture troubleshooting, unexpected events and context a future lab member will need." value={active.notes} onChange={value => patch({ notes: value })} rows={7}/>

            <section className="notebookSection attachmentSection">
              <div><h2>Attachments</h2><span>Files are stored in this browser using IndexedDB. Cloud deployments can move attachments to the private OpenLab storage bucket.</span></div>
              <label className="ghostButton fileButton"><UploadIcon size={15}/> Add files<input type="file" multiple onChange={addAttachments}/></label>
              <div className="attachmentList">
                {active.attachments.map(item => <div className="attachmentRow" key={item.id}><div><strong>{item.name}</strong><span>{formatBytes(item.size)} · {item.type}</span></div><div><button onClick={() => void downloadAttachment(item)}><DownloadIcon size={15}/></button><button onClick={() => void removeAttachment(item)}><TrashIcon size={15}/></button></div></div>)}
                {!active.attachments.length && <div className="subtleInfo">No attachments.</div>}
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  )
}

function NotebookSection({ label, hint, value, onChange, rows = 6 }: { label: string; hint: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <section className="notebookSection">
      <div><h2>{label}</h2><span>{hint}</span></div>
      <textarea value={value} maxLength={40_000} onChange={event => onChange(event.target.value)} rows={rows} placeholder={`Write ${label.toLowerCase()}…`}/>
    </section>
  )
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}
