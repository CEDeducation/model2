"use client"

import { starterWorkspace } from "./seed"
import { makeId } from "./id"
import { getActiveLabSession } from "./lab-session"
import type {
  AuditEvent,
  CopilotThread,
  InventoryItem,
  NotebookEntry,
  Project,
  ProtocolRecord,
  RegistryEntity,
  SequenceRecord,
  WorkflowTask,
  WorkspaceSource,
  WorkspaceState,
} from "./types"

const WORKSPACE_KEY = "openlab.workspace.v1"
const CHANGE_EVENT = "openlab:workspace-change"

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function now() {
  return new Date().toISOString()
}

function isWorkspaceState(value: unknown): value is WorkspaceState {
  if (!value || typeof value !== "object") return false
  const state = value as Partial<WorkspaceState>
  return state.format === "openlab-workspace-v1" && Array.isArray(state.sequences) && Array.isArray(state.notebook)
}

function normalize(state: WorkspaceState): WorkspaceState {
  return {
    ...state,
    projects: Array.isArray(state.projects) ? state.projects : [],
    notebook: Array.isArray(state.notebook) ? state.notebook.map(item => ({ ...item, linkedEntityIds: Array.isArray(item.linkedEntityIds) ? item.linkedEntityIds : [], attachments: Array.isArray(item.attachments) ? item.attachments : [] })) : [],
    protocols: Array.isArray(state.protocols) ? state.protocols : [],
    registry: Array.isArray(state.registry) ? state.registry : [],
    inventory: Array.isArray(state.inventory) ? state.inventory : [],
    sequences: Array.isArray(state.sequences) ? state.sequences.map(item => ({
      ...item,
      features: Array.isArray(item.features) ? item.features : [],
      primers: Array.isArray(item.primers) ? item.primers : [],
    })) : [],
    tasks: Array.isArray(state.tasks) ? state.tasks : [],
    sources: Array.isArray(state.sources) ? state.sources : [],
    copilotThreads: Array.isArray(state.copilotThreads) ? state.copilotThreads : [],
    audit: Array.isArray(state.audit) ? state.audit : [],
    members: Array.isArray(state.members) ? state.members : [],
  }
}

function load(): WorkspaceState {
  if (typeof window === "undefined") return clone(starterWorkspace)
  const raw = window.localStorage.getItem(WORKSPACE_KEY)
  if (!raw) {
    const first = clone(starterWorkspace)
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(first))
    return first
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (isWorkspaceState(parsed)) return normalize(parsed)
  } catch {
    // Fall through to a clean workspace rather than leaving the app unusable.
  }

  const fresh = clone(starterWorkspace)
  window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(fresh))
  return fresh
}

function save(state: WorkspaceState) {
  if (typeof window === "undefined") return
  const next = normalize({ ...state, workspace: { ...state.workspace, updatedAt: now() } })
  window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}

function audit(state: WorkspaceState, action: string, objectType: string, objectId: string, detail: string): WorkspaceState {
  const event: AuditEvent = {
    id: makeId("audit"),
    actor: getActiveLabSession()?.profile.displayName || state.members[0]?.displayName || "Local user",
    action,
    objectType,
    objectId,
    detail,
    createdAt: now(),
  }
  return { ...state, audit: [event, ...state.audit].slice(0, 1000) }
}

function updateState(mutator: (state: WorkspaceState) => WorkspaceState) {
  const next = mutator(load())
  save(next)
  return next
}

function replaceById<T extends { id: string }>(items: T[], value: T) {
  const exists = items.some(item => item.id === value.id)
  return exists ? items.map(item => item.id === value.id ? value : item) : [value, ...items]
}

export const storage = {
  eventName: CHANGE_EVENT,

  getState: load,
  saveState: save,
  resetWorkspace: () => save(clone(starterWorkspace)),

  importWorkspace: (value: unknown) => {
    if (!isWorkspaceState(value)) throw new Error("This is not an OpenLab v1 workspace export.")
    save(normalize(value))
  },

  exportWorkspace: () => ({ ...load(), exportedAt: now() }),

  getProjects: () => load().projects,
  saveProject: (value: Project) => updateState(state => audit({ ...state, projects: replaceById(state.projects, value) }, "project.saved", "project", value.id, value.name)),
  deleteProject: (id: string) => updateState(state => audit({ ...state, projects: state.projects.filter(item => item.id !== id) }, "project.deleted", "project", id, "Project deleted")),

  getNotebook: () => load().notebook,
  saveNotebook: (items: NotebookEntry[]) => updateState(state => ({ ...state, notebook: items })),
  saveNotebookEntry: (value: NotebookEntry) => updateState(state => audit({ ...state, notebook: replaceById(state.notebook, value) }, "notebook.saved", "notebook", value.id, value.title)),
  deleteNotebookEntry: (id: string) => updateState(state => audit({ ...state, notebook: state.notebook.filter(item => item.id !== id) }, "notebook.deleted", "notebook", id, "Notebook entry deleted")),

  getProtocols: () => load().protocols,
  saveProtocols: (items: ProtocolRecord[]) => updateState(state => ({ ...state, protocols: items })),
  saveProtocol: (value: ProtocolRecord) => updateState(state => audit({ ...state, protocols: replaceById(state.protocols, value) }, "protocol.saved", "protocol", value.id, value.name)),
  deleteProtocol: (id: string) => updateState(state => audit({ ...state, protocols: state.protocols.filter(item => item.id !== id) }, "protocol.deleted", "protocol", id, "Protocol deleted")),

  getRegistry: () => load().registry,
  saveRegistryEntity: (value: RegistryEntity) => updateState(state => audit({ ...state, registry: replaceById(state.registry, value) }, "registry.saved", "registry", value.id, value.name)),
  deleteRegistryEntity: (id: string) => updateState(state => audit({ ...state, registry: state.registry.filter(item => item.id !== id) }, "registry.deleted", "registry", id, "Registry entity deleted")),

  getInventory: () => load().inventory,
  saveInventory: (items: InventoryItem[]) => updateState(state => ({ ...state, inventory: items })),
  saveInventoryItem: (value: InventoryItem) => updateState(state => audit({ ...state, inventory: replaceById(state.inventory, value) }, "inventory.saved", "inventory", value.id, value.name)),
  deleteInventoryItem: (id: string) => updateState(state => audit({ ...state, inventory: state.inventory.filter(item => item.id !== id) }, "inventory.deleted", "inventory", id, "Inventory item deleted")),

  getSequences: () => load().sequences,
  saveSequence: (value: SequenceRecord) => updateState(state => audit({ ...state, sequences: replaceById(state.sequences, value) }, "sequence.saved", "sequence", value.id, value.name)),
  deleteSequence: (id: string) => updateState(state => audit({
    ...state,
    sequences: state.sequences.filter(item => item.id !== id),
    registry: state.registry.map(item => item.sequenceId === id ? { ...item, sequenceId: undefined, updatedAt: now() } : item),
  }, "sequence.deleted", "sequence", id, "Sequence deleted")),

  getTasks: () => load().tasks,
  saveTask: (value: WorkflowTask) => updateState(state => audit({ ...state, tasks: replaceById(state.tasks, value) }, "task.saved", "task", value.id, value.title)),
  deleteTask: (id: string) => updateState(state => audit({ ...state, tasks: state.tasks.filter(item => item.id !== id) }, "task.deleted", "task", id, "Task deleted")),

  getSources: () => load().sources,
  saveSources: (items: WorkspaceSource[]) => updateState(state => ({ ...state, sources: items })),
  saveSource: (value: WorkspaceSource) => updateState(state => audit({ ...state, sources: replaceById(state.sources, value) }, "source.saved", "source", value.id, value.title)),
  deleteSource: (id: string) => updateState(state => audit({ ...state, sources: state.sources.filter(item => item.id !== id) }, "source.deleted", "source", id, "Source deleted")),

  getCopilotThreads: () => load().copilotThreads,
  saveCopilotThread: (value: CopilotThread) => updateState(state => ({ ...state, copilotThreads: replaceById(state.copilotThreads, value) })),
  deleteCopilotThread: (id: string) => updateState(state => ({ ...state, copilotThreads: state.copilotThreads.filter(item => item.id !== id) })),

  getAudit: () => load().audit,
}
