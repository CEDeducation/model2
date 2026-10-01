# OpenLab v1.2

OpenLab is a connected research workspace for academic wet-lab and dry-lab teams. v1.2 is no longer a static UI mock: the core notebook, projects, registry, inventory, protocols, workflows, molecular-biology workspace, evidence vault, local persistence, backups, authentication/cloud sync and audit history are implemented as working application flows.

## What works

- Projects with status, descriptions and links to experiments/tasks.
- Experiment notebook with structured sections, tags, linked registry entities and file attachments.
- Protocol library with ordered/reorderable steps, versions and categories.
- Biological registry for DNA/RNA/proteins/cell lines/samples/compounds/organisms/reagents.
- Inventory with registry linking, lots, catalog numbers, locations, quantities, thresholds and expiry dates.
- Workflow board with drag-and-drop status changes and project/entity links.
- Activity/audit history for local CRUD actions.
- Molecular workspace with sequence library, circular/linear topology, interactive circular maps, feature editing, primer records, FASTA/GenBank/CSV/TSV/JSON/text import, FASTA/GenBank export, motif search, restriction-site analysis, digest fragment calculation, ORF detection, translation, approximate primer design and exact-match in-silico PCR.
- Scientific Sandbox Copilot that searches an allowlist of Europe PMC, Crossref, NCBI Gene/Nucleotide/Protein, PubChem and RCSB PDB. It never exposes an arbitrary web-search tool to the model. Without an AI key it still returns scientific retrieval results; with a server-side key it synthesizes only the retrieved evidence.
- Evidence vault can save scientific records, lab notes, SOP text and legally reusable Europe PMC open-access full text. Private lab Evidence is opt-in for Copilot requests.
- Local-first persistence in the browser, IndexedDB attachment storage, JSON structured-data backup, PWA manifest/service worker and offline shell caching.
- Main lab login plus a second profile-selection layer (up to four PIN-protected researcher profiles).
- Optional Supabase authentication, RLS-protected cloud workspace snapshots, automatic background save and private notebook-attachment sync.
- Local encrypted fallback account/profile flow for offline-only deployments; Supabase remains the production path for multi-device labs.

## Architecture

The code is intentionally split by domain so a human developer can replace one subsystem without rewriting the application:

- `app/` — Next.js routes and the server-side copilot API.
- `components/` — page workspaces and reusable UI.
- `components/molecular/` — circular sequence map, import, primer, restriction and ORF tools.
- `lib/types.ts` — shared domain types.
- `lib/storage.ts` — local structured-data store.
- `lib/file-store.ts` — IndexedDB attachment blobs.
- `lib/sequence.ts` — scientific sequence utilities and parsers.
- `lib/cloud.ts` — Supabase Auth/REST/Storage adapter.
- `lib/research-server.ts` — server-side allowlisted scientific database adapters.
- `lib/research-types.ts` — typed scientific retrieval records.
- `lib/lab-session.ts` — active lab/profile identity.
- `lib/local-auth.ts` — offline-only PBKDF2-protected device account/profile fallback.
- `supabase/migrations/0001_init.sql` — database, RLS, normalized research tables and private file bucket.
- `supabase/migrations/0002_lab_profiles.sql` — maximum-four researcher profiles, PIN hashing and verification RPCs.
- `supabase/migrations/0003_workspace_history.sql` — automatic recovery history for the latest 50 cloud workspace snapshots.
- `docs/SCIENTIFIC_METHODS.md` — what each molecular calculation does and does not claim.
- `docs/ARCHITECTURE.md` — code map and extension guidance.
- `docs/SCIENTIFIC_SANDBOX.md` — source allowlist, privacy boundary, copyright limits and retrieval behavior.

There is deliberately no global state framework or large UI dependency. The application uses React/Next.js and small domain modules so the code remains readable and replaceable.

## Run locally

Requirements: Node.js 20+.

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

For a production check:

```bash
npm run typecheck
npm run build
npm start
```

## Enable cloud accounts and sync

1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/migrations/0001_init.sql`, `0002_lab_profiles.sql`, and `0003_workspace_history.sql` once, in that order.
3. Add these environment variables locally or in Vercel:

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

4. Redeploy. OpenLab now starts at the main lab login. Sign in, create/select the lab workspace, then choose or create one of up to four researcher profiles. Structured workspace changes auto-save to the selected Supabase workspace after a short debounce.

Only the Supabase project URL and anonymous/publishable key belong in `NEXT_PUBLIC_*`. Never put a service-role key in the frontend.

Cloud sync currently moves the complete structured workspace as an RLS-protected snapshot and copies notebook attachment blobs into a private Storage bucket. The normalized tables are included so a later version can move from snapshot sync to record-by-record server persistence without replacing the domain model.

## Scientific Sandbox Copilot

The Copilot now has two independent layers:

1. **Retrieval** — server-side calls only to the scientific services listed in `docs/SCIENTIFIC_SANDBOX.md`. This works without a paid model key.
2. **Synthesis** — optional model summarization over the retrieved packet. The model is not given an unrestricted web-search tool.

To enable synthesis, set:

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-6-luna
```

The API call is server-side and sets `store:false`. Private workspace Evidence is excluded unless the researcher explicitly enables it. For better identification/rate limits with upstream databases you may also set:

```text
NCBI_API_KEY=...
NCBI_EMAIL=...
CROSSREF_MAILTO=...
```

Do **not** bulk-copy subscription journal full text into OpenLab. PubMed/Crossref metadata and abstracts can be searched under upstream terms; full-text import in v1.2 is limited to the Europe PMC open-access route exposed by the application, and article-level license terms still apply.

## Scientific data

`public/reference/` includes pUC19 reference files for import testing. They are starter/reference data, not fabricated assay results.

The browser molecular tools perform real deterministic calculations on the loaded sequence. Primer Tm/design, self-complementarity and ORF detection are lightweight screening methods, not replacements for Primer3, Primer-BLAST, nearest-neighbour thermodynamic analysis, alignment packages or laboratory validation. See `docs/SCIENTIFIC_METHODS.md`.

## Production boundary

This codebase is a serious product foundation, but software alone cannot make a system validated for regulated GxP use. Enterprise deployments still require organizational security review, backups/retention policy, disaster recovery, penetration testing, monitoring, identity-provider integration where required, validation documentation and controlled change-management processes.

OpenLab also does not yet reproduce every specialized Benchling enterprise module or every instrument integration. The objective of v1.2 is a working, maintainable research operating core on which those integrations can be added without rebuilding the application.
