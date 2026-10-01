# OpenLab architecture

## Design goals

1. Small domain modules instead of one giant component.
2. Scientific calculations isolated from UI code.
3. Local-first operation, with cloud adapters at the boundary.
4. Explicit domain types instead of unstructured JSON in components.
5. No secret keys in browser code.
6. Every external integration can be replaced without changing the notebook/registry/inventory data model.

## Data path

`WorkspaceState` in `lib/types.ts` is the local domain model. `lib/storage.ts` persists it to `localStorage` and emits a single application change event. Notebook file bytes live in IndexedDB through `lib/file-store.ts`. Supabase synchronization is isolated in `lib/cloud.ts`.

This separation means a future server-first store can implement the same CRUD operations and replace local persistence incrementally.

## Molecular biology

`lib/sequence.ts` contains pure functions for parsing and calculations. UI components in `components/molecular/` do not contain scientific formulas. `MolecularWorkspace.tsx` coordinates records, selection and editing; the circular map is isolated in `CircularSequenceMap.tsx`.

When adding a scientific algorithm, put the deterministic logic in `lib/sequence.ts` (or a new focused library module) and keep rendering/input handling in components.

## Adding a new research entity

1. Add the domain type to `lib/types.ts`.
2. Add CRUD methods to `lib/storage.ts`.
3. Add the matching normalized Supabase table and RLS policy if it needs cloud persistence.
4. Build a focused workspace component.
5. Add navigation/route.
6. Add audit entries for mutations.

## External services

- Supabase: `lib/cloud.ts` and `supabase/migrations/`.
- AI synthesis: `app/api/copilot/route.ts` only.
- Browser files: `lib/file-store.ts`.

Do not call paid APIs directly from client components.

## v1.1 account and persistence flow

`AuthGate` is intentionally separate from the research workspaces. It owns the two-step entry flow (main account -> lab profile) and can be replaced later without touching molecular biology or notebook code.

- `lib/cloud.ts`: Supabase Auth, profile RPCs, workspace snapshots and private file storage.
- `lib/local-auth.ts`: offline-only fallback using PBKDF2-derived local password/PIN hashes.
- `lib/lab-session.ts`: active workspace/profile identity shared by the UI and audit layer.
- `components/CloudAutoSync.tsx`: remote hydration plus debounced structured-data and attachment persistence.
- `components/ResumeLocation.tsx`: per-profile last-route restoration.

The current Netflix-style profile layer lives under one main authentication principal. If a future deployment needs private records that other lab members must be cryptographically unable to read, use individual Supabase Auth users and RLS policies rather than relying on profile PINs.
