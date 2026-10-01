"use client"

import { ChangeEvent, FormEvent, useEffect, useState } from "react"
import { makeId } from "@/lib/id"
import { storage } from "@/lib/storage"
import type { ResearchMode, ResearchSearchResponse, ScientificResult } from "@/lib/research-types"
import type { WorkspaceSource } from "@/lib/types"
import { ShieldIcon, TrashIcon, UploadIcon } from "./Icons"

const MAX_SOURCE_TEXT = 120_000
const MAX_SOURCES = 80

export default function SourceVault() {
  const [sources, setSources] = useState<WorkspaceSource[]>([])
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [text, setText] = useState("")
  const [message, setMessage] = useState("")
  const [query, setQuery] = useState("")
  const [mode, setMode] = useState<ResearchMode>("all")
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<ResearchSearchResponse | null>(null)
  const [importingId, setImportingId] = useState("")

  const refresh = () => setSources(storage.getSources())
  useEffect(() => {
    refresh()
    window.addEventListener(storage.eventName, refresh)
    return () => window.removeEventListener(storage.eventName, refresh)
  }, [])

  function add(event: FormEvent) {
    event.preventDefault()
    const cleanTitle = title.trim()
    const cleanText = text.trim()
    if (!cleanTitle || !cleanText) return
    if (sources.length >= MAX_SOURCES) return setMessage(`The evidence library is capped at ${MAX_SOURCES} sources per workspace.`)
    if (cleanText.length > MAX_SOURCE_TEXT) return setMessage(`A single source is limited to ${MAX_SOURCE_TEXT.toLocaleString()} characters.`)
    storage.saveSource({ id: makeId("source"), title: cleanTitle.slice(0, 180), text: cleanText, url: url.trim() || undefined, createdAt: new Date().toISOString() })
    setTitle(""); setUrl(""); setText("")
    setMessage("Source added. It will be included only when you enable lab Evidence in Copilot.")
  }

  async function importTextFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (file.size > 2_000_000) return setMessage("Text imports are capped at 2 MB per file.")
    if (sources.length >= MAX_SOURCES) return setMessage(`The library already has ${MAX_SOURCES} sources.`)
    const allowed = ["text/plain", "text/markdown", "text/csv", "application/json", ""]
    if (!allowed.includes(file.type)) return setMessage("Import plain-text, Markdown, CSV or JSON source files here.")
    const fileText = (await file.text()).slice(0, MAX_SOURCE_TEXT)
    if (!fileText.trim()) return setMessage("That file did not contain readable text.")
    storage.saveSource({ id: makeId("source"), title: file.name.slice(0, 180), text: fileText, createdAt: new Date().toISOString() })
    setMessage(`Imported ${file.name}.`)
  }

  async function searchScientific(event: FormEvent) {
    event.preventDefault()
    const clean = query.trim()
    if (!clean || searching) return
    setSearching(true)
    setMessage("")
    try {
      const response = await fetch("/api/research/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: clean, mode }) })
      const payload = await response.json() as ResearchSearchResponse & { error?: string }
      if (!response.ok || payload.error) throw new Error(payload.error || "Scientific search failed.")
      setSearchResult(payload)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Scientific search failed.")
    } finally {
      setSearching(false)
    }
  }

  function saveScientificResult(result: ScientificResult, sourceText = result.summary) {
    if (sources.length >= MAX_SOURCES) return setMessage(`The evidence library already has ${MAX_SOURCES} sources.`)
    storage.saveSource({
      id: makeId("source"),
      title: result.title.slice(0, 180),
      text: sourceText.slice(0, MAX_SOURCE_TEXT),
      url: result.url,
      provider: result.provider,
      externalId: result.externalId,
      license: result.license,
      retrievedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    })
    setMessage(`Saved ${result.provider} record to Evidence.`)
  }

  async function importOpenAccessFullText(result: ScientificResult) {
    if (!result.pmcid || !result.fullTextAvailable) return
    setImportingId(result.id)
    setMessage("")
    try {
      const response = await fetch("/api/research/fulltext", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pmcid: result.pmcid }) })
      const payload = await response.json() as { text?: string; error?: string }
      if (!response.ok || !payload.text) throw new Error(payload.error || "Full-text retrieval failed.")
      saveScientificResult(result, payload.text)
      setMessage(`Imported open-access full text for ${result.pmcid}. Check the article license before redistribution.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Full-text retrieval failed.")
    } finally {
      setImportingId("")
    }
  }

  return (
    <div className="sourceStack">
      <section className="scientificSearch surfaceCard">
        <div className="cardHeader"><div><div className="sectionEyebrow">SCIENTIFIC SANDBOX</div><h2>Search approved research databases</h2><p>Search literature and scientific databases without using general-web results.</p></div><span className="sourceOnly">WHITELISTED</span></div>
        <form className="scienceSearchForm" onSubmit={searchScientific}>
          <input value={query} maxLength={500} onChange={event => setQuery(event.target.value)} placeholder="Gene, compound, protein, DOI, accession, disease, assay…"/>
          <select value={mode} onChange={event => setMode(event.target.value as ResearchMode)}><option value="all">All science</option><option value="literature">Papers</option><option value="genetics">Genetics</option><option value="chemistry">Chemistry</option><option value="structures">Structures</option></select>
          <button className="primaryButton" disabled={searching || !query.trim()}>{searching ? "Searching…" : "Search"}</button>
        </form>
        {searchResult?.warnings?.length ? <div className="copilotWarnings">{searchResult.warnings.join(" ")}</div> : null}
        {searchResult && <div className="scienceResults">
          {!searchResult.results.length && <div className="emptyState compact"><strong>No scientific records found</strong><p>Try a specific gene symbol, compound name, DOI, accession or paper title.</p></div>}
          {searchResult.results.map(result => <article className="scienceResult" key={result.id}>
            <div className="scienceResultHead"><div><span className="providerBadge">{result.provider}</span><strong>{result.title}</strong><small>{[result.year, result.journal, result.externalId].filter(Boolean).join(" · ")}</small></div><a href={result.url} target="_blank" rel="noreferrer">Open source ↗</a></div>
            <p>{result.summary || "No abstract/summary returned by the source."}</p>
            <div className="scienceResultActions"><button className="ghostButton" onClick={() => saveScientificResult(result)}>Save record</button>{result.fullTextAvailable && result.pmcid && <button className="ghostButton" disabled={importingId === result.id} onClick={() => void importOpenAccessFullText(result)}>{importingId === result.id ? "Importing…" : "Import OA full text"}</button>}</div>
          </article>)}
        </div>}
      </section>

      <div className="sourceGrid">
        <section className="sourceForm surfaceCard">
          <div className="sectionEyebrow">ADD LAB EVIDENCE</div><h2>Private workspace source</h2>
          <div className="sourceSecurity"><ShieldIcon size={17}/><span>Private lab evidence stays out of public-science Copilot requests unless you explicitly enable “Include my lab Evidence”.</span></div>
          <form onSubmit={add}>
            <label>Title<input maxLength={180} value={title} onChange={event => setTitle(event.target.value)} placeholder="Paper, SOP, method note…" required/></label>
            <label>Source URL (optional)<input value={url} onChange={event => setUrl(event.target.value)} placeholder="https://…"/></label>
            <label>Source text<textarea maxLength={MAX_SOURCE_TEXT} value={text} onChange={event => setText(event.target.value)} rows={12} placeholder="Paste evidence text you are allowed to store…" required/></label>
            <div className="formFooter"><span>{text.length.toLocaleString()} / {MAX_SOURCE_TEXT.toLocaleString()}</span><button className="primaryButton" type="submit">Add source</button></div>
          </form>
          <div className="importDivider"><span>or</span></div>
          <label className="ghostButton fileButton wideButton"><UploadIcon size={15}/> Import text / Markdown / CSV / JSON<input type="file" accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json" onChange={event => void importTextFile(event)}/></label>
          {message && <div className="formMessage">{message}</div>}
        </section>

        <section className="sourceList surfaceCard">
          <div className="cardHeader"><div><div className="sectionEyebrow">EVIDENCE LIBRARY</div><h2>{sources.length} source{sources.length === 1 ? "" : "s"}</h2></div><span className="sourceOnly">SAVED</span></div>
          {!sources.length && <div className="emptyState compact"><strong>No saved evidence yet</strong><p>Search approved databases above or add lab evidence manually.</p></div>}
          {sources.map(source => <article className="sourceItem" key={source.id}><div className="sourceItemTop"><div><strong>{source.title}</strong><span>{[source.provider, source.externalId, new Date(source.createdAt).toLocaleString()].filter(Boolean).join(" · ")}</span></div><button className="iconButton subtle" onClick={() => storage.deleteSource(source.id)}><TrashIcon size={15}/></button></div>{source.url && <a className="sourceUrl" href={source.url} target="_blank" rel="noreferrer">{source.url}</a>}<p>{source.text.slice(0, 360)}{source.text.length > 360 ? "…" : ""}</p><small>{source.text.length.toLocaleString()} characters{source.license ? ` · ${source.license}` : ""}</small></article>)}
        </section>
      </div>
    </div>
  )
}
