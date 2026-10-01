# OpenLab security notes

## Secrets

- Never put service-role database keys, paid API keys or private credentials in `NEXT_PUBLIC_*` variables.
- `OPENAI_API_KEY` is server-only and is read by the Next.js API route.
- The browser uses only the Supabase URL and anonymous/publishable key; database and storage access are enforced by Row Level Security (RLS).

## Supabase

Run `supabase/migrations/0001_init.sql` in a dedicated Supabase project. It enables RLS on OpenLab tables, creates membership/role policies, and creates a private `openlab-files` bucket. File paths begin with the workspace UUID so storage policies can enforce workspace membership.

Do not deploy with RLS disabled. Do not expose a service-role key to Vercel client-side environment variables.

## Local data

Structured workspace data is stored in browser localStorage; notebook attachment bytes are stored in IndexedDB. This allows local-first/offline work but means anyone with access to the unlocked browser profile can access that local research data.

Use cloud sync and institutional device controls for shared or sensitive environments. A JSON export does not include attachment bytes; cloud sync does.

## Scientific Sandbox Copilot

The Copilot endpoint caps question/evidence sizes and performs retrieval only through hard-coded scientific adapters. No arbitrary-URL fetcher and no general web-search model tool are exposed. The optional model receives a bounded evidence packet and the request sets `store:false`.

Private lab Evidence is excluded by default. It is only included when the researcher explicitly enables that option in the Copilot UI. Model/provider credentials remain server-side. Scientific answers still require human review.

The application must respect upstream database rate limits and article licenses. Europe PMC open-access full text is not equivalent to permission to redistribute every article under identical terms; licenses vary by article.

## Before institutional/regulated deployment

Perform a threat model, dependency scanning, penetration test, backup/restore drill, monitoring setup, incident-response plan, data-retention review and identity/access review. Regulated GxP use additionally requires validation and controlled operational procedures; those requirements cannot be satisfied by source code alone.

## Main lab login and researcher profiles (v1.1)

OpenLab v1.1 supports a two-step entry flow:

1. Supabase Auth verifies the main lab email/password.
2. The user chooses one of up to four lab profiles and enters that profile's PIN.

Cloud profile PINs are never stored in plaintext. `0002_lab_profiles.sql` hashes them with PostgreSQL `pgcrypto`/bcrypt and verifies them inside a security-definer RPC. The browser reads only safe profile-card fields; `pin_hash` is not granted to the authenticated role.

A profile is an identity layer inside one authenticated lab account, not a separate Supabase authentication principal. Therefore profile PINs are appropriate for attribution and preventing casual profile switching, but they must not be described as a strong security boundary between mutually untrusted researchers who all know the main lab password. Labs that require cryptographic isolation between researchers should give each person a separate Supabase Auth account and use workspace membership/RLS as the access-control boundary.

The four-profile limit is enforced server-side by the `create_lab_profile` RPC, not only by the user interface.

Structured workspace changes are automatically pushed to the selected cloud workspace. Notebook attachment blobs are stored in the private `openlab-files` bucket. The browser retains a local copy for offline work and records the last major OpenLab route for each selected profile.


## Cloud recovery history (v1.2)

`0003_workspace_history.sql` archives the previous workspace snapshot before a cloud autosave replaces it and keeps the most recent 50 historical snapshots per workspace. This reduces damage from accidental overwrites, but it is not a substitute for independent database backups or true real-time conflict merging.
