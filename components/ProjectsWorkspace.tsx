"use client"

import { useEffect, useMemo, useState } from "react"
import { makeId } from "@/lib/id"
import { storage } from "@/lib/storage"
import type { Project, WorkspaceState } from "@/lib/types"
import { PlusIcon, TrashIcon } from "./Icons"

function freshProject(): Project {
  const now = new Date().toISOString()
  return { id: makeId("project"), name: "Untitled project", description: "", status: "Active", createdAt: now, updatedAt: now }
}

export default function ProjectsWorkspace() {
  const [state, setState] = useState<WorkspaceState | null>(null)
  const [activeId, setActiveId] = useState("")

  function refresh() {
    const next = storage.getState()
    setState(next)
    if (!activeId && next.projects[0]) setActiveId(next.projects[0].id)
  }

  useEffect(() => {
    refresh()
    window.addEventListener(storage.eventName, refresh)
    return () => window.removeEventListener(storage.eventName, refresh)
  }, [])

  const active = state?.projects.find(item => item.id === activeId)
  const counts = useMemo(() => {
    if (!state || !active) return { experiments: 0, tasks: 0 }
    return {
      experiments: state.notebook.filter(item => item.projectId === active.id).length,
      tasks: state.tasks.filter(item => item.projectId === active.id).length,
    }
  }, [state, active])

  function save(patch: Partial<Project>) {
    if (!active) return
    storage.saveProject({ ...active, ...patch, updatedAt: new Date().toISOString() })
  }

  function create() {
    const project = freshProject()
    storage.saveProject(project)
    setActiveId(project.id)
  }

  function remove() {
    if (!active || !window.confirm(`Delete project “${active.name}”? Records linked to it will remain but become unassigned.`)) return
    const state = storage.getState()
    storage.saveState({
      ...state,
      projects: state.projects.filter(item => item.id !== active.id),
      notebook: state.notebook.map(item => item.projectId === active.id ? { ...item, projectId: null } : item),
      tasks: state.tasks.map(item => item.projectId === active.id ? { ...item, projectId: null } : item),
    })
    setActiveId("")
  }

  return (
    <div className="splitWorkspace">
      <aside className="recordListPane">
        <div className="recordListHeader"><div><strong>Projects</strong><span>{state?.projects.length || 0} total</span></div><button className="iconButton" onClick={create}><PlusIcon size={17}/></button></div>
        <div className="recordList">
          {state?.projects.map(project => (
            <button key={project.id} className={`recordRow ${activeId === project.id ? "active" : ""}`} onClick={() => setActiveId(project.id)}>
              <div><strong>{project.name}</strong><span>{project.status}</span></div><small>{new Date(project.updatedAt).toLocaleDateString()}</small>
            </button>
          ))}
        </div>
      </aside>

      <section className="recordEditorPane">
        {!active ? <div className="emptyState"><strong>Create a project</strong><p>Projects group experiments and workflow tasks without forcing every record into a folder.</p><button className="primaryButton" onClick={create}>New project</button></div> : (
          <div className="recordEditorCard">
            <div className="editorTopline"><div className="sectionEyebrow">PROJECT</div><button className="dangerGhost" onClick={remove}><TrashIcon size={15}/> Delete</button></div>
            <input className="entryTitle" value={active.name} onChange={event => save({ name: event.target.value })}/>
            <div className="formGrid twoCol">
              <label><span>Status</span><select value={active.status} onChange={event => save({ status: event.target.value as Project["status"] })}><option>Active</option><option>Paused</option><option>Archived</option></select></label>
              <label><span>Linked records</span><div className="readOnlyField">{counts.experiments} experiments · {counts.tasks} tasks</div></label>
            </div>
            <label className="fieldBlock"><span>Description</span><textarea rows={8} value={active.description} onChange={event => save({ description: event.target.value })} placeholder="Project goals, scope, collaborators, milestones…"/></label>
            <div className="subtleInfo">Created {new Date(active.createdAt).toLocaleString()} · Last updated {new Date(active.updatedAt).toLocaleString()}</div>
          </div>
        )}
      </section>
    </div>
  )
}
