"use client"

import { useEffect, useMemo, useState } from "react"
import { makeId } from "@/lib/id"
import { cleanDna, findAll, gcPercent, reverseComplement, toFasta, toGenBank, translateDna } from "@/lib/sequence"
import { storage } from "@/lib/storage"
import type { SequenceFeature, SequenceRecord, WorkspaceState } from "@/lib/types"
import { DownloadIcon, PlusIcon, TrashIcon, UploadIcon } from "./Icons"
import CircularSequenceMap from "./molecular/CircularSequenceMap"
import OrfPanel from "./molecular/OrfPanel"
import PrimerPanel from "./molecular/PrimerPanel"
import RestrictionPanel from "./molecular/RestrictionPanel"
import SequenceImportDialog from "./molecular/SequenceImportDialog"

type ViewMode = "split" | "map" | "sequence"
type AnalysisTab = "primers" | "restriction" | "orfs"
type MapPanelMode = "linear" | "plasmid" | "metadata"

const featureColors = ["#7257c7", "#d56d82", "#d8942f", "#2f9d76", "#4b8fb6", "#9a73cf", "#df7651"]

function blankSequence(): SequenceRecord {
  return { id: makeId("seq"), name: "Untitled DNA", sequence: "", topology: "Circular", moleculeType: "DNA", features: [], primers: [], updatedAt: new Date().toISOString() }
}

export default function MolecularWorkspace() {
  const [state, setState] = useState<WorkspaceState | null>(null)
  const [activeId, setActiveId] = useState("")
  const [view, setView] = useState<ViewMode>("split")
  const [showImport, setShowImport] = useState(false)
  const [selectedFeatureId, setSelectedFeatureId] = useState("")
  const [analysisTab, setAnalysisTab] = useState<AnalysisTab>("primers")
  const [rotation, setRotation] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [showRestrictionSites, setShowRestrictionSites] = useState(true)
  const [mapPanelMode, setMapPanelMode] = useState<MapPanelMode>("plasmid")
  const [find, setFind] = useState("")
  const [rawEditing, setRawEditing] = useState(false)
  const [rawSequence, setRawSequence] = useState("")
  const [message, setMessage] = useState("")

  const refresh = () => {
    const next = storage.getState()
    setState(next)
    if (!activeId && next.sequences[0]) setActiveId(next.sequences[0].id)
  }

  useEffect(() => {
    refresh()
    window.addEventListener(storage.eventName, refresh)
    return () => window.removeEventListener(storage.eventName, refresh)
  }, [])

  const record = state?.sequences.find(item => item.id === activeId)
  const selectedFeature = record?.features.find(feature => feature.id === selectedFeatureId)
  const findHits = useMemo(() => record && find.trim() ? findAll(record.sequence, find, record.topology === "Circular") : [], [record, find])
  const linkedEntity = state?.registry.find(entity => entity.sequenceId === activeId)

  function save(next: SequenceRecord) {
    const normalized = { ...next, sequence: cleanDna(next.sequence), updatedAt: new Date().toISOString() }
    storage.saveSequence(normalized)
    setMessage("Saved")
    window.setTimeout(() => setMessage(""), 1200)
  }

  function importRecords(records: SequenceRecord[]) {
    records.forEach(item => storage.saveSequence(item))
    if (records[0]) setActiveId(records[0].id)
    setMessage(`${records.length} sequence${records.length === 1 ? "" : "s"} imported`)
  }

  function createBlank() {
    const item = blankSequence()
    storage.saveSequence(item)
    setActiveId(item.id)
    setSelectedFeatureId("")
  }

  function deleteSequence() {
    if (!record || !window.confirm(`Delete sequence “${record.name}”?`)) return
    storage.deleteSequence(record.id)
    setActiveId("")
    setSelectedFeatureId("")
  }

  function addFeature() {
    if (!record || !record.sequence.length) return
    const feature: SequenceFeature = { id: makeId("feature"), name: "New feature", type: "misc_feature", start: 0, end: Math.min(99, record.sequence.length - 1), direction: 1, color: featureColors[record.features.length % featureColors.length] }
    save({ ...record, features: [...record.features, feature] })
    setSelectedFeatureId(feature.id)
  }

  function patchFeature(patch: Partial<SequenceFeature>) {
    if (!record || !selectedFeature) return
    save({ ...record, features: record.features.map(feature => feature.id === selectedFeature.id ? { ...feature, ...patch } : feature) })
  }

  function deleteFeature() {
    if (!record || !selectedFeature) return
    save({ ...record, features: record.features.filter(feature => feature.id !== selectedFeature.id) })
    setSelectedFeatureId("")
  }

  function beginRawEdit() {
    if (!record) return
    setRawSequence(record.sequence)
    setRawEditing(true)
  }

  function applyRawEdit() {
    if (!record) return
    const sequence = cleanDna(rawSequence)
    const max = Math.max(0, sequence.length - 1)
    const features = record.features.filter(feature => feature.start <= max).map(feature => ({ ...feature, end: Math.min(feature.end, max) }))
    const primers = record.primers.filter(primer => primer.start <= max).map(primer => ({ ...primer, end: Math.min(primer.end, max) }))
    save({ ...record, sequence, features, primers })
    setRawEditing(false)
  }

  function download(format: "fasta" | "genbank") {
    if (!record) return
    const text = format === "fasta" ? toFasta(record.name, record.sequence) : toGenBank(record.name, record.sequence, record.features, record.topology)
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${record.name.replace(/[^a-z0-9_-]+/gi, "_")}.${format === "fasta" ? "fasta" : "gb"}`
    link.click(); URL.revokeObjectURL(url)
  }

  function linkToRegistry() {
    if (!record) return
    if (linkedEntity) return window.alert(`This sequence is already linked to registry entity “${linkedEntity.name}”.`)
    const now = new Date().toISOString()
    storage.saveRegistryEntity({ id: makeId("entity"), name: record.name, type: "DNA", schema: record.topology === "Circular" ? "Plasmid" : "DNA sequence", description: "", aliases: [], sequenceId: record.id, metadata: record.accession ? { accession: record.accession } : {}, createdAt: now, updatedAt: now })
    setMessage("Registry entity created")
  }

  return <div className="molecularV1">
    <aside className="molecularLibrary">
      <div className="molecularLibraryHead"><div><strong>DNA & RNA</strong><span>{state?.sequences.length || 0} records</span></div><button className="iconButton" onClick={createBlank}><PlusIcon size={16}/></button></div>
      <button className="importSequenceButton" onClick={() => setShowImport(true)}><UploadIcon size={16}/> Import sequences</button>
      <div className="sequenceLibraryList">{state?.sequences.map(item => <button key={item.id} className={activeId === item.id ? "active" : ""} onClick={() => { setActiveId(item.id); setSelectedFeatureId(""); setRotation(0); setZoom(1); setMapPanelMode(item.topology === "Linear" ? "linear" : "plasmid") }}><span className="sequenceTypeBadge">{item.topology === "Circular" ? "◉" : "━"}</span><div><strong>{item.name}</strong><span>{item.sequence.length.toLocaleString()} bp · {item.features.length} features</span></div></button>)}</div>
    </aside>

    <main className="molecularMain">
      {!record ? <div className="emptyState moleculeEmpty"><div className="emptyIcon">DNA</div><strong>Create or import a sequence</strong><p>OpenLab supports FASTA, GenBank, CSV, TSV, JSON and raw DNA text.</p><div className="buttonRow"><button className="primaryButton" onClick={() => setShowImport(true)}>Import sequence</button><button className="ghostButton" onClick={createBlank}>Blank DNA</button></div></div> : <>
        <header className="molecularTopbar">
          <div className="molecularIdentity"><span className="entityBadge">{record.moleculeType}</span><div><input value={record.name} onChange={event => save({ ...record, name: event.target.value })}/><small>{record.sequence.length.toLocaleString()} bp · {gcPercent(record.sequence).toFixed(1)}% GC · {record.topology}{record.accession ? ` · ${record.accession}` : ""}</small></div></div>
          <div className="molecularActions"><button className="ghostButton" onClick={linkToRegistry}>{linkedEntity ? `Registry: ${linkedEntity.name}` : "Link to registry"}</button><div className="exportMenu"><button className="ghostButton"><DownloadIcon size={15}/> Export</button><div><button onClick={() => download("fasta")}>FASTA</button><button onClick={() => download("genbank")}>GenBank</button></div></div><button className="dangerGhost compactDanger" onClick={deleteSequence}><TrashIcon size={15}/></button></div>
        </header>

        <div className="molecularToolbarV1">
          <div className="workspaceTabs"><button className={view === "split" ? "active" : ""} onClick={() => setView("split")}>Split</button><button className={view === "map" ? "active" : ""} onClick={() => setView("map")}>Map</button><button className={view === "sequence" ? "active" : ""} onClick={() => setView("sequence")}>Sequence</button></div>
          <label className="sequenceFind"><span>Find</span><input value={find} onChange={event => setFind(event.target.value)} placeholder="DNA motif…"/>{find && <b>{findHits.length}</b>}</label>
          <label className="toolbarSelect">Topology<select value={record.topology} onChange={event => save({ ...record, topology: event.target.value as SequenceRecord["topology"] })}><option>Circular</option><option>Linear</option></select></label>
          <label className="toolbarCheckbox"><input type="checkbox" checked={showRestrictionSites} onChange={event => setShowRestrictionSites(event.target.checked)}/> Restriction marks</label>
          {message && <span className="saveToast">{message}</span>}
        </div>

        <div className={`molecularEditorGrid view-${view}`}>
          <section className="molecularInspector">
            <div className="inspectorTitle"><div><strong>Annotations</strong><span>{record.features.length} features · {record.primers.length} primers</span></div><button onClick={addFeature}><PlusIcon size={15}/></button></div>
            <div className="featureListV1">{record.features.map(feature => <button key={feature.id} className={selectedFeatureId === feature.id ? "active" : ""} onClick={() => setSelectedFeatureId(feature.id)}><i style={{ background: feature.color }}/><div><strong>{feature.name}</strong><span>{feature.start + 1}–{feature.end + 1} · {feature.type}</span></div></button>)}</div>
            {selectedFeature && <div className="featureEditorV1"><div className="featureEditorHead"><strong>Edit feature</strong><button onClick={deleteFeature}><TrashIcon size={14}/></button></div><label><span>Name</span><input value={selectedFeature.name} onChange={event => patchFeature({ name: event.target.value })}/></label><label><span>Type</span><input value={selectedFeature.type} onChange={event => patchFeature({ type: event.target.value })}/></label><div className="formGrid twoCol"><label><span>Start</span><input type="number" min="1" max={record.sequence.length} value={selectedFeature.start + 1} onChange={event => patchFeature({ start: Math.max(0, Number(event.target.value) - 1) })}/></label><label><span>End</span><input type="number" min="1" max={record.sequence.length} value={selectedFeature.end + 1} onChange={event => patchFeature({ end: Math.max(0, Number(event.target.value) - 1) })}/></label></div><label><span>Direction</span><select value={selectedFeature.direction} onChange={event => patchFeature({ direction: Number(event.target.value) as 1 | -1 })}><option value={1}>Forward (+)</option><option value={-1}>Reverse (−)</option></select></label><label><span>Color</span><input type="color" value={selectedFeature.color} onChange={event => patchFeature({ color: event.target.value })}/></label><label><span>Notes</span><textarea rows={3} value={selectedFeature.notes || ""} onChange={event => patchFeature({ notes: event.target.value })}/></label>{selectedFeature.type.toLowerCase() === "cds" && <div className="translationPreview"><span>Translation</span><code>{translateFeature(record, selectedFeature).slice(0, 150)}{translateFeature(record, selectedFeature).length > 150 ? "…" : ""}</code></div>}</div>}
            {!!record.primers.length && <div className="primerLibrarySmall"><strong>Primers</strong>{record.primers.map(primer => <div key={primer.id}><i style={{ background: primer.color }}/><span>{primer.name}</span><button onClick={() => save({ ...record, primers: record.primers.filter(item => item.id !== primer.id) })}>×</button></div>)}</div>}
          </section>

          {(view === "split" || view === "map") && <section className="mapPaneV1"><div className="paneHeadV1 paneHeadV1Stack"><div><strong>{mapPanelMode === "metadata" ? "Sequence metadata" : mapPanelMode === "linear" ? "Linear sequence map" : "Plasmid map"}</strong><span>{mapPanelMode === "metadata" ? "record summary, annotation stats and sequence details" : mapPanelMode === "linear" ? "coordinates, annotations and restriction sites" : "hover to auto-rotate · drag to rotate · ctrl/⌘ wheel to zoom"}</span></div><div className="mapSubtabs"><button className={mapPanelMode === "linear" ? "active" : ""} onClick={() => setMapPanelMode("linear")}>LINEAR MAP</button><button className={mapPanelMode === "plasmid" ? "active" : ""} onClick={() => setMapPanelMode("plasmid")}>PLASMID</button><button className={mapPanelMode === "metadata" ? "active" : ""} onClick={() => setMapPanelMode("metadata")}>METADATA</button></div></div>{mapPanelMode === "metadata" ? <div className="mapMetadataPanel"><div className="metadataCardGrid"><div className="metadataPanelCard"><span>Length</span><strong>{record.sequence.length.toLocaleString()} bp</strong></div><div className="metadataPanelCard"><span>GC content</span><strong>{gcPercent(record.sequence).toFixed(1)}%</strong></div><div className="metadataPanelCard"><span>Topology</span><strong>{record.topology}</strong></div><div className="metadataPanelCard"><span>Features</span><strong>{record.features.length}</strong></div></div><div className="metadataTwoCol"><div className="metadataPanelBlock"><strong>Selected record</strong><p>{record.name}</p><ul><li>Molecule type: {record.moleculeType}</li><li>Primers: {record.primers.length}</li><li>Accession: {record.accession || "Not set"}</li><li>Updated: {new Date(record.updatedAt).toLocaleString()}</li></ul></div><div className="metadataPanelBlock"><strong>Annotation summary</strong>{record.features.length ? <ul>{record.features.slice(0, 8).map(feature => <li key={feature.id}>{feature.name} · {feature.start + 1}–{feature.end + 1} · {feature.type}</li>)}</ul> : <p>No annotations yet. Use “Add feature” to create your first annotated region.</p>}</div></div></div> : <CircularSequenceMap record={mapPanelMode === "linear" ? { ...record, topology: "Linear" } : record} selectedFeatureId={selectedFeatureId} onSelectFeature={setSelectedFeatureId} rotation={rotation} onRotationChange={setRotation} zoom={zoom} onZoomChange={setZoom} showRestrictionSites={showRestrictionSites}/>}</section>}

          {(view === "split" || view === "sequence") && <section className="sequencePaneV1"><div className="paneHeadV1"><div><strong>Sequence</strong><span>5′ → 3′ · {findHits.length ? `${findHits.length} find hits` : "editable raw sequence available"}</span></div><button className="ghostButton" onClick={beginRawEdit}>Edit raw sequence</button></div><SequenceText record={record} find={find}/></section>}
        </div>

        <section className="analysisDock">
          <div className="analysisTabs"><button className={analysisTab === "primers" ? "active" : ""} onClick={() => setAnalysisTab("primers")}>Primer design & PCR</button><button className={analysisTab === "restriction" ? "active" : ""} onClick={() => setAnalysisTab("restriction")}>Restriction digest</button><button className={analysisTab === "orfs" ? "active" : ""} onClick={() => setAnalysisTab("orfs")}>ORF finder</button></div>
          {analysisTab === "primers" && <PrimerPanel record={record} onChange={save}/>} {analysisTab === "restriction" && <RestrictionPanel record={record}/>} {analysisTab === "orfs" && <OrfPanel record={record}/>} 
        </section>
      </>}
    </main>

    {showImport && <SequenceImportDialog onClose={() => setShowImport(false)} onImport={importRecords}/>} 
    {rawEditing && record && <div className="importModalBackdrop"><div className="importModal rawEditModal"><div className="importModalHead"><div><span>EDIT SEQUENCE</span><strong>{record.name}</strong><p>Whitespace and numbers are ignored. IUPAC DNA symbols are accepted; U is normalized to T.</p></div><button className="modalClose" onClick={() => setRawEditing(false)}>×</button></div><textarea className="rawSequenceArea" value={rawSequence} onChange={event => setRawSequence(event.target.value.toUpperCase())}/><div className="rawSequenceStats">Parsed length: {cleanDna(rawSequence).length.toLocaleString()} bp</div><div className="importModalActions"><button className="ghostButton" onClick={() => setRawEditing(false)}>Cancel</button><button className="primaryButton" onClick={applyRawEdit}>Apply sequence</button></div></div></div>}
  </div>
}

function translateFeature(record: SequenceRecord, feature: SequenceFeature) {
  const raw = record.sequence.slice(feature.start, feature.end + 1)
  return translateDna(feature.direction === -1 ? reverseComplement(raw) : raw)
}

function SequenceText({ record, find }: { record: SequenceRecord; find: string }) {
  const seq = record.sequence
  const rows: { start: number; text: string }[] = []
  for (let index = 0; index < seq.length; index += 60) rows.push({ start: index, text: seq.slice(index, index + 60) })
  const needle = cleanDna(find)
  return <div className="sequenceTextV1">{rows.map(row => <div className="sequenceLine" key={row.start}><span>{row.start + 1}</span><code>{highlight(row.text, needle)}</code></div>)}{!seq.length && <div className="analysisEmpty">This sequence is empty. Use Edit raw sequence or Import sequences.</div>}</div>
}

function highlight(text: string, needle: string) {
  if (!needle) return text.match(/.{1,10}/g)?.join(" ") || text
  const parts: React.ReactNode[] = []
  let index = 0
  let hit = text.indexOf(needle)
  while (hit >= 0) {
    parts.push(text.slice(index, hit)); parts.push(<mark key={`${hit}-${parts.length}`}>{text.slice(hit, hit + needle.length)}</mark>); index = hit + needle.length; hit = text.indexOf(needle, index)
  }
  parts.push(text.slice(index))
  return parts
}
