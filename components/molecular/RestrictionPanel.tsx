"use client"

import { useMemo, useState } from "react"
import { digestFragments, restrictionSites } from "@/lib/sequence"
import type { SequenceRecord } from "@/lib/types"

export default function RestrictionPanel({ record }: { record: SequenceRecord }) {
  const sites = useMemo(() => restrictionSites(record.sequence, record.topology === "Circular"), [record.sequence, record.topology])
  const [selected, setSelected] = useState<string[]>([])
  const selectedSites = sites.filter(site => selected.includes(site.name))
  const cuts = selectedSites.flatMap(site => site.positions.map(position => position + site.cutForward))
  const fragments = digestFragments(record.sequence.length, cuts, record.topology === "Circular")

  return <div className="analysisPanelBody">
    <div className="analysisIntro"><strong>Restriction analysis</strong><span>OpenLab scans exact recognition motifs from the built-in common enzyme set and calculates fragment sizes for the selected digest.</span></div>
    <div className="restrictionTable">
      <div className="restrictionHead"><span>Use</span><span>Enzyme</span><span>Recognition</span><span>Sites</span></div>
      {sites.map(site => <label className="restrictionRow" key={site.name}><input type="checkbox" checked={selected.includes(site.name)} onChange={event => setSelected(event.target.checked ? [...selected, site.name] : selected.filter(name => name !== site.name))}/><strong>{site.name}</strong><code>{site.motif}</code><span>{site.positions.length}</span></label>)}
      {!sites.length && <div className="analysisEmpty">No sites from the built-in common enzyme set were found.</div>}
    </div>
    <div className="digestSummary"><strong>{selected.length ? `Digest: ${selected.join(" + ")}` : "Select enzymes to calculate a digest"}</strong>{selected.length > 0 && <div className="fragmentChips">{fragments.map((length, index) => <span key={`${length}-${index}`}>{length.toLocaleString()} bp</span>)}</div>}</div>
  </div>
}
