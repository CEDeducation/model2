# OpenLab Scientific Sandbox

## Goal
The Scientific Sandbox is intentionally different from a normal web chatbot. It does not expose a general-web search tool to the model. A server route queries an allowlist of scientific services, converts returned records into a small evidence packet, and only then asks the optional language model to synthesize that packet.

## Allowlisted sources in v1.2
- Europe PMC: life-science literature metadata, abstracts, and open-access full text when legally exposed by Europe PMC.
- Crossref: scholarly DOI and bibliographic metadata.
- NCBI Gene: gene records.
- NCBI Nucleotide: nucleotide/GenBank-style records discoverable through Entrez.
- NCBI Protein: protein records.
- PubChem: compound records and properties.
- RCSB Protein Data Bank: experimentally determined macromolecular structure records.

No arbitrary URL fetcher or model web-search tool is enabled in the Scientific Sandbox.

## Full text and copyright
OpenLab must not bulk-copy subscription journal full text simply because an article exists in PubMed/Crossref. Metadata and abstracts can be searched where the upstream service permits it. Full-text import is limited to the Europe PMC open-access route implemented by the app, and the user is reminded to respect the article's license.

## Model boundary
If `OPENAI_API_KEY` is absent, OpenLab still performs retrieval and shows source records. If a key is configured, the model receives the retrieved evidence packet. The request sets `store: false`, and the system prompt requires evidence labels such as `[S1]` and forbids unsupported scientific claims.

Private lab Evidence is excluded by default. The researcher must explicitly enable “Include my lab Evidence” before those saved sources are sent in a model request.

## Persistence
Saved Evidence and Copilot history are part of the OpenLab workspace state. In cloud mode, `CloudAutoSync` writes that state to Supabase `workspace_snapshots`. Notebook attachment bytes are stored in the private `openlab-files` Supabase Storage bucket. The browser keeps a local copy for fast/offline use.

Migration `0003_workspace_history.sql` automatically archives the previous cloud snapshot before a new snapshot overwrites it, retaining the most recent 50 historical snapshots per workspace.

## Production note
A four-profile lab sharing one Supabase Auth account is convenient for a trusted small lab, but those subprofiles are not independent security principals. For cryptographically private personal work between lab members, migrate each person to an individual Supabase Auth user and use project-level RLS.
