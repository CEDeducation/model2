"use client"

import { useMemo, useState } from "react"
import { findOrfs } from "@/lib/sequence"
import type { SequenceRecord } from "@/lib/types"

export default function OrfPanel({ record }: { record: SequenceRecord }) {
  const [minAa, setMinAa] = useState(75)
  const orfs = useMemo(() => findOrfs(record.sequence, minAa), [record.sequence, minAa])
  return <div className="analysisPanelBody">
    <div className="analysisIntro"><strong>Open reading frames</strong><span>Scan both strands for ATG-initiated ORFs ending at an in-frame stop codon.</span></div>
    <label className="inlineControl"><span>Minimum length</span><input type="number" min="10" max="1000" value={minAa} onChange={event => setMinAa(Number(event.target.value))}/><b>aa</b></label>
    <div className="orfList">{orfs.slice(0, 100).map(orf => <div className="orfRow" key={orf.id}><div><strong>{orf.start + 1}–{orf.end + 1}</strong><span>{orf.strand === 1 ? "+" : "−"} strand · frame {orf.frame}</span></div><b>{Math.floor(orf.lengthBp / 3)} aa</b><code>{orf.protein.slice(0, 48)}{orf.protein.length > 48 ? "…" : ""}</code></div>)}{!orfs.length && <div className="analysisEmpty">No ORFs meet this length threshold.</div>}</div>
  </div>
}
