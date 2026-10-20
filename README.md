# Scholarship Renewal Desk

Browser-based MVP for the SAD Laboratory Examination, Section A. It supports Scholar and Scholarship Staff workflows, persisted policy thresholds, evidence verification, correction/resubmission, compliance evaluation, renewal decisions, and activity history.

The entry screen is **Open Scholarship Monitoring System** with **Login** and **Create account** modes. Login is verified by Supabase Auth, then the application reads the authenticated user's `profiles.role` and opens the Scholar or Staff dashboard. Public registration creates Scholar accounts only; the role is assigned as `scholar` by the signup database trigger. Staff accounts must be assigned by trusted database administration.

## Run locally

1. Install Node.js 18 or later.
2. In this folder, run `npm start`.
3. Open `http://localhost:4173`.
4. Choose **Staff demo** or **Scholar demo** to explore the seeded sample data. Demo data is saved in this browser's local storage and can be reset by clearing this site's storage.

The browser loads Supabase JS v2 from jsDelivr and the font files from Google Fonts. If the network is unavailable, demo mode still works when these assets are cached, but the local app does not include vendored copies.

## Supabase setup

1. Open the Supabase project SQL Editor and run `supabase/migrations/202610200001_scholarship_schema.sql`, then `supabase/migrations/202610200002_auth_signup_profile.sql`.
2. Keep `config.js` local and ignored by Git. It already contains the supplied project URL and publishable key for this workspace. For another checkout, copy `config.example.js` to `config.js` and set `supabaseUrl` and `supabaseAnonKey`.
3. Create one synthetic staff account in Supabase Auth. For live exam fixtures, also create six synthetic scholar accounts with the emails below, or create Scholar accounts from the app's Create account screen. The signup-profile migration creates a Scholar profile from the submitted name, student ID, and program. Set passwords privately in Supabase; never put them in this repository or screenshots.
4. Run `supabase/seed.sql` in the SQL Editor to create the staff profile, scholar assignments, and six fictional semester submissions. Change fixture emails in that script if your Auth accounts use different addresses. The seed script requires the six Auth fixture users to exist first.
5. Sign in through the app. Public registration can create Scholars only. Staff role is assigned only by the seed script or trusted Supabase administration. Scholars receive only their own row through RLS. `register_scholar` links an already-created Auth user by email; it does not create accounts or passwords.

The supplied publishable/anon key is intended for browser use. The database's row-level security (RLS) and checked RPCs are the access boundary. Never put a Supabase service-role key in browser code. No official Registrar grades or payment records are modified.

## Configuration names

- `supabaseUrl`: Supabase project URL.
- `supabaseAnonKey`: Supabase publishable/anon key.

There are no passwords or service-role keys in the source. `config.js` is ignored by Git. The app falls back to local demo mode if live authentication is not available.

## Core behavior

- Scholars submit one record per academic year and semester; GWA is 1.00–5.00 and subject/unit counts are nonnegative integers.
- Program rules live in `public.programs`. Evaluation reads the selected submission's program threshold and treats the exact deadline as on time in Asia/Manila.
- Evidence must be verified by staff before evaluation. Returned submissions require a reason and correction resets verification to Pending.
- Approval requires a Compliant evaluation. Deficient records may be held, not approved. Renewal decisions require notes.
- `public.audit_events` records submission, correction, verification, evaluation, and decision events with actor and timestamp.
- RLS restricts scholars to their own records. Staff-only RPC functions enforce verification, evaluation, renewal decisions, and account assignment.

## Examination artifacts

- [Analysis report](docs/analysis-report.md): A1–A6, UML use-case diagram, detailed use cases, ERD, and traceability matrix.
- [Test results](docs/test-results.md): TC01–TC10 result table and evidence checklist.
- [Supabase migration](supabase/migrations/202610200001_scholarship_schema.sql)
- [Scholar signup/profile migration](supabase/migrations/202610200002_auth_signup_profile.sql)
- [Fictional seed data](supabase/seed.sql)

## Run notes and known limits

- `npm start` uses `npx http-server`; the first run needs access to npm to obtain the small static server package. A static server of your choice can also serve the folder.
- Hosted deployment is not required. The local demo is runnable without a Supabase project, but demo role switching is only for demonstration and is not authentication. Use Supabase Auth plus the supplied RLS for enforced access.
- This workspace cannot create Auth users or apply SQL to your Supabase project. The provided seed script expects the synthetic accounts listed above to be created first. Live RLS and live test-account access must be verified in the project after applying the migration.
- The reference field stores a document reference, not the Registrar's official grade record. There is no Registrar API, file upload service, payment function, SMS, machine learning, or appeal workflow.
- UI account assignment requires an existing Auth user. Staff accounts should be designated by the trusted SQL seed/admin process, never by a scholar-facing form.