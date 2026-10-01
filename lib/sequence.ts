import type { SequenceFeature } from "./types"

export type Enzyme = {
  name: string
  motif: string
  cutForward: number
  cutReverse: number
}

export const ENZYMES: Enzyme[] = [
  { name: "EcoRI", motif: "GAATTC", cutForward: 1, cutReverse: 5 },
  { name: "BamHI", motif: "GGATCC", cutForward: 1, cutReverse: 5 },
  { name: "HindIII", motif: "AAGCTT", cutForward: 1, cutReverse: 5 },
  { name: "NotI", motif: "GCGGCCGC", cutForward: 2, cutReverse: 6 },
  { name: "XhoI", motif: "CTCGAG", cutForward: 1, cutReverse: 5 },
  { name: "PstI", motif: "CTGCAG", cutForward: 5, cutReverse: 1 },
  { name: "NheI", motif: "GCTAGC", cutForward: 1, cutReverse: 5 },
  { name: "KpnI", motif: "GGTACC", cutForward: 5, cutReverse: 1 },
  { name: "SalI", motif: "GTCGAC", cutForward: 1, cutReverse: 5 },
  { name: "SmaI", motif: "CCCGGG", cutForward: 3, cutReverse: 3 },
  { name: "XbaI", motif: "TCTAGA", cutForward: 1, cutReverse: 5 },
  { name: "SphI", motif: "GCATGC", cutForward: 5, cutReverse: 1 },
  { name: "SpeI", motif: "ACTAGT", cutForward: 1, cutReverse: 5 },
  { name: "ApaI", motif: "GGGCCC", cutForward: 5, cutReverse: 1 },
  { name: "SacI", motif: "GAGCTC", cutForward: 5, cutReverse: 1 },
  { name: "SacII", motif: "CCGCGG", cutForward: 4, cutReverse: 2 },
  { name: "BglII", motif: "AGATCT", cutForward: 1, cutReverse: 5 },
  { name: "ClaI", motif: "ATCGAT", cutForward: 2, cutReverse: 4 },
  { name: "MluI", motif: "ACGCGT", cutForward: 1, cutReverse: 5 },
  { name: "AgeI", motif: "ACCGGT", cutForward: 1, cutReverse: 5 },
]

const CODONS: Record<string, string> = {
  TTT: "F", TTC: "F", TTA: "L", TTG: "L", TCT: "S", TCC: "S", TCA: "S", TCG: "S",
  TAT: "Y", TAC: "Y", TAA: "*", TAG: "*", TGT: "C", TGC: "C", TGA: "*", TGG: "W",
  CTT: "L", CTC: "L", CTA: "L", CTG: "L", CCT: "P", CCC: "P", CCA: "P", CCG: "P",
  CAT: "H", CAC: "H", CAA: "Q", CAG: "Q", CGT: "R", CGC: "R", CGA: "R", CGG: "R",
  ATT: "I", ATC: "I", ATA: "I", ATG: "M", ACT: "T", ACC: "T", ACA: "T", ACG: "T",
  AAT: "N", AAC: "N", AAA: "K", AAG: "K", AGT: "S", AGC: "S", AGA: "R", AGG: "R",
  GTT: "V", GTC: "V", GTA: "V", GTG: "V", GCT: "A", GCC: "A", GCA: "A", GCG: "A",
  GAT: "D", GAC: "D", GAA: "E", GAG: "G", GGT: "G", GGC: "G", GGA: "G", GGG: "G",
}

// Correct the one codon that is easy to mistype when editing the table by hand.
CODONS.GAG = "E"

const IUPAC = new Set("ACGTRYSWKMBDHVN".split(""))

export function cleanDna(input: string) {
  return input
    .toUpperCase()
    .replace(/U/g, "T")
    .split("")
    .filter(base => IUPAC.has(base))
    .join("")
}

export function canonicalDna(input: string) {
  return cleanDna(input).replace(/[^ACGT]/g, "N")
}

export function gcPercent(sequence: string) {
  const seq = cleanDna(sequence)
  let gc = 0
  let canonical = 0
  for (const base of seq) {
    if ("ACGT".includes(base)) canonical += 1
    if (base === "G" || base === "C") gc += 1
  }
  return canonical ? (gc / canonical) * 100 : 0
}

export function reverseComplement(sequence: string) {
  const pair: Record<string, string> = {
    A: "T", T: "A", G: "C", C: "G", N: "N",
    R: "Y", Y: "R", S: "S", W: "W", K: "M", M: "K", B: "V", V: "B", D: "H", H: "D",
  }
  return [...cleanDna(sequence)].reverse().map(base => pair[base] || "N").join("")
}

export function translateDna(sequence: string, frame = 0) {
  const seq = canonicalDna(sequence).slice(Math.max(0, Math.min(2, frame)))
  let protein = ""
  for (let index = 0; index + 2 < seq.length; index += 3) {
    const codon = seq.slice(index, index + 3)
    protein += /^[ACGT]{3}$/.test(codon) ? (CODONS[codon] || "X") : "X"
  }
  return protein
}

export function findAll(sequence: string, query: string, circular = false) {
  const seq = cleanDna(sequence)
  const needle = cleanDna(query)
  if (!needle || !seq) return []
  const haystack = circular && needle.length > 1 ? seq + seq.slice(0, needle.length - 1) : seq
  const positions: number[] = []
  let from = 0
  while (positions.length < 5000) {
    const index = haystack.indexOf(needle, from)
    if (index < 0 || index >= seq.length) break
    positions.push(index)
    from = index + 1
  }
  return positions
}

export function restrictionSites(sequence: string, circular = false) {
  return ENZYMES.map(enzyme => ({
    ...enzyme,
    positions: findAll(sequence, enzyme.motif, circular),
  })).filter(enzyme => enzyme.positions.length > 0)
}

export function digestFragments(sequenceLength: number, cutPositions: number[], circular: boolean) {
  const cuts = [...new Set(cutPositions.map(value => Math.max(0, Math.min(sequenceLength, Math.trunc(value)))))]
    .sort((a, b) => a - b)
  if (!cuts.length) return [sequenceLength]
  if (!circular) {
    const edges = [0, ...cuts, sequenceLength]
    return edges.slice(1).map((edge, index) => edge - edges[index]).filter(length => length > 0)
  }
  if (cuts.length === 1) return [sequenceLength]
  const fragments = cuts.slice(1).map((cut, index) => cut - cuts[index])
  fragments.push(sequenceLength - cuts[cuts.length - 1] + cuts[0])
  return fragments.sort((a, b) => b - a)
}

export type Orf = {
  id: string
  strand: 1 | -1
  frame: number
  start: number
  end: number
  lengthBp: number
  protein: string
}

function scanOrfsOneStrand(sequence: string, strand: 1 | -1, minAa: number) {
  const seq = strand === 1 ? canonicalDna(sequence) : reverseComplement(canonicalDna(sequence))
  const result: Orf[] = []
  for (let frame = 0; frame < 3; frame += 1) {
    let start = -1
    for (let index = frame; index + 2 < seq.length; index += 3) {
      const codon = seq.slice(index, index + 3)
      if (start < 0 && codon === "ATG") start = index
      if (start >= 0 && (codon === "TAA" || codon === "TAG" || codon === "TGA")) {
        const lengthBp = index + 3 - start
        if (lengthBp / 3 >= minAa) {
          const rawStart = strand === 1 ? start : sequence.length - (index + 3)
          const rawEnd = strand === 1 ? index + 2 : sequence.length - start - 1
          result.push({
            id: `orf-${strand}-${frame}-${start}`,
            strand,
            frame: frame + 1,
            start: Math.min(rawStart, rawEnd),
            end: Math.max(rawStart, rawEnd),
            lengthBp,
            protein: translateDna(seq.slice(start, index + 3)),
          })
        }
        start = -1
      }
    }
  }
  return result
}

export function findOrfs(sequence: string, minAa = 75) {
  return [...scanOrfsOneStrand(sequence, 1, minAa), ...scanOrfsOneStrand(sequence, -1, minAa)]
    .sort((a, b) => b.lengthBp - a.lengthBp)
}

export function oligoTm(sequence: string) {
  const seq = canonicalDna(sequence).replace(/N/g, "")
  if (!seq.length) return 0
  const gc = [...seq].filter(base => base === "G" || base === "C").length
  const at = seq.length - gc
  // Wallace rule for short oligos; empirical GC formula for common PCR-primer lengths.
  // This is intentionally labelled as an estimate in the UI, not a nearest-neighbour thermodynamic model.
  if (seq.length < 14) return 2 * at + 4 * gc
  return 64.9 + 41 * (gc - 16.4) / seq.length
}

function longestComplementRun(a: string, b: string) {
  const left = canonicalDna(a)
  const right = reverseComplement(canonicalDna(b))
  let best = 0
  for (let offset = -right.length; offset <= left.length; offset += 1) {
    let run = 0
    for (let i = 0; i < left.length; i += 1) {
      const j = i - offset
      if (j >= 0 && j < right.length && left[i] === right[j] && left[i] !== "N") {
        run += 1
        best = Math.max(best, run)
      } else {
        run = 0
      }
    }
  }
  return best
}

export function oligoWarnings(sequence: string) {
  const seq = canonicalDna(sequence)
  const warnings: string[] = []
  const gc = gcPercent(seq)
  if (seq.length < 18 || seq.length > 30) warnings.push("length outside 18–30 nt")
  if (gc < 35 || gc > 65) warnings.push("GC outside 35–65%")
  if (/(A{5,}|C{5,}|G{5,}|T{5,})/.test(seq)) warnings.push("homopolymer ≥5")
  const end = seq.slice(-5)
  const endGc = [...end].filter(base => base === "G" || base === "C").length
  if (endGc === 0) warnings.push("no 3′ GC clamp")
  if (endGc >= 4) warnings.push("GC-heavy 3′ end")
  if (longestComplementRun(seq, seq) >= 6) warnings.push("possible self-complementarity")
  return warnings
}

export type PrimerCandidate = {
  sequence: string
  start: number
  end: number
  tm: number
  gc: number
  warnings: string[]
}

export type PrimerPair = {
  forward: PrimerCandidate
  reverse: PrimerCandidate
  ampliconLength: number
  pairWarnings: string[]
}

function scorePrimer(sequence: string, targetTm: number) {
  return Math.abs(oligoTm(sequence) - targetTm) + oligoWarnings(sequence).length * 3
}

export function designPrimerPair(sequence: string, targetStartOneBased: number, targetEndOneBased: number, targetTm = 60): PrimerPair | null {
  const seq = canonicalDna(sequence)
  const start = Math.trunc(targetStartOneBased) - 1
  const end = Math.trunc(targetEndOneBased) - 1
  if (start < 0 || end >= seq.length || end <= start || end - start < 40) return null

  let forward: PrimerCandidate | null = null
  let reverse: PrimerCandidate | null = null
  let fScore = Infinity
  let rScore = Infinity

  for (let length = 18; length <= 28; length += 1) {
    const fSeq = seq.slice(start, start + length)
    if (fSeq.length === length && !fSeq.includes("N")) {
      const score = scorePrimer(fSeq, targetTm)
      if (score < fScore) {
        fScore = score
        forward = { sequence: fSeq, start, end: start + length - 1, tm: oligoTm(fSeq), gc: gcPercent(fSeq), warnings: oligoWarnings(fSeq) }
      }
    }

    const bindingStart = end - length + 1
    const binding = seq.slice(bindingStart, end + 1)
    if (binding.length === length && !binding.includes("N")) {
      const rSeq = reverseComplement(binding)
      const score = scorePrimer(rSeq, targetTm)
      if (score < rScore) {
        rScore = score
        reverse = { sequence: rSeq, start: bindingStart, end, tm: oligoTm(rSeq), gc: gcPercent(rSeq), warnings: oligoWarnings(rSeq) }
      }
    }
  }

  if (!forward || !reverse) return null
  const pairWarnings: string[] = []
  if (Math.abs(forward.tm - reverse.tm) > 3) pairWarnings.push("primer Tm difference >3 °C")
  if (longestComplementRun(forward.sequence, reverse.sequence) >= 6) pairWarnings.push("possible cross-dimer complementarity")
  return { forward, reverse, ampliconLength: end - start + 1, pairWarnings }
}

export function inSilicoPcr(sequence: string, forwardPrimer: string, reversePrimer: string, circular = false) {
  const seq = canonicalDna(sequence)
  const f = canonicalDna(forwardPrimer)
  const reverseBinding = reverseComplement(canonicalDna(reversePrimer))
  const forwardSites = findAll(seq, f, circular)
  const reverseSites = findAll(seq, reverseBinding, circular)
  const products: { start: number; end: number; length: number }[] = []

  for (const start of forwardSites) {
    for (const reverseStart of reverseSites) {
      const end = reverseStart + reverseBinding.length - 1
      if (end >= start) products.push({ start, end, length: end - start + 1 })
      else if (circular) products.push({ start, end, length: seq.length - start + end + 1 })
    }
  }

  return products.sort((a, b) => a.length - b.length).slice(0, 100)
}

export function parseFastaRecords(text: string) {
  const normalized = text.replace(/^\uFEFF/, "").trim()
  if (!normalized) return []
  if (!normalized.includes(">")) return [{ name: "Imported sequence", sequence: cleanDna(normalized) }]

  const result: { name: string; sequence: string }[] = []
  let name = ""
  let body: string[] = []
  const flush = () => {
    if (!name && !body.length) return
    result.push({ name: name || `Sequence ${result.length + 1}`, sequence: cleanDna(body.join("")) })
  }

  for (const line of normalized.split(/\r?\n/)) {
    if (line.trim().startsWith(">")) {
      flush()
      name = line.trim().slice(1).trim()
      body = []
    } else {
      body.push(line)
    }
  }
  flush()
  return result.filter(item => item.sequence.length > 0)
}

export function parseGenBank(text: string) {
  const locus = text.match(/^LOCUS\s+([^\s]+)/m)?.[1] || "Imported GenBank"
  const definition = text.match(/^DEFINITION\s+(.+(?:\n\s{12}.+)*)/m)?.[1]?.replace(/\n\s+/g, " ").trim()
  const accession = text.match(/^VERSION\s+([^\s]+)/m)?.[1] || text.match(/^ACCESSION\s+([^\s]+)/m)?.[1]
  const origin = text.match(/^ORIGIN\b([\s\S]*?)\/\//im)?.[1] || ""
  const sequence = cleanDna(origin.replace(/[0-9\s]/g, ""))
  const features: SequenceFeature[] = []
  const lines = text.split(/\r?\n/)
  const colors = ["#7257c7", "#d56d82", "#d8942f", "#2f9d76", "#4b8fb6", "#9a73cf", "#df7651"]

  for (let index = 0; index < lines.length && features.length < 1000; index += 1) {
    const match = lines[index].match(/^\s{5}(\S+)\s+(.+)/)
    if (!match) continue
    const [, type, rawLocation] = match
    if (type === "source") continue
    const location = rawLocation.trim()
    const direction = /^complement\(/i.test(location) ? -1 as const : 1 as const
    const coordinates = [...location.matchAll(/<?(\d+)/g)].map(match => Number(match[1])).filter(Number.isFinite)
    if (!coordinates.length) continue
    const start = Math.min(...coordinates)
    const end = Math.max(...coordinates)

    let label = type
    let note = ""
    for (let look = index + 1; look < Math.min(index + 20, lines.length); look += 1) {
      if (/^\s{5}\S+\s+/.test(lines[look])) break
      const qualifier = lines[look].match(/^\s+\/(?:label|gene|product)="?([^"\n]+)"?/)
      if (qualifier) label = qualifier[1].trim()
      const noteMatch = lines[look].match(/^\s+\/note="?([^"\n]+)"?/)
      if (noteMatch) note = noteMatch[1].trim()
    }

    features.push({
      id: `gb_${features.length}_${start}_${end}`,
      name: label.slice(0, 120),
      type,
      start: Math.max(0, start - 1),
      end: Math.max(0, end - 1),
      direction,
      color: colors[features.length % colors.length],
      notes: note || undefined,
    })
  }

  const topology: "Circular" | "Linear" = /\bcircular\b/i.test(text.match(/^LOCUS\s+.*$/m)?.[0] || "") ? "Circular" : "Linear"
  return { name: definition || locus, locus, accession, sequence, features, topology }
}

function parseDelimited(text: string, delimiter: "," | "\t") {
  const rows = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(row => row.trim())
  if (rows.length < 2) return []
  const splitCsv = (row: string) => row.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(cell => cell.replace(/^\"|\"$/g, "").trim())
  const split = (row: string) => delimiter === "\t" ? row.split("\t").map(cell => cell.trim()) : splitCsv(row)
  const headers = split(rows[0]).map(value => value.toLowerCase())
  const sequenceIndex = headers.findIndex(header => ["sequence", "dna", "nucleotide", "nucleotides", "seq"].includes(header))
  const nameIndex = headers.findIndex(header => ["name", "id", "identifier", "label", "title"].includes(header))
  if (sequenceIndex < 0) return []
  return rows.slice(1).map((row, index) => {
    const values = split(row)
    return {
      name: values[nameIndex] || `Sequence ${index + 1}`,
      sequence: cleanDna(values[sequenceIndex] || ""),
      features: [] as SequenceFeature[],
    }
  }).filter(item => item.sequence.length > 0)
}

export type ImportedSequence = {
  name: string
  sequence: string
  features: SequenceFeature[]
  accession?: string
  format: "GenBank" | "FASTA" | "CSV" | "TSV" | "JSON" | "Text"
  topology?: "Circular" | "Linear"
}

export function parseSequenceFile(fileName: string, text: string): ImportedSequence[] {
  const lower = fileName.toLowerCase()
  const looksGenBank = /(^|\n)LOCUS\s+/.test(text) && /(^|\n)ORIGIN\b/.test(text)
  if (looksGenBank || /\.(gb|gbk|genbank)$/.test(lower)) {
    const parsed = parseGenBank(text)
    return [{ name: parsed.name, sequence: parsed.sequence, features: parsed.features, accession: parsed.accession, format: "GenBank", topology: parsed.topology }]
  }
  if (/\.json$/.test(lower)) {
    try {
      const value = JSON.parse(text) as unknown
      const records = Array.isArray(value) ? value : [value]
      return records.flatMap((raw, index) => {
        if (!raw || typeof raw !== "object") return []
        const record = raw as Record<string, unknown>
        const sequence = cleanDna(String(record.sequence ?? record.dna ?? record.seq ?? ""))
        if (!sequence) return []
        return [{ name: String(record.name ?? record.id ?? `Sequence ${index + 1}`), sequence, features: [], format: "JSON" as const }]
      })
    } catch {
      return []
    }
  }
  if (/\.csv$/.test(lower)) return parseDelimited(text, ",").map(item => ({ ...item, format: "CSV" as const }))
  if (/\.(tsv|tab)$/.test(lower)) return parseDelimited(text, "\t").map(item => ({ ...item, format: "TSV" as const }))
  const records = parseFastaRecords(text)
  const format = /(^|\n)>/.test(text) || /\.(fa|fasta|fna|fas)$/.test(lower) ? "FASTA" as const : "Text" as const
  return records.map(record => ({ ...record, features: [], format }))
}

export function toFasta(name: string, sequence: string) {
  const lines = cleanDna(sequence).match(/.{1,70}/g) || []
  return `>${name.replace(/\s+/g, "_")}\n${lines.join("\n")}\n`
}

export function toGenBank(name: string, sequence: string, features: SequenceFeature[], topology: "Circular" | "Linear" = "Linear") {
  const seq = canonicalDna(sequence)
  const safeName = name.replace(/\s+/g, "_").slice(0, 16) || "OPENLAB_SEQ"
  const header = `LOCUS       ${safeName.padEnd(16)} ${String(seq.length).padStart(7)} bp    DNA     ${topology.toLowerCase().padEnd(8)} 01-JAN-2000\nDEFINITION  ${name}.\nFEATURES             Location/Qualifiers\n`
  const featureText = features.map(feature => {
    const location = `${feature.start + 1}..${feature.end + 1}`
    const wrapped = feature.direction === -1 ? `complement(${location})` : location
    return `     ${(feature.type || "misc_feature").slice(0, 15).padEnd(16)}${wrapped}\n                     /label="${feature.name.replace(/"/g, "'")}"\n`
  }).join("")
  const lines: string[] = []
  for (let index = 0; index < seq.length; index += 60) {
    const chunk = seq.slice(index, index + 60).toLowerCase()
    const groups = chunk.match(/.{1,10}/g)?.join(" ") || ""
    lines.push(`${String(index + 1).padStart(9)} ${groups}`)
  }
  return `${header}${featureText}ORIGIN\n${lines.join("\n")}\n//\n`
}

export function pairwiseIdentity(a: string, b: string) {
  const left = canonicalDna(a)
  const right = canonicalDna(b)
  if (!left.length || !right.length) return 0
  const length = Math.min(left.length, right.length)
  let match = 0
  for (let index = 0; index < length; index += 1) if (left[index] === right[index]) match += 1
  return (match / Math.max(left.length, right.length)) * 100
}
