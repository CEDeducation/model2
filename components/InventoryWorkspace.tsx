"use client"

import { useEffect, useMemo, useState } from "react"
import { makeId } from "@/lib/id"
import { storage } from "@/lib/storage"
import type { InventoryItem, WorkspaceState } from "@/lib/types"
import { PlusIcon, TrashIcon } from "./Icons"

const categories: InventoryItem["category"][] = ["Reagent", "Compound", "Sample", "Cell line", "Plasmid", "Other"]

function freshItem(): InventoryItem {
  return {
    id: makeId("inv"), name: "Untitled item", category: "Reagent", location: "", container: "", quantity: 0,
    unit: "", lowStockAt: 0, lot: "", vendor: "", catalogNumber: "", expiry: "", updatedAt: new Date().toISOString(),
  }
}

export default function InventoryWorkspace() {
  const [state, setState] = useState<WorkspaceState | null>(null)
  const [activeId, setActiveId] = useState("")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("All")

  const refresh = () => {
    const next = storage.getState()
    setState(next)
    if (!activeId && next.inventory[0]) setActiveId(next.inventory[0].id)
  }

  useEffect(() => {
    refresh()
    window.addEventListener(storage.eventName, refresh)
    return () => window.removeEventListener(storage.eventName, refresh)
  }, [])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return state?.inventory.filter(item => {
      const categoryMatch = filter === "All" || item.category === filter
      const queryMatch = !needle || `${item.name} ${item.location} ${item.lot} ${item.vendor} ${item.catalogNumber}`.toLowerCase().includes(needle)
      return categoryMatch && queryMatch
    }) || []
  }, [state, query, filter])

  const active = state?.inventory.find(item => item.id === activeId)

  function create() {
    const item = freshItem()
    storage.saveInventoryItem(item)
    setActiveId(item.id)
  }

  function save(patch: Partial<InventoryItem>) {
    if (!active) return
    storage.saveInventoryItem({ ...active, ...patch, updatedAt: new Date().toISOString() })
  }

  function remove() {
    if (!active || !window.confirm(`Delete inventory record “${active.name}”?`)) return
    storage.deleteInventoryItem(active.id)
    setActiveId("")
  }

  return (
    <div className="splitWorkspace inventoryV1">
      <aside className="recordListPane inventoryListPane">
        <div className="recordListHeader"><div><strong>Inventory</strong><span>{state?.inventory.length || 0} records</span></div><button className="iconButton" onClick={create}><PlusIcon size={17}/></button></div>
        <div className="listSearch"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search inventory…"/><select value={filter} onChange={event => setFilter(event.target.value)}><option>All</option>{categories.map(category => <option key={category}>{category}</option>)}</select></div>
        <div className="recordList">
          {visible.map(item => {
            const low = item.quantity <= item.lowStockAt
            return <button key={item.id} className={`recordRow ${activeId === item.id ? "active" : ""}`} onClick={() => setActiveId(item.id)}><div><strong>{item.name}</strong><span>{item.location || "No location"} · {item.quantity} {item.unit}</span></div>{low && <small className="warningBadge">Low</small>}</button>
          })}
        </div>
      </aside>

      <section className="recordEditorPane">
        {!active ? <div className="emptyState"><strong>Track physical materials</strong><p>Create inventory records and link them to canonical registry entities.</p><button className="primaryButton" onClick={create}>New inventory item</button></div> : (
          <div className="recordEditorCard">
            <div className="editorTopline"><div className="sectionEyebrow">INVENTORY RECORD</div><button className="dangerGhost" onClick={remove}><TrashIcon size={15}/> Delete</button></div>
            <input className="entryTitle" value={active.name} onChange={event => save({ name: event.target.value })}/>
            <div className="formGrid threeCol">
              <label><span>Category</span><select value={active.category} onChange={event => save({ category: event.target.value as InventoryItem["category"] })}>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
              <label><span>Registry entity</span><select value={active.entityId || ""} onChange={event => save({ entityId: event.target.value || undefined })}><option value="">Not linked</option>{state?.registry.map(entity => <option value={entity.id} key={entity.id}>{entity.name}</option>)}</select></label>
              <label><span>Expiry</span><input type="date" value={active.expiry} onChange={event => save({ expiry: event.target.value })}/></label>
              <label><span>Location</span><input value={active.location} onChange={event => save({ location: event.target.value })} placeholder="Freezer 1 / Rack 2"/></label>
              <label><span>Container</span><input value={active.container} onChange={event => save({ container: event.target.value })} placeholder="Box A / vial 12"/></label>
              <label><span>Lot</span><input value={active.lot} onChange={event => save({ lot: event.target.value })}/></label>
              <label><span>Quantity</span><input type="number" min="0" step="any" value={active.quantity} onChange={event => save({ quantity: Number(event.target.value) })}/></label>
              <label><span>Unit</span><input value={active.unit} onChange={event => save({ unit: event.target.value })} placeholder="mL, vials, mg…"/></label>
              <label><span>Low-stock threshold</span><input type="number" min="0" step="any" value={active.lowStockAt} onChange={event => save({ lowStockAt: Number(event.target.value) })}/></label>
              <label><span>Vendor</span><input value={active.vendor} onChange={event => save({ vendor: event.target.value })}/></label>
              <label><span>Catalogue number</span><input value={active.catalogNumber} onChange={event => save({ catalogNumber: event.target.value })}/></label>
            </div>
            <div className={`inventoryStatusCard ${active.quantity <= active.lowStockAt ? "low" : "ok"}`}><strong>{active.quantity <= active.lowStockAt ? "Low stock" : "Stock level OK"}</strong><span>{active.quantity} {active.unit || "units"} available · threshold {active.lowStockAt} {active.unit || "units"}</span></div>
          </div>
        )}
      </section>
    </div>
  )
}
