"use client"

import { useEffect, useMemo, useState } from "react"
import { makeId } from "@/lib/id"
import { designPrimerPair, gcPercent, inSilicoPcr, oligoTm, oligoWarnings } from "@/lib/sequence"
import type { PrimerRecord, SequenceRecord } from "@/lib/types"

export default function PrimerPanel({ record, onChange }: { record: SequenceRecord; onChange: (value: SequenceRecord) => void }) {
  const [start, setStart] = useState(1)
  const [end, setEnd] = useState(Math.min(record.sequence.length, 500))
  const [targetTm, setTargetTm] = useState(60)
  const [forwardManual, setForwardManual] = useState("")
  const [reverseManual, setReverseManual] = useState("")

  useEffect(() => {
    setStart(1)
    setEnd(Math.min(record.sequence.length, 500))
    setForwardManual("")
    setReverseManual("")
  }, [record.id, record.sequence.length])

  const pair = useMemo(() => designPrimerPair(record.sequence, start, end, targetTm), [record.sequence, start, end, targetTm])
  const pcr = useMemo(() => forwardManual && reverseManual ? inSilicoPcr(record.sequence, forwardManual, reverseManual, record.topology === "Circular") : [], [record.sequence, record.topology, forwardManual, reverseManual])

  function addDesignedPair() {
    if (!pair) return
    const primers: PrimerRecord[] = [
      { id: makeId("primer"), name: `${record.name} F`, sequence: pair.forward.sequence, start: pair.forward.start, end: pair.forward.end, direction: 1, color: "#377fbd", tm: pair.forward.tm, gc: pair.forward.gc },
      { id: makeId("primer"), name: `${record.name} R`, sequence: pair.reverse.sequence, start: pair.reverse.start, end: pair.reverse.end, direction: -1, color: "#b35c8c", tm: pair.reverse.tm, gc: pair.reverse.gc },
    ]
    onChange({ ...record, primers: [...record.primers, ...primers], updatedAt: new Date().toISOString() })
  }

  return (
    <div className="analysisPanelBody">
      <div className="analysisIntro"><strong>Primer design</strong><span>Candidate primers are calculated from the loaded sequence. Use a validated external specificity workflow before ordering primers for experimental use.</span></div>
      <div className="formGrid threeCol compactForm">
        <label><span>Target start (bp)</span><input type="number" min="1" max={record.sequence.length} value={start} onChange={event => setStart(Number(event.target.value))}/></label>
        <label><span>Target end (bp)</span><input type="number" min="1" max={record.sequence.length} value={end} onChange={event => setEnd(Number(event.target.value))}/></label>
        <label><span>Target Tm °C</span><input type="number" min="45" max="75" step="0.5" value={targetTm} onChange={event => setTargetTm(Number(event.target.value))}/></label>
      </div>
      {pair ? <div className="primerPairCard">
        <PrimerCandidate label="Forward" sequence={pair.forward.sequence} tm={pair.forward.tm} gc={pair.forward.gc} warnings={pair.forward.warnings}/>
        <PrimerCandidate label="Reverse" sequence={pair.reverse.sequence} tm={pair.reverse.tm} gc={pair.reverse.gc} warnings={pair.reverse.warnings}/>
        <div className="pairFooter"><div><strong>{pair.ampliconLength.toLocaleString()} bp</strong><span>predicted amplicon</span>{pair.pairWarnings.map(warning => <small key={warning}>{warning}</small>)}</div><button className="primaryButton" onClick={addDesignedPair}>Add pair to sequence</button></div>
      </div> : <div className="analysisEmpty">Choose a valid region at least 41 bp long.</div>}

      <div className="analysisDivider"/>
      <div className="analysisIntro"><strong>In-silico PCR</strong><span>Paste an exact forward and reverse primer sequence to find compatible amplicons in the loaded record.</span></div>
      <label className="fieldBlock"><span>Forward primer</span><input value={forwardManual} onChange={event => setForwardManual(event.target.value.toUpperCase())} placeholder="5′ → 3′"/></label>
      <label className="fieldBlock"><span>Reverse primer</span><input value={reverseManual} onChange={event => setReverseManual(event.target.value.toUpperCase())} placeholder="5′ → 3′"/></label>
      {forwardManual && <OligoSummary title="Forward" sequence={forwardManual}/>} {reverseManual && <OligoSummary title="Reverse" sequence={reverseManual}/>} 
      {forwardManual && reverseManual && <div className="pcrResults"><strong>{pcr.length} product{pcr.length === 1 ? "" : "s"} found</strong>{pcr.slice(0, 12).map((product, index) => <span key={`${product.start}-${product.end}-${index}`}>{product.start + 1} → {product.end + 1} · {product.length.toLocaleString()} bp</span>)}{!pcr.length && <small>No exact compatible product was found.</small>}</div>}
    </div>
  )
}

function PrimerCandidate({ label, sequence, tm, gc, warnings }: { label: string; sequence: string; tm: number; gc: number; warnings: string[] }) {
  return <div className="primerCandidateV1"><div><span>{label}</span><strong>{tm.toFixed(1)} °C · {gc.toFixed(1)}% GC</strong></div><code>{sequence}</code>{warnings.length ? <small>{warnings.join(" · ")}</small> : <small className="goodText">No simple composition warnings</small>}</div>
}

function OligoSummary({ title, sequence }: { title: string; sequence: string }) {
  const warnings = oligoWarnings(sequence)
  return <div className="oligoSummary"><strong>{title}: {oligoTm(sequence).toFixed(1)} °C · {gcPercent(sequence).toFixed(1)}% GC</strong><span>{warnings.length ? warnings.join(" · ") : "No simple composition warnings"}</span></div>
}
