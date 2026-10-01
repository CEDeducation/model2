export type ResearchMode = "all" | "literature" | "genetics" | "chemistry" | "structures"

export type ScientificProvider =
  | "Europe PMC"
  | "Crossref"
  | "NCBI Gene"
  | "NCBI Nucleotide"
  | "NCBI Protein"
  | "PubChem"
  | "RCSB PDB"

export type ScientificResult = {
  id: string
  provider: ScientificProvider
  category: "paper" | "gene" | "nucleotide" | "protein" | "compound" | "structure"
  title: string
  summary: string
  url: string
  externalId: string
  year?: string
  authors?: string
  journal?: string
  doi?: string
  pmid?: string
  pmcid?: string
  accession?: string
  license?: string
  openAccess?: boolean
  fullTextAvailable?: boolean
  metadata?: Record<string, string | number | boolean | null>
}

export type ResearchSearchResponse = {
  query: string
  mode: ResearchMode
  results: ScientificResult[]
  warnings: string[]
  searchedProviders: ScientificProvider[]
}
