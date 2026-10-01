export type Role = "owner" | "admin" | "scientist" | "viewer"

export type WorkspaceMeta = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export type Project = {
  id: string
  name: string
  description: string
  status: "Active" | "Paused" | "Archived"
  createdAt: string
  updatedAt: string
}

export type AttachmentMeta = {
  id: string
  name: string
  type: string
  size: number
  createdAt: string
}

export type NotebookEntry = {
  id: string
  projectId: string | null
  title: string
  status: "Draft" | "Running" | "Complete"
  tags: string[]
  objective: string
  protocol: string
  results: string
  notes: string
  linkedEntityIds: string[]
  attachments: AttachmentMeta[]
  createdAt: string
  updatedAt: string
}

export type ProtocolStep = {
  id: string
  text: string
  durationMin?: number
}

export type ProtocolRecord = {
  id: string
  name: string
  category: "Wet lab" | "Dry lab" | "General"
  version: number
  description: string
  steps: ProtocolStep[]
  tags: string[]
  updatedAt: string
}

export type RegistryEntityType =
  | "DNA"
  | "RNA"
  | "Protein"
  | "Cell line"
  | "Sample"
  | "Compound"
  | "Organism"
  | "Reagent"
  | "Other"

export type RegistryEntity = {
  id: string
  name: string
  type: RegistryEntityType
  schema: string
  description: string
  aliases: string[]
  sequenceId?: string
  parentId?: string
  metadata: Record<string, string>
  createdAt: string
  updatedAt: string
}

export type InventoryItem = {
  id: string
  entityId?: string
  name: string
  category: "Reagent" | "Compound" | "Sample" | "Cell line" | "Plasmid" | "Other"
  location: string
  container: string
  quantity: number
  unit: string
  lowStockAt: number
  lot: string
  vendor: string
  catalogNumber: string
  expiry: string
  updatedAt: string
}

export type SequenceFeature = {
  id: string
  name: string
  type: string
  start: number
  end: number
  direction: 1 | -1
  color: string
  notes?: string
}

export type PrimerRecord = {
  id: string
  name: string
  sequence: string
  start: number
  end: number
  direction: 1 | -1
  color: string
  tm?: number
  gc?: number
}

export type SequenceRecord = {
  id: string
  name: string
  sequence: string
  topology: "Circular" | "Linear"
  moleculeType: "DNA" | "RNA"
  features: SequenceFeature[]
  primers: PrimerRecord[]
  updatedAt: string
  accession?: string
  sourceLabel?: string
  sourceUrl?: string
  notes?: string
}

export type WorkflowTask = {
  id: string
  title: string
  status: "Backlog" | "Ready" | "In progress" | "Blocked" | "Done"
  assignee: string
  projectId: string | null
  linkedEntityIds: string[]
  dueDate: string
  updatedAt: string
}

export type WorkspaceSource = {
  id: string
  title: string
  text: string
  url?: string
  provider?: string
  externalId?: string
  license?: string
  retrievedAt?: string
  createdAt: string
}

export type CopilotCitation = {
  provider: string
  title: string
  url: string
  externalId?: string
}

export type CopilotMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  citations: CopilotCitation[]
  createdAt: string
}

export type CopilotThread = {
  id: string
  title: string
  messages: CopilotMessage[]
  createdAt: string
  updatedAt: string
}

export type AuditEvent = {
  id: string
  actor: string
  action: string
  objectType: string
  objectId: string
  detail: string
  createdAt: string
}

export type Member = {
  id: string
  email: string
  displayName: string
  role: Role
}

export type WorkspaceState = {
  format: "openlab-workspace-v1"
  workspace: WorkspaceMeta
  projects: Project[]
  notebook: NotebookEntry[]
  protocols: ProtocolRecord[]
  registry: RegistryEntity[]
  inventory: InventoryItem[]
  sequences: SequenceRecord[]
  tasks: WorkflowTask[]
  sources: WorkspaceSource[]
  copilotThreads: CopilotThread[]
  audit: AuditEvent[]
  members: Member[]
}

export type EvidenceMatch = {
  sourceId: string
  title: string
  excerpt: string
  score: number
}
