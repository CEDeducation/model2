import { NextRequest, NextResponse } from "next/server"
import { buildEvidenceResponse } from "@/lib/evidence"
import { searchScientificSources } from "@/lib/research-server"
import type { ResearchMode, ScientificResult } from "@/lib/research-types"
import type { EvidenceMatch, WorkspaceSource } from "@/lib/types"

const MAX_SOURCES = 80
const MAX_SOURCE_TEXT = 120_000
const MAX_TOTAL_TEXT = 450_000
const MAX_QUESTION = 2_000
const MODES = new Set<ResearchMode>(["all", "literature", "genetics", "chemistry", "structures"])

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin")
  return !origin || origin === request.nextUrl.origin
}

function validatedSources(value: unknown): WorkspaceSource[] | null {
  if (!Array.isArray(value) || value.length > MAX_SOURCES) return null
  let total = 0
  const sources: WorkspaceSource[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") return null
    const row = item as Partial<WorkspaceSource>
    if (typeof row.id !== "string" || typeof row.title !== "string" || typeof row.text !== "string") return null
    if (row.title.length > 180 || row.text.length > MAX_SOURCE_TEXT) return null
    total += row.text.length
    if (total > MAX_TOTAL_TEXT) return null
    sources.push({
      id: row.id.slice(0, 120),
      title: row.title.slice(0, 180),
      text: row.text,
      url: typeof row.url === "string" ? row.url.slice(0, 1000) : undefined,
      provider: typeof row.provider === "string" ? row.provider.slice(0, 80) : undefined,
      externalId: typeof row.externalId === "string" ? row.externalId.slice(0, 120) : undefined,
      license: typeof row.license === "string" ? row.license.slice(0, 120) : undefined,
      retrievedAt: typeof row.retrievedAt === "string" ? row.retrievedAt.slice(0, 40) : undefined,
      createdAt: typeof row.createdAt === "string" ? row.createdAt.slice(0, 40) : "",
    })
  }
  return sources
}

function resultContext(results: ScientificResult[]) {
  return results.map((result, index) => {
    const meta = [result.provider, result.externalId, result.year, result.journal, result.doi ? `DOI ${result.doi}` : ""].filter(Boolean).join(" · ")
    return `SOURCE [S${index + 1}] ${result.title}\n${meta}\n${result.summary}\nURL: ${result.url}`
  }).join("\n\n---\n\n")
}

function workspaceContext(sources: WorkspaceSource[]) {
  return sources.map((source, index) => `LAB SOURCE [L${index + 1}] ${source.title}\n${source.text}\nURL: ${source.url || "not supplied"}`).join("\n\n---\n\n")
}

function publicMatches(results: ScientificResult[]): EvidenceMatch[] {
  return results.slice(0, 12).map((result, index) => ({
    sourceId: result.id,
    title: `${result.provider} · ${result.title}`,
    excerpt: result.summary.slice(0, 900),
    score: 100 - index,
  }))
}

async function answerWithModel(question: string, publicResults: ScientificResult[], labSources: WorkspaceSource[]) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  const model = process.env.OPENAI_MODEL || "gpt-6-luna"
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: "low" },
      instructions: [
        "You are OpenLab Scientific Sandbox Copilot.",
        "Use ONLY the supplied SCIENTIFIC DATABASE RESULTS and optional LAB EVIDENCE.",
        "Do not use unstated model knowledge, general web knowledge, or invented references.",
        "Every factual scientific claim must cite one or more source labels exactly as [S1], [S2], [L1], etc.",
        "If the supplied evidence cannot answer the question, say that the sandbox did not retrieve enough evidence and suggest a narrower scientific search query.",
        "Distinguish database records, abstracts, and full-text lab evidence. Do not imply an abstract is full text.",
        "Do not present experimental suggestions as validated protocols unless the cited source explicitly supports them.",
        "Keep uncertainty, species, experimental context, and study limitations explicit when the evidence contains them.",
      ].join(" "),
      input: `QUESTION\n${question}\n\nSCIENTIFIC DATABASE RESULTS\n${resultContext(publicResults) || "No public scientific results retrieved."}\n\nOPTIONAL LAB EVIDENCE\n${workspaceContext(labSources) || "No private lab evidence included."}`,
      max_output_tokens: 1600,
    }),
  })
  if (!response.ok) return null
  const payload = await response.json() as { output_text?: string }
  if (!payload.output_text) return null
  return { answer: payload.output_text, mode: "scientific-sandbox-model" }
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || 0)
  if (contentLength > 650_000) return NextResponse.json({ error: "Request body is too large." }, { status: 413 })
  if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 })
  if (!(request.headers.get("content-type") || "").includes("application/json")) return NextResponse.json({ error: "JSON request required." }, { status: 415 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  const record = body as { question?: unknown; sources?: unknown; includeWorkspaceEvidence?: unknown; scienceMode?: unknown }
  const question = typeof record.question === "string" ? record.question.trim() : ""
  if (!question || question.length > MAX_QUESTION) return NextResponse.json({ error: "Question is missing or too long." }, { status: 400 })

  const mode = typeof record.scienceMode === "string" && MODES.has(record.scienceMode as ResearchMode) ? record.scienceMode as ResearchMode : "all"
  const includeWorkspaceEvidence = record.includeWorkspaceEvidence === true
  const sources = includeWorkspaceEvidence ? validatedSources(record.sources) : []
  if (includeWorkspaceEvidence && !sources) return NextResponse.json({ error: "Workspace source payload is invalid or exceeds limits." }, { status: 400 })

  const research = await searchScientificSources(question, mode)
  const publicResults = research.results.slice(0, 12)
  const labSources = (sources || []).slice(0, 10)
  const modelAnswer = await answerWithModel(question, publicResults, labSources).catch(() => null)

  if (modelAnswer) {
    return NextResponse.json({
      ...modelAnswer,
      scientificResults: publicResults,
      warnings: research.warnings,
      searchedProviders: research.searchedProviders,
    }, { headers: { "Cache-Control": "no-store" } })
  }

  if (publicResults.length) {
    return NextResponse.json({
      answer: "OpenLab retrieved scientific database records, but no server AI key is configured, so it is showing the evidence without generating a scientific synthesis.",
      mode: "scientific-retrieval-only",
      matches: publicMatches(publicResults),
      scientificResults: publicResults,
      warnings: research.warnings,
      searchedProviders: research.searchedProviders,
    }, { headers: { "Cache-Control": "no-store" } })
  }

  if (labSources.length) {
    const fallback = buildEvidenceResponse(question, labSources)
    return NextResponse.json({ ...fallback, scientificResults: [], warnings: research.warnings, searchedProviders: research.searchedProviders }, { headers: { "Cache-Control": "no-store" } })
  }

  return NextResponse.json({
    answer: "The scientific sandbox did not retrieve enough evidence for this question. Try a narrower gene, compound, protein, accession, DOI, disease, assay, or paper-title query.",
    mode: "no-evidence",
    matches: [],
    scientificResults: [],
    warnings: research.warnings,
    searchedProviders: research.searchedProviders,
  }, { headers: { "Cache-Control": "no-store" } })
}
