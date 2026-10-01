# Changelog

## v1.2.0
- Added Scientific Sandbox Copilot with a strict scientific-source allowlist.
- Added live server-side search of Europe PMC, Crossref, NCBI Gene/Nucleotide/Protein, PubChem and RCSB PDB.
- Added Evidence-page scientific search and one-click saving of source records.
- Added Europe PMC open-access full-text import for records that expose a PMCID/Open Access full text.
- Private lab Evidence is excluded from Copilot by default and requires explicit opt-in per session.
- Copilot conversation history now persists in the OpenLab workspace and therefore cloud-syncs with the rest of the workspace.
- Updated optional model default to `gpt-6-luna` and disabled API response storage with `store:false`.
- Added optional NCBI API key/email and Crossref mailto configuration.
- Added automatic Supabase workspace snapshot history (last 50 prior versions) for recovery.

## v1.1.0
- Added main lab login followed by Netflix-style subprofile selection and profile PINs.
- Enforced a maximum of four active cloud lab profiles through a Supabase database function.
- Restored the stronger circular plasmid-map behavior from v0.5 while keeping v1.0 production workspace features.
- Added cloud autosave/restore and attachment synchronization.
