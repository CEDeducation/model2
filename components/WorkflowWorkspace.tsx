"use client"

import { useEffect, useState } from "react"
import { makeId } from "@/lib/id"
import { storage } from "@/lib/storage"
import type { WorkflowTask, WorkspaceState } from "@/lib/types"
import { PlusIcon, TrashIcon } from "./Icons"

const statuses: WorkflowTask["status"][] = ["Backlog", "Ready", "In progress", "Blocked", "Done"]

function freshTask(status: WorkflowTask["status"] = "Backlog"): WorkflowTask {
  return { id: makeId("task"), title: "Untitled task", status, assignee: "", projectId: null, linkedEntityIds: [], dueDate: "", updatedAt: new Date().toISOString() }
}

export default function WorkflowWorkspace() {
  const [state, setState] = useState<WorkspaceState | null>(null)
  const [editingId, setEditingId] = useState("")

  const refresh = () => setState(storage.getState())
  useEffect(() => {
    refresh()
    window.addEventListener(storage.eventName, refresh)
    return () => window.removeEventListener(storage.eventName, refresh)
  }, [])

  function create(status: WorkflowTask["status"]) {
    const task = freshTask(status)
    storage.saveTask(task)
    setEditingId(task.id)
  }

  function move(id: string, status: WorkflowTask["status"]) {
    const task = state?.tasks.find(item => item.id === id)
    if (!task) return
    storage.saveTask({ ...task, status, updatedAt: new Date().toISOString() })
  }

  const editing = state?.tasks.find(item => item.id === editingId)
  function saveEditing(patch: Partial<WorkflowTask>) {
    if (!editing) return
    storage.saveTask({ ...editing, ...patch, updatedAt: new Date().toISOString() })
  }

  return (
    <div className="workflowPage">
      <div className="pageHeading compact"><div><div className="sectionEyebrow">WORKFLOW</div><h1>Research tasks</h1><p>Move experimental work through a simple lab queue and link tasks back to projects and registry entities.</p></div></div>
      <div className="kanbanBoard">
        {statuses.map(status => (
          <section className="kanbanColumn" key={status} onDragOver={event => event.preventDefault()} onDrop={event => move(event.dataTransfer.getData("text/task-id"), status)}>
            <div className="kanbanHead"><div><strong>{status}</strong><span>{state?.tasks.filter(item => item.status === status).length || 0}</span></div><button onClick={() => create(status)}><PlusIcon size={15}/></button></div>
            <div className="kanbanCards">
              {state?.tasks.filter(item => item.status === status).map(task => (
                <button className="taskCard" key={task.id} draggable onDragStart={event => event.dataTransfer.setData("text/task-id", task.id)} onClick={() => setEditingId(task.id)}>
                  <strong>{task.title}</strong>
                  <span>{task.assignee || "Unassigned"}</span>
                  {task.dueDate && <small>Due {new Date(task.dueDate).toLocaleDateString()}</small>}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {editing && <div className="drawerBackdrop" onMouseDown={event => { if (event.currentTarget === event.target) setEditingId("") }}>
        <aside className="sideDrawer">
          <div className="drawerHead"><div><span>WORKFLOW TASK</span><strong>{editing.title}</strong></div><button onClick={() => setEditingId("")}>×</button></div>
          <label><span>Title</span><input value={editing.title} onChange={event => saveEditing({ title: event.target.value })}/></label>
          <div className="formGrid twoCol">
            <label><span>Status</span><select value={editing.status} onChange={event => saveEditing({ status: event.target.value as WorkflowTask["status"] })}>{statuses.map(status => <option key={status}>{status}</option>)}</select></label>
            <label><span>Due date</span><input type="date" value={editing.dueDate} onChange={event => saveEditing({ dueDate: event.target.value })}/></label>
          </div>
          <label><span>Assignee</span><input value={editing.assignee} onChange={event => saveEditing({ assignee: event.target.value })} placeholder="Name or email"/></label>
          <label><span>Project</span><select value={editing.projectId || ""} onChange={event => saveEditing({ projectId: event.target.value || null })}><option value="">Unassigned</option>{state?.projects.map(project => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
          <label><span>Linked registry entities</span><select multiple value={editing.linkedEntityIds} onChange={event => saveEditing({ linkedEntityIds: (Array.from(event.target.selectedOptions) as HTMLOptionElement[]).map(option => option.value) })}>{state?.registry.map(entity => <option value={entity.id} key={entity.id}>{entity.name}</option>)}</select></label>
          <button className="dangerGhost drawerDelete" onClick={() => { if (window.confirm("Delete this task?")) { storage.deleteTask(editing.id); setEditingId("") } }}><TrashIcon size={15}/> Delete task</button>
        </aside>
      </div>}
    </div>
  )
}
