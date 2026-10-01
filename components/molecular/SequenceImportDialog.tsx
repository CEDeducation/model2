"use client"

import { ChangeEvent, DragEvent, useState } from "react"
import { makeId } from "@/lib/id"
import { parseSequenceFile } from "@/lib/sequence"
import type { SequenceRecord } from "@/lib/types"
import { UploadIcon } from "../Icons"

function toRecord(item: ReturnType<typeof parseSequenceFile>[number]): SequenceRecord {
  return {
    id: makeId("seq"),
    name: item.name || "Imported sequence",
    sequence: item.sequence,
    topology: item.topology || "Linear",
    moleculeType: "DNA",
    features: item.features,
    primers: [],
    accession: item.accession,
    sourceLabel: `${item.format} import`,
    updatedAt: new Date().toISOString(),
  }
}

export default function SequenceImportDialog({ onClose, onImport }: { onClose: () => void; onImport: (records: SequenceRecord[]) => void }) {
  const [paste, setPaste] = useState("")
  const [message, setMessage] = useState("")
  const [dragging, setDragging] = useState(false)

  async function importFiles(files: File[]) {
    const next: SequenceRecord[] = []
    for (const file of files.slice(0, 20)) {
      if (file.size > 10_000_000) { setMessage(`${file.name} is larger than the 10 MB browser import limit.`); continue }
      const parsed = parseSequenceFile(file.name, await file.text())
      next.push(...parsed.map(toRecord))
    }
    if (!next.length) return setMessage("No readable sequence records were found. Supported formats: FASTA, GenBank, CSV, TSV, JSON and plain DNA text.")
    onImport(next)
    onClose()
  }

  async function fileChange(event: ChangeEvent<HTMLInputElement>) {
    await importFiles(Array.from(event.target.files || []) as File[])
    event.target.value = ""
  }

  async function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault(); setDragging(false)
    await importFiles(Array.from(event.dataTransfer.files || []) as File[])
  }

  function importPaste() {
    const parsed = parseSequenceFile("pasted.fasta", paste)
    if (!parsed.length) return setMessage("No valid DNA sequence was detected in the pasted text.")
    onImport(parsed.map(toRecord)); onClose()
  }

  return <div className="importModalBackdrop" onMouseDown={event => { if (event.currentTarget === event.target) onClose() }}>
    <div className="importModal importModalV1">
      <div className="importModalHead"><div><span>IMPORT SEQUENCES</span><strong>FASTA, GenBank and structured data</strong><p>Multiple FASTA records and CSV/JSON rows become separate sequence records. GenBank feature annotations are preserved when possible.</p></div><button className="modalClose" onClick={onClose}>×</button></div>
      <label className={`sequenceDropzone ${dragging ? "dragging" : ""}`} onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => void drop(event)}>
        <div className="dropIcon"><UploadIcon size={22}/></div><strong>Drop sequence files here</strong><span>or click to choose files</span><small>.fasta .fa .fna .gb .gbk .csv .tsv .json .txt · up to 10 MB each</small>
        <input className="hiddenFileInput" type="file" multiple accept=".fasta,.fa,.fna,.fas,.gb,.gbk,.genbank,.csv,.tsv,.tab,.json,.txt,text/plain" onChange={event => void fileChange(event)}/>
      </label>
      <div className="importDivider"><span>or paste sequence text</span></div>
      <textarea className="pasteSequence" value={paste} onChange={event => setPaste(event.target.value)} placeholder=">my_sequence\nATGCGT…\n\nYou can paste raw DNA or one/more FASTA records."/>
      {message && <div className="formMessage">{message}</div>}
      <div className="importModalActions"><button className="ghostButton" onClick={onClose}>Cancel</button><button className="primaryButton" disabled={!paste.trim()} onClick={importPaste}>Import pasted sequence</button></div>
    </div>
  </div>
}
