import { NextRequest, NextResponse } from "next/server"
import { searchScientificSources } from "@/lib/research-server"
import type { ResearchMode } from "@/lib/research-types"

const MODES = new Set<ResearchMode>(["all", "literature", "genetics", "chemistry", "structures"])

export async function POST(request: NextRequest) {
  if (!(request.headers.get("content-type") || "").includes("application/json")) {
    return NextResponse.json({ error: "JSON request required." }, { status: 415 })
  }
  const body = await request.json().catch(() => null) as { query?: unknown; mode?: unknown } | null
  const query = typeof body?.query === "string" ? body.query.trim() : ""
  const mode = typeof body?.mode === "string" && MODES.has(body.mode as ResearchMode) ? body.mode as ResearchMode : "all"
  if (!query || query.length > 500) return NextResponse.json({ error: "Search query is missing or too long." }, { status: 400 })
  const result = await searchScientificSources(query, mode)
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
}
