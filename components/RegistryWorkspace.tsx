"use client"

import { useEffect, useMemo, useState } from "react"
import { makeId } from "@/lib/id"
import { storage } from "@/lib/storage"
import type { RegistryEntity, RegistryEntityType, WorkspaceState } from "@/lib/types"
import { PlusIcon, TrashIcon } from "./Icons"

const entityTypes: RegistryEntityType[] = ["DNA", "RNA", "Protein", "Cell line", "Sample", "Compound", "Organism", "Reagent", "Other"]

function freshEntity(): RegistryEntity {
  const now = new Date().toISOString()
  return { id: makeId("entity"), name: "Untitled entity", type: "Sample", schema: "", description: "", aliases: [], metadata: {}, createdAt: now, updatedAt: now }
}

export default function RegistryWorkspace() {
  const [state, setState] = useState<WorkspaceState | null>(null)
  const [activeId, setActiveId] = useState("")
  const [filter, setFilter] = useState("All")

  const refresh = () => {
    const next = storage.getState()
    setState(next)
    if (!activeId && next.registry[0]) setActiveId(next.registry[0].id)
  }

  useEffect(() => {
    refresh()
    window.addEventListener(storage.eventName, refresh)
    return () => window.removeEventListener(storage.eventName, refresh)
  }, [])

  const visible = useMemo(() => state?.registry.filter(item => filter === "All" || item.type === filter) || [], [state, filter])
  const active = state?.registry.find(item => item.id === activeId)
  const parentOptions = state?.registry.filter(item => item.id !== activeId) || []

  function create() {
    const entity = freshEntity()
    storage.saveRegistryEntity(entity)
    setActiveId(entity.id)
  }

  function save(patch: Partial<RegistryEntity>) {
    if (!active) return
    storage.saveRegistryEntity({ ...active, ...patch, updatedAt: new Date().toISOString() })
  }

  function remove() {
    if (!active || !window.confirm(`Delete registry entity “${active.name}”?`)) return
    storage.deleteRegistryEntity(active.id)
    setActiveId("")
  }

  return (
    <div className="splitWorkspace">
      <aside className="recordListPane">
        <div className="recordListHeader"><div><strong>Registry</strong><span>{state?.registry.length || 0} entities</span></div><button className="iconButton" onClick={create}><PlusIcon size={17}/></button></div>
        <div className="listFilterRow"><select value={filter} onChange={event => setFilter(event.target.value)}><option>All</option>{entityTypes.map(type => <option key={type}>{type}</option>)}</select></div>
        <div className="recordList">
          {visible.map(entity => (
            <button key={entity.id} className={`recordRow ${activeId === entity.id ? "active" : ""}`} onClick={() => setActiveId(entity.id)}>
              <div><strong>{entity.name}</strong><span>{entity.type} · {entity.schema || "Unspecified schema"}</span></div>
            </button>
          ))}
        </div>
      </aside>

      <section className="recordEditorPane">
        {!active ? <div className="emptyState"><strong>Build a biological registry</strong><p>Create canonical entities and connect sequences, inventory and experiments to the same identifiers.</p><button className="primaryButton" onClick={create}>New entity</button></div> : (
          <div className="recordEditorCard">
            <div className="editorTopline"><div className="sectionEyebrow">REGISTRY ENTITY</div><button className="dangerGhost" onClick={remove}><TrashIcon size={15}/> Delete</button></div>
            <input className="entryTitle" value={active.name} onChange={event => save({ name: event.target.value })}/>
            <div className="formGrid threeCol">
              <label><span>Type</span><select value={active.type} onChange={event => save({ type: event.target.value as RegistryEntityType })}>{entityTypes.map(type => <option key={type}>{type}</option>)}</select></label>
              <label><span>Schema</span><input value={active.schema} onChange={event => save({ schema: event.target.value })} placeholder="e.g. Plasmid, patient sample"/></label>
              <label><span>Parent / lineage</span><select value={active.parentId || ""} onChange={event => save({ parentId: event.target.value || undefined })}><option value="">No parent</option>{parentOptions.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
            </div>
            <label className="fieldBlock"><span>Aliases</span><input value={active.aliases.join(", ")} onChange={event => save({ aliases: event.target.value.split(",").map((value: string) => value.trim()).filter(Boolean) })} placeholder="Comma-separated aliases"/></label>
            <label className="fieldBlock"><span>Description</span><textarea rows={5} value={active.description} onChange={event => save({ description: event.target.value })}/></label>
            <MetadataEditor value={active.metadata} onChange={metadata => save({ metadata })}/>
            {active.sequenceId && <div className="linkedObjectBanner">Linked sequence: <strong>{state?.sequences.find(item => item.id === active.sequenceId)?.name || active.sequenceId}</strong></div>}
          </div>
        )}
      </section>
    </div>
  )
}

function MetadataEditor({ value, onChange }: { value: Record<string, string>; onChange: (value: Record<string, string>) => void }) {
  const entries = Object.entries(value)
  function update(index: number, key: string, val: string) {
    const next = entries.map((item, i) => i === index ? [key, val] as [string, string] : item)
    onChange(Object.fromEntries(next.filter(([name]) => name.trim())))
  }
  function add() { onChange({ ...value, [`field_${entries.length + 1}`]: "" }) }
  return (
    <div className="fieldBlock"><div className="fieldHeading"><span>Metadata</span><button className="textButton" onClick={add}>+ Add field</button></div>
      <div className="metadataRows">
        {entries.map(([key, val], index) => <div className="metadataRow" key={`${key}-${index}`}><input value={key} onChange={event => update(index, event.target.value, val)}/><input value={val} onChange={event => update(index, key, event.target.value)}/><button onClick={() => onChange(Object.fromEntries(entries.filter((_, i) => i !== index)))}>×</button></div>)}
        {!entries.length && <div className="subtleInfo">No metadata fields yet.</div>}
      </div>
    </div>
  )
}
