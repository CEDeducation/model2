import { NextRequest, NextResponse } from "next/server"
import { fetchEuropePmcFullText } from "@/lib/research-server"

export async function POST(request: NextRequest) {
  if (!(request.headers.get("content-type") || "").includes("application/json")) {
    return NextResponse.json({ error: "JSON request required." }, { status: 415 })
  }
  const body = await request.json().catch(() => null) as { pmcid?: unknown } | null
  const pmcid = typeof body?.pmcid === "string" ? body.pmcid.trim().toUpperCase() : ""
  if (!/^PMC\d+$/.test(pmcid)) return NextResponse.json({ error: "A valid PMCID is required." }, { status: 400 })
  try {
    const text = await fetchEuropePmcFullText(pmcid)
    if (!text) return NextResponse.json({ error: "No reusable open-access full text was returned." }, { status: 404 })
    return NextResponse.json({ pmcid, text }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Full-text retrieval failed." }, { status: 502 })
  }
}
