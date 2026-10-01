import type { ResearchMode, ResearchSearchResponse, ScientificProvider, ScientificResult } from "./research-types"

const USER_AGENT = "OpenLab/1.2 research-sandbox"
const TIMEOUT_MS = 9_000
const MAX_PER_PROVIDER = 4

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
}

async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...(init.headers || {}) },
      cache: "no-store",
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json() as T
  } finally {
    clearTimeout(timer)
  }
}

function providerForMode(mode: ResearchMode): ScientificProvider[] {
  if (mode === "literature") return ["Europe PMC", "Crossref"]
  if (mode === "genetics") return ["Europe PMC", "NCBI Gene", "NCBI Nucleotide", "NCBI Protein", "RCSB PDB"]
  if (mode === "chemistry") return ["Europe PMC", "Crossref", "PubChem", "RCSB PDB"]
  if (mode === "structures") return ["RCSB PDB", "NCBI Protein", "Europe PMC"]
  return ["Europe PMC", "Crossref", "NCBI Gene", "NCBI Nucleotide", "NCBI Protein", "PubChem", "RCSB PDB"]
}

async function searchEuropePmc(query: string): Promise<ScientificResult[]> {
  const url = new URL("https://www.ebi.ac.uk/europepmc/webservices/rest/search")
  url.searchParams.set("query", query)
  url.searchParams.set("format", "json")
  url.searchParams.set("resultType", "core")
  url.searchParams.set("pageSize", String(MAX_PER_PROVIDER))
  const payload = await fetchJson<{ resultList?: { result?: Array<Record<string, unknown>> } }>(url.toString())
  return (payload.resultList?.result || []).map((row, index) => {
    const pmid = cleanText(row.pmid)
    const pmcid = cleanText(row.pmcid)
    const source = cleanText(row.source) || "MED"
    const id = cleanText(row.id) || pmid || pmcid || `epmc-${index}`
    const title = cleanText(row.title) || `Europe PMC record ${id}`
    const summary = cleanText(row.abstractText) || cleanText(row.journalTitle) || "No abstract returned by Europe PMC."
    const doi = cleanText(row.doi)
    const journal = cleanText(row.journalTitle)
    const year = cleanText(row.pubYear)
    const authors = cleanText(row.authorString)
    const openAccess = String(row.isOpenAccess || "").toUpperCase() === "Y"
    return {
      id: `epmc:${id}`,
      provider: "Europe PMC" as const,
      category: "paper" as const,
      title,
      summary,
      url: `https://europepmc.org/article/${encodeURIComponent(source)}/${encodeURIComponent(id)}`,
      externalId: id,
      year: year || undefined,
      authors: authors || undefined,
      journal: journal || undefined,
      doi: doi || undefined,
      pmid: pmid || undefined,
      pmcid: pmcid || undefined,
      license: cleanText(row.license) || undefined,
      openAccess,
      fullTextAvailable: openAccess && Boolean(pmcid),
    }
  })
}

async function searchCrossref(query: string): Promise<ScientificResult[]> {
  const url = new URL("https://api.crossref.org/works")
  url.searchParams.set("query.bibliographic", query)
  url.searchParams.set("rows", String(MAX_PER_PROVIDER))
  const contact = process.env.CROSSREF_MAILTO?.trim()
  if (contact) url.searchParams.set("mailto", contact)
  const payload = await fetchJson<{ message?: { items?: Array<Record<string, unknown>> } }>(url.toString())
  return (payload.message?.items || []).map((row, index) => {
    const titles = Array.isArray(row.title) ? row.title : []
    const containers = Array.isArray(row["container-title"]) ? row["container-title"] : []
    const doi = cleanText(row.DOI)
    const title = cleanText(titles[0]) || `Crossref work ${doi || index + 1}`
    const abstract = cleanText(row.abstract)
    const issued = row.issued as { [key: string]: unknown } | undefined
    const parts = issued && Array.isArray(issued["date-parts"]) ? issued["date-parts"] as unknown[] : []
    const firstPart = Array.isArray(parts[0]) ? parts[0] as unknown[] : []
    const year = firstPart[0] ? String(firstPart[0]) : undefined
    const authorRows = Array.isArray(row.author) ? row.author as Array<Record<string, unknown>> : []
    const authors = authorRows.slice(0, 6).map(author => [cleanText(author.given), cleanText(author.family)].filter(Boolean).join(" ")).filter(Boolean).join(", ")
    return {
      id: `crossref:${doi || index}`,
      provider: "Crossref" as const,
      category: "paper" as const,
      title,
      summary: abstract || `Bibliographic metadata from Crossref${containers[0] ? ` for ${cleanText(containers[0])}` : ""}.`,
      url: doi ? `https://doi.org/${doi}` : "https://search.crossref.org/",
      externalId: doi || `crossref-${index}`,
      doi: doi || undefined,
      year,
      authors: authors || undefined,
      journal: cleanText(containers[0]) || undefined,
    }
  })
}

function ncbiParams() {
  const params = new URLSearchParams({ retmode: "json", retmax: String(MAX_PER_PROVIDER) })
  const apiKey = process.env.NCBI_API_KEY?.trim()
  const email = process.env.NCBI_EMAIL?.trim()
  if (apiKey) params.set("api_key", apiKey)
  if (email) params.set("email", email)
  params.set("tool", "openlab")
  return params
}

async function ncbiSearch(db: "gene" | "nuccore" | "protein", query: string, provider: ScientificProvider, category: ScientificResult["category"]): Promise<ScientificResult[]> {
  const searchParams = ncbiParams()
  searchParams.set("db", db)
  searchParams.set("term", query)
  const search = await fetchJson<{ esearchresult?: { idlist?: string[] } }>(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams.toString()}`)
  const ids = search.esearchresult?.idlist || []
  if (!ids.length) return []

  const summaryParams = ncbiParams()
  summaryParams.delete("retmax")
  summaryParams.set("db", db)
  summaryParams.set("id", ids.join(","))
  const summary = await fetchJson<{ result?: Record<string, unknown> }>(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${summaryParams.toString()}`)
  const result = summary.result || {}

  return ids.map(id => {
    const row = (result[id] || {}) as Record<string, unknown>
    const accession = cleanText(row.caption) || cleanText(row.accessionversion)
    const title = cleanText(row.title) || cleanText(row.description) || cleanText(row.name) || `${provider} ${accession || id}`
    const organism = typeof row.organism === "object" && row.organism ? cleanText((row.organism as Record<string, unknown>).scientificname) : ""
    const length = cleanText(row.slen)
    const description = cleanText(row.description)
    const summaryText = cleanText(row.summary)
    const pieces = [summaryText || description, organism ? `Organism: ${organism}.` : "", length ? `Length: ${length}.` : ""].filter(Boolean)
    const path = db === "gene" ? `gene/${id}` : `${db}/${encodeURIComponent(accession || id)}`
    return {
      id: `${db}:${id}`,
      provider,
      category,
      title,
      summary: pieces.join(" ") || `NCBI ${db} record ${id}.`,
      url: `https://www.ncbi.nlm.nih.gov/${path}`,
      externalId: id,
      accession: accession || undefined,
      metadata: { organism: organism || null, length: length ? Number(length) : null },
    }
  })
}

async function searchPubChem(query: string): Promise<ScientificResult[]> {
  const searchParams = ncbiParams()
  searchParams.set("db", "pccompound")
  searchParams.set("term", query)
  const search = await fetchJson<{ esearchresult?: { idlist?: string[] } }>(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams.toString()}`)
  const ids = (search.esearchresult?.idlist || []).slice(0, MAX_PER_PROVIDER)
  if (!ids.length) return []
  const fields = "Title,MolecularFormula,MolecularWeight,CanonicalSMILES,InChIKey"
  const payload = await fetchJson<{ PropertyTable?: { Properties?: Array<Record<string, unknown>> } }>(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${ids.join(",")}/property/${fields}/JSON`)
  return (payload.PropertyTable?.Properties || []).map(row => {
    const cid = cleanText(row.CID)
    const formula = cleanText(row.MolecularFormula)
    const mw = cleanText(row.MolecularWeight)
    const smiles = cleanText(row.ConnectivitySMILES || row.CanonicalSMILES)
    const inchiKey = cleanText(row.InChIKey)
    const title = cleanText(row.Title) || `PubChem CID ${cid}`
    return {
      id: `pubchem:${cid}`,
      provider: "PubChem" as const,
      category: "compound" as const,
      title,
      summary: [formula && `Formula ${formula}.`, mw && `Molecular weight ${mw}.`, smiles && `Canonical/connected SMILES: ${smiles}.`, inchiKey && `InChIKey: ${inchiKey}.`].filter(Boolean).join(" "),
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
      externalId: cid,
      metadata: { formula: formula || null, molecularWeight: mw || null, smiles: smiles || null, inchiKey: inchiKey || null },
    }
  })
}

async function searchRcsb(query: string): Promise<ScientificResult[]> {
  const payload = await fetchJson<{ result_set?: Array<{ identifier?: string; score?: number }> }>("https://search.rcsb.org/rcsbsearch/v2/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: { type: "terminal", service: "full_text", parameters: { value: query } },
      return_type: "entry",
      request_options: { paginate: { start: 0, rows: MAX_PER_PROVIDER } },
    }),
  })
  const ids = (payload.result_set || []).map(item => item.identifier).filter((id): id is string => Boolean(id)).slice(0, MAX_PER_PROVIDER)
  const rows = await Promise.all(ids.map(async id => {
    try {
      const record = await fetchJson<Record<string, unknown>>(`https://data.rcsb.org/rest/v1/core/entry/${encodeURIComponent(id)}`)
      const struct = (record.struct || {}) as Record<string, unknown>
      const entryInfo = (record.rcsb_entry_info || {}) as Record<string, unknown>
      const exptl = Array.isArray(record.exptl) ? record.exptl as Array<Record<string, unknown>> : []
      const resolutions = Array.isArray(entryInfo.resolution_combined) ? entryInfo.resolution_combined as unknown[] : []
      const title = cleanText(struct.title) || `PDB ${id}`
      const method = cleanText(exptl[0]?.method)
      const resolution = resolutions[0] ? cleanText(resolutions[0]) : ""
      return {
        id: `pdb:${id}`,
        provider: "RCSB PDB" as const,
        category: "structure" as const,
        title,
        summary: [method && `Method: ${method}.`, resolution && `Resolution: ${resolution} Å.`].filter(Boolean).join(" ") || `RCSB PDB structure ${id}.`,
        url: `https://www.rcsb.org/structure/${encodeURIComponent(id)}`,
        externalId: id,
        accession: id,
        metadata: { method: method || null, resolution: resolution ? Number(resolution) : null },
      }
    } catch {
      return {
        id: `pdb:${id}`,
        provider: "RCSB PDB" as const,
        category: "structure" as const,
        title: `PDB ${id}`,
        summary: `RCSB PDB structure matching “${query}”.`,
        url: `https://www.rcsb.org/structure/${encodeURIComponent(id)}`,
        externalId: id,
        accession: id,
      }
    }
  }))
  return rows
}

export async function fetchEuropePmcFullText(pmcid: string) {
  if (!/^PMC\d+$/i.test(pmcid)) throw new Error("A valid PMCID is required.")
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/${encodeURIComponent(pmcid)}/fullTextXML`, { signal: controller.signal, cache: "no-store", headers: { "User-Agent": USER_AGENT } })
    if (!response.ok) throw new Error(`Europe PMC full text request failed (${response.status}).`)
    const xml = await response.text()
    return cleanText(xml).slice(0, 120_000)
  } finally {
    clearTimeout(timer)
  }
}

export async function searchScientificSources(query: string, mode: ResearchMode = "all"): Promise<ResearchSearchResponse> {
  const cleanQuery = query.trim().slice(0, 500)
  if (!cleanQuery) return { query: "", mode, results: [], warnings: [], searchedProviders: [] }
  const providers = providerForMode(mode)
  const jobs: Array<{ provider: ScientificProvider; run: () => Promise<ScientificResult[]> }> = []

  if (providers.includes("Europe PMC")) jobs.push({ provider: "Europe PMC", run: () => searchEuropePmc(cleanQuery) })
  if (providers.includes("Crossref")) jobs.push({ provider: "Crossref", run: () => searchCrossref(cleanQuery) })
  if (providers.includes("NCBI Gene")) jobs.push({ provider: "NCBI Gene", run: () => ncbiSearch("gene", cleanQuery, "NCBI Gene", "gene") })
  if (providers.includes("NCBI Nucleotide")) jobs.push({ provider: "NCBI Nucleotide", run: () => ncbiSearch("nuccore", cleanQuery, "NCBI Nucleotide", "nucleotide") })
  if (providers.includes("NCBI Protein")) jobs.push({ provider: "NCBI Protein", run: () => ncbiSearch("protein", cleanQuery, "NCBI Protein", "protein") })
  if (providers.includes("PubChem")) jobs.push({ provider: "PubChem", run: () => searchPubChem(cleanQuery) })
  if (providers.includes("RCSB PDB")) jobs.push({ provider: "RCSB PDB", run: () => searchRcsb(cleanQuery) })

  const settled = await Promise.allSettled(jobs.map(job => job.run()))
  const warnings: string[] = []
  const results: ScientificResult[] = []
  settled.forEach((outcome, index) => {
    if (outcome.status === "fulfilled") results.push(...outcome.value)
    else warnings.push(`${jobs[index].provider} was temporarily unavailable.`)
  })

  const unique = new Map<string, ScientificResult>()
  for (const result of results) {
    const key = result.doi ? `doi:${result.doi.toLowerCase()}` : `${result.provider}:${result.externalId}`
    if (!unique.has(key)) unique.set(key, result)
  }

  return { query: cleanQuery, mode, results: [...unique.values()].slice(0, 24), warnings, searchedProviders: providers }
}
