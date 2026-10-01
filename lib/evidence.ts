import type { EvidenceMatch, WorkspaceSource } from "./types"

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "to", "of", "in", "on", "for",
  "and", "or", "with", "what", "which", "how", "why", "when", "where", "can", "could", "should",
  "i", "we", "you", "it", "this", "that", "from", "by", "as", "at", "do", "does", "did",
])

function normalizeTerm(term: string) {
  if (term.length > 4 && term.endsWith("s") && !term.endsWith("ss")) return term.slice(0, -1)
  return term
}

function uniqueTerms(text: string) {
  return [...new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\u00C0-\u024f\u4e00-\u9fff]+/g, " ")
      .split(/\s+/)
      .map(normalizeTerm)
      .filter(term => term.length > 2 && !STOP_WORDS.has(term)),
  )]
}

function chunks(text: string) {
  const parts = text
    .split(/\n{2,}|(?<=[.!?。！？])\s+/)
    .map(part => part.trim())
    .filter(Boolean)

  return parts.length ? parts : [text]
}

export function sourceOnlySearch(question: string, sources: WorkspaceSource[], limit = 5): EvidenceMatch[] {
  const queryTerms = uniqueTerms(question)
  if (!queryTerms.length) return []

  const matches: EvidenceMatch[] = []

  for (const source of sources) {
    for (const part of chunks(source.text)) {
      const lower = part.toLowerCase()
      let score = 0

      for (const term of queryTerms) {
        if (lower.includes(term)) score += 2
        score += Math.max(0, lower.split(term).length - 2)
      }

      if (score > 0) {
        matches.push({
          sourceId: source.id,
          title: source.title,
          excerpt: part.slice(0, 900),
          score,
        })
      }
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, limit)
}

export function buildEvidenceResponse(question: string, sources: WorkspaceSource[]) {
  const matches = sourceOnlySearch(question, sources)

  if (!matches.length) {
    return {
      mode: "source-only",
      answer: "Not available in the workspace sources.",
      matches: [],
    }
  }

  return {
    mode: "source-only",
    answer: "I found relevant material in the sources you supplied. The passages below are returned directly without adding outside knowledge.",
    matches,
  }
}
