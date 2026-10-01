"use client"

import { useEffect, useState } from "react"
import { makeId } from "@/lib/id"
import { storage } from "@/lib/storage"
import type { ProtocolRecord, ProtocolStep, WorkspaceState } from "@/lib/types"
import { PlusIcon, TrashIcon } from "./Icons"

function freshProtocol(): ProtocolRecord {
  return { id: makeId("protocol"), name: "Untitled protocol", category: "General", version: 1, description: "", steps: [], tags: [], updatedAt: new Date().toISOString() }
}

export default function ProtocolLibrary() {
  const [state, setState] = useState<WorkspaceState | null>(null)
  const [activeId, setActiveId] = useState("")

  const refresh = () => {
    const next = storage.getState()
    setState(next)
    if (!activeId && next.protocols[0]) setActiveId(next.protocols[0].id)
  }

  useEffect(() => {
    refresh()
    window.addEventListener(storage.eventName, refresh)
    return () => window.removeEventListener(storage.eventName, refresh)
  }, [])

  const active = state?.protocols.find(item => item.id === activeId)

  function create() {
    const protocol = freshProtocol()
    storage.saveProtocol(protocol)
    setActiveId(protocol.id)
  }

  function save(patch: Partial<ProtocolRecord>) {
    if (!active) return
    storage.saveProtocol({ ...active, ...patch, updatedAt: new Date().toISOString() })
  }

  function addStep() {
    if (!active) return
    save({ steps: [...active.steps, { id: makeId("step"), text: "", durationMin: undefined }] })
  }

  function patchStep(stepId: string, patch: Partial<ProtocolStep>) {
    if (!active) return
    save({ steps: active.steps.map(step => step.id === stepId ? { ...step, ...patch } : step) })
  }

  function moveStep(index: number, direction: -1 | 1) {
    if (!active) return
    const target = index + direction
    if (target < 0 || target >= active.steps.length) return
    const next = [...active.steps]
    ;[next[index], next[target]] = [next[target], next[index]]
    save({ steps: next })
  }

  return (
    <div className="splitWorkspace">
      <aside className="recordListPane">
        <div className="recordListHeader"><div><strong>Protocols</strong><span>{state?.protocols.length || 0} records</span></div><button className="iconButton" onClick={create}><PlusIcon size={17}/></button></div>
        <div className="recordList">
          {state?.protocols.map(protocol => <button key={protocol.id} className={`recordRow ${activeId === protocol.id ? "active" : ""}`} onClick={() => setActiveId(protocol.id)}><div><strong>{protocol.name}</strong><span>{protocol.category} · v{protocol.version}</span></div><small>{protocol.steps.length} steps</small></button>)}
        </div>
      </aside>

      <section className="recordEditorPane">
        {!active ? <div className="emptyState"><strong>Create a reusable protocol</strong><p>Version procedures separately from experiment records so actual deviations stay traceable.</p><button className="primaryButton" onClick={create}>New protocol</button></div> : (
          <div className="recordEditorCard protocolEditorV1">
            <div className="editorTopline"><div className="sectionEyebrow">PROTOCOL · VERSION {active.version}</div><button className="dangerGhost" onClick={() => { if (window.confirm(`Delete “${active.name}”?`)) { storage.deleteProtocol(active.id); setActiveId("") } }}><TrashIcon size={15}/> Delete</button></div>
            <input className="entryTitle" value={active.name} onChange={event => save({ name: event.target.value })}/>
            <div className="formGrid threeCol">
              <label><span>Category</span><select value={active.category} onChange={event => save({ category: event.target.value as ProtocolRecord["category"] })}><option>Wet lab</option><option>Dry lab</option><option>General</option></select></label>
              <label><span>Version</span><input type="number" min="1" value={active.version} onChange={event => save({ version: Math.max(1, Number(event.target.value)) })}/></label>
              <label><span>Tags</span><input value={active.tags.join(", ")} onChange={event => save({ tags: event.target.value.split(",").map((value: string) => value.trim()).filter(Boolean) })}/></label>
            </div>
            <label className="fieldBlock"><span>Description</span><textarea rows={4} value={active.description} onChange={event => save({ description: event.target.value })}/></label>
            <div className="protocolStepsHead"><div><strong>Procedure</strong><span>Record ordered, executable steps.</span></div><button className="ghostButton" onClick={addStep}><PlusIcon size={15}/> Add step</button></div>
            <div className="protocolStepsV1">
              {active.steps.map((step, index) => <div className="protocolStepV1" key={step.id}><div className="stepIndex">{index + 1}</div><textarea rows={2} value={step.text} onChange={event => patchStep(step.id, { text: event.target.value })} placeholder="Describe this step…"/><label><span>min</span><input type="number" min="0" value={step.durationMin ?? ""} onChange={event => patchStep(step.id, { durationMin: event.target.value ? Number(event.target.value) : undefined })}/></label><div className="stepActions"><button disabled={index === 0} onClick={() => moveStep(index, -1)}>↑</button><button disabled={index === active.steps.length - 1} onClick={() => moveStep(index, 1)}>↓</button><button onClick={() => save({ steps: active.steps.filter(item => item.id !== step.id) })}>×</button></div></div>)}
              {!active.steps.length && <div className="emptyInline">No steps yet. Add the first procedure step.</div>}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
