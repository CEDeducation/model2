"use client"

import { useEffect, useMemo, useState } from "react"
import { makeId } from "@/lib/id"
import { storage } from "@/lib/storage"
import type { CopilotMessage, CopilotThread, EvidenceMatch } from "@/lib/types"
import type { ResearchMode, ScientificResult } from "@/lib/research-types"
import { ShieldIcon, SparkIcon } from "./Icons"

type Result = {
  answer?: string
  mode?: string
  matches?: EvidenceMatch[]
  scientificResults?: ScientificResult[]
  warnings?: string[]
  searchedProviders?: string[]
  error?: string
}

const THREAD_ID = "scientific-sandbox"

function newThread(): CopilotThread {
  const now = new Date().toISOString()
  return { id: THREAD_ID, title: "Scientific Sandbox", messages: [], createdAt: now, updatedAt: now }
}

function modeLabel(mode: ResearchMode) {
  if (mode === "literature") return "Papers"
  if (mode === "genetics") return "Genetics"
  if (mode === "chemistry") return "Chemistry"
  if (mode === "structures") return "Structures"
  return "All science"
}

export default function CopilotPanel() {
  const [question, setQuestion] = useState("")
  const [thread, setThread] = useState<CopilotThread>(() => newThread())
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [scienceMode, setScienceMode] = useState<ResearchMode>("all")
  const [includeWorkspaceEvidence, setIncludeWorkspaceEvidence] = useState(false)

  useEffect(() => {
    const saved = storage.getCopilotThreads().find(item => item.id === THREAD_ID)
    if (saved) setThread(saved)
  }, [])

  function persist(messages: CopilotMessage[]) {
    const next = { ...thread, messages: messages.slice(-60), updatedAt: new Date().toISOString() }
    setThread(next)
    storage.saveCopilotThread(next)
  }

  async function ask() {
    const cleanQuestion = question.trim()
    if (!cleanQuestion || loading) return

    const userMessage: CopilotMessage = {
      id: makeId("copilot"),
      role: "user",
      text: cleanQuestion,
      citations: [],
      createdAt: new Date().toISOString(),
    }
    const before = [...thread.messages, userMessage]
    persist(before)
    setQuestion("")
    setResult(null)
    setLoading(true)

    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: cleanQuestion,
          scienceMode,
          includeWorkspaceEvidence,
          sources: includeWorkspaceEvidence ? storage.getSources() : [],
        }),
      })
      const payload = await response.json() as Result
      setResult(payload)
      if (payload.error) return
      const citations = (payload.scientificResults || []).slice(0, 12).map(item => ({
        provider: item.provider,
        title: item.title,
        url: item.url,
        externalId: item.externalId,
      }))
      const assistantMessage: CopilotMessage = {
        id: makeId("copilot"),
        role: "assistant",
        text: payload.answer || "No answer returned.",
        citations,
        createdAt: new Date().toISOString(),
      }
      persist([...before, assistantMessage])
    } catch {
      setResult({ error: "The scientific sandbox request failed. No alternative web source was used." })
    } finally {
      setLoading(false)
    }
  }

  function clearHistory() {
    const fresh = newThread()
    setThread(fresh)
    storage.saveCopilotThread(fresh)
    setResult(null)
  }

  const visibleMessages = useMemo(() => thread.messages.slice(-16), [thread.messages])

  return <aside className="copilot scientificCopilot">
    <div className="copilotHead">
      <div className="copilotTitle"><div className="assistantIcon"><SparkIcon size={18}/></div><div><strong>OpenLab Copilot</strong><span>Scientific sandbox · database bounded</span></div></div>
      <span className="sourceOnly">SCIENCE ONLY</span>
    </div>

    <div className="copilotControls">
      <label><span>Search scope</span><select value={scienceMode} onChange={event => setScienceMode(event.target.value as ResearchMode)}><option value="all">All science</option><option value="literature">Papers only</option><option value="genetics">Genetics</option><option value="chemistry">Chemistry</option><option value="structures">Structures</option></select></label>
      <label className="evidenceToggle"><input type="checkbox" checked={includeWorkspaceEvidence} onChange={event => setIncludeWorkspaceEvidence(event.target.checked)}/><span>Include my lab Evidence</span></label>
    </div>

    <div className="copilotNotice"><ShieldIcon size={15}/><span>OpenLab searches only approved scientific databases. The model receives retrieved evidence, not unrestricted web results. Private lab evidence is excluded unless you turn it on.</span></div>

    <div className="copilotThread">
      {!visibleMessages.length && !loading && <div className="copilotEmpty"><div className="sparkOrb"><SparkIcon size={23}/></div><strong>Ask the scientific sandbox</strong><p>Search papers, genetic records, chemical records and structures without general-web retrieval.</p><div className="promptExamples"><button onClick={() => setQuestion("Find recent literature and genetic records for TP53 variants in colorectal cancer")}>TP53 literature + genetics</button><button onClick={() => setQuestion("What records are available for gefitinib and EGFR?")}>Gefitinib + EGFR</button></div></div>}

      {visibleMessages.map(message => message.role === "user" ?
        <div className="userMessage" key={message.id}><span>You</span><p>{message.text}</p></div> :
        <div className="assistantMessage" key={message.id}><div className="messageAvatar"><SparkIcon size={15}/></div><div className="answerBlock"><div className="assistantMode">Scientific sandbox</div><p className="copilotAnswerText">{message.text}</p>{message.citations.slice(0, 6).map((citation, index) => <a className="sourceCard compactSourceCard" href={citation.url} target="_blank" rel="noreferrer" key={`${message.id}-${index}`}><div><span>[S{index + 1}]</span><strong>{citation.provider}</strong></div><p>{citation.title}</p></a>)}</div></div>
      )}

      {loading && <div className="assistantMessage loadingMessage"><div className="messageAvatar"><SparkIcon size={15}/></div><p>Searching {modeLabel(scienceMode).toLowerCase()} sources and checking evidence…</p></div>}
      {result?.error && <div className="errorBox">{result.error}</div>}
      {result?.warnings?.length ? <div className="copilotWarnings">{result.warnings.join(" ")}</div> : null}
      {result?.searchedProviders?.length ? <div className="providerStrip">Searched: {result.searchedProviders.join(" · ")}</div> : null}
    </div>

    <div className="copilotComposer">
      <textarea maxLength={2000} value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void ask() }} placeholder="Ask PubMed/Europe PMC, NCBI, PubChem, PDB…" rows={3}/>
      <div><button className="clearCopilot" type="button" onClick={clearHistory}>Clear</button><span>{question.length}/2000 · Ctrl/⌘ Enter</span><button className="sendCopilot" onClick={() => void ask()} disabled={loading || !question.trim()}>↑</button></div>
    </div>
  </aside>
}
