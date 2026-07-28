# OLOD NOTARY MANAGEMENT SYSTEM — MASTER BUILD PLAN

> **Status:** Planning complete. No code written yet. Folder is empty.
> **Date:** 2026-07-27
> **Owner:** ismailbulbul381@gmail.com

---

## PART 0 — CURRENT INFRASTRUCTURE STATUS (verified via Supabase MCP)

| Item | Value |
|---|---|
| Supabase organization | `juusymali` — id `vjizmomviezwwruoeybn` |
| Existing projects | `somali-fitness` (ref `qielxcrokardedqiosey`, eu-central-1, PG 17.6) |
| OLOD notary project | **DOES NOT EXIST YET — must be created** |
| New project cost | **$0 / month** (free tier) |
| Decision | Create a **separate dedicated project** named `olod-notary` |

**Why a separate project and not a new schema inside `somali-fitness`:**

1. `auth.users` is global per project. Sharing it would put fitness app users and notary employees in the same auth table.
2. Storage buckets and their policies are project-scoped — notary legal documents must be fully isolated.
3. RLS helper functions like `auth_role()` would collide across two different role systems.
4. Independent backups, independent keys, independent rotation, independent blast radius.
5. Separate Realtime channels — no cross-app noise.

**Region choice:** `eu-central-1` (Frankfurt) — same as existing project, lowest latency to Somalia among current Supabase regions.

---

## PART 1 — FULL MASTER PROMPT (the complete specification)

### 1.1 Product identity

Build **OLOD Notary Management System**, production-ready internal office software for a Somali notary office, using **Vite + React + Tailwind CSS + Supabase (Auth, PostgreSQL, Storage, RLS, Realtime, Edge Functions)**, deployed to **Vercel**.

Design language: clean **white background**, **dark blue** accents (`#0F2C59` primary, `#1E3A8A` hover, `#F8FAFC` surfaces), professional legal-office feel. Responsive for desktop, laptop, and tablet office use. Enterprise-grade, fast, secure, maintainable for many years.

### 1.2 Access model

- **No public registration.** Sign-ups disabled at the Supabase project level.
- **Admin creates every account:** full name, username, temporary password, phone number, role, active status.
- On first login the employee **must change their password** before reaching any dashboard.
- Passwords are handled entirely by Supabase Auth (bcrypt). The app never stores or sees a raw password.
- Accounts auto-lock after 5 consecutive failed logins; only Admin can unlock.

### 1.3 Roles

| Role | Job | Scope |
|---|---|---|
| **Admin** | Owner / manager | Unrestricted |
| **Registration** | Receptionist | Client intake, discount requests |
| **ALT** | Document department | Document upload, print, versioning |
| **Finance** | Cashier / accountant | Payments, receipts, invoices, expenses, reports |

### 1.4 Permission matrix (enforced in RLS, not only in UI)

| Action | Admin | Registration | ALT | Finance |
|---|:--:|:--:|:--:|:--:|
| Create / edit / disable employee | YES | no | no | no |
| Create service / **edit price** | YES | no | no | no |
| Define service dynamic fields | YES | no | no | no |
| Register client | YES | YES | no | no |
| Request discount (reason only) | YES | YES | no | no |
| **Approve discount + set amount** | YES | no | no | no |
| Upload / replace / print document | YES | no | YES | no |
| Receive payment | YES | no | no | YES |
| Print / reprint receipt & invoice | YES | no | no | YES |
| Record expense | YES | no | no | YES |
| View financial reports | YES | no | no | YES |
| View activity logs | YES | no | no | no |
| Edit a completed payment | **NOBODY** — correction record only | | | |

### 1.5 The workflow

```
REGISTERED
   |
   +-- discount requested? --> WAITING ADMIN APPROVAL --> (approve/reject)
   |
   v
WAITING ALT  -->  DOCUMENT UPLOADED  -->  WAITING PAYMENT  -->  PAID  -->  COMPLETED
                                                                    
CANCELLED reachable from any stage with a mandatory reason.
```

Every transition writes an `activity_logs` row via **database trigger** (cannot be skipped by the frontend) and fires a **notification** to the next role.

### 1.6 Non-negotiable business rules

1. **Price is read-only for everyone except Admin** — enforced in UI, in form state, and in RLS.
2. **Registration never types a discount amount** — only a reason. The field does not exist in their UI.
3. **Only Admin sets the discount amount.** On approval, `final_price` is locked permanently.
4. **The system never generates legal documents.** ALT writes them manually in Microsoft Word outside the system and uploads the finished file.
5. **Finance never retypes client data** — everything is pulled from the existing client record.
6. **Payments are immutable.** A `BEFORE UPDATE` trigger raises an exception. Mistakes require an Admin-approved `payment_corrections` row.
7. **Receipts and invoices are frozen snapshots.** Changing a service price in 2027 must not alter a 2026 receipt.
8. **Income is never typed** — it is `SUM(payments)`. Expenses are the only manual money entry.
9. **Profit is never stored** — computed as `SUM(payments) - SUM(expenses)` at read time.
10. **Nothing is hard-deleted** — `deleted_at` soft delete everywhere.
11. **Services are disabled, never deleted** — historical records keep original name and price.
12. **Service-specific fields are data, not code** — Admin defines them per service.

---

## PART 2 — BUILD PHASES (exact order of execution)

Each phase is independently testable. Do not start a phase before the previous one runs green.

---

### PHASE 0 — Supabase project provisioning

**MCP / dashboard actions:**
1. `create_project` -> name `olod-notary`, org `vjizmomviezwwruoeybn`, region `eu-central-1`.
2. Wait for `ACTIVE_HEALTHY`.
3. `get_project_url` and `get_publishable_keys` -> store as env vars.
4. Auth settings: **disable public sign-ups**, set session length, enable email confirmations OFF (internal accounts).
5. Enable extensions: `pg_trgm` (fuzzy name search), `pgcrypto` (uuid), `uuid-ossp`.
6. Create private storage bucket `client-documents` (10 MB limit, allowed MIME: doc, docx, pdf).
7. Create public bucket `office-assets` (logo, signature, stamp, avatars).

**Exit test:** project reachable, buckets exist, sign-up returns 422.

---

### PHASE 1 — Project scaffold

```bash
npm create vite@latest . -- --template react
npm i react-router-dom @supabase/supabase-js @tanstack/react-query
npm i react-hook-form zod @hookform/resolvers
npm i recharts date-fns lucide-react clsx
npm i react-hot-toast
npm i -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Create folder tree (see PART 4), Tailwind theme with the dark-blue palette, `src/lib/supabaseClient.js`, `.env.local`, `.env.example`, `.gitignore`, `vercel.json` SPA rewrite.

**Exit test:** `npm run dev` renders a themed blank shell; Supabase client connects.

---

### PHASE 2 — Database: tables + indexes

Migration `001_core_schema.sql`. All 14 required tables plus 6 supporting tables.

**Required tables:** `roles`, `users`, `services`, `clients`, `client_service_details`, `discount_requests`, `uploaded_documents`, `payments`, `receipts`, `invoices`, `expenses`, `activity_logs`, `office_settings`, `notifications`

**Supporting tables (needed to satisfy the spec):**
| Table | Why it is required |
|---|---|
| `service_field_definitions` | "Admin defines required fields for each service" |
| `document_print_logs` | "increment print count and record the employee responsible" |
| `login_history` | "record every login and logout event" |
| `number_sequences` | "configurable prefix such as OLOD-2026-000001" |
| `payment_corrections` | "require an Admin-approved correction record" |
| `expense_categories` | "Categories include ... and Custom Categories" |

Every table gets `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at`, `created_by`, and `deleted_at` where soft delete applies.

**Enums:**
```sql
client_status: registered | waiting_admin_approval | waiting_alt |
               document_uploaded | waiting_payment | paid | completed | cancelled
payment_method: cash | evc_plus | zaad | sahal | bank_transfer | other
discount_status: pending | approved | rejected
```

**Indexes:**
```
clients(registration_no) UNIQUE
clients(phone)
clients(lower(full_name))
clients(status, created_at DESC)
clients(service_id)
clients USING gin (full_name gin_trgm_ops)     -- fuzzy duplicate warning
payments(paid_at DESC)
payments(client_id)
receipts(receipt_no) UNIQUE
invoices(invoice_no) UNIQUE
expenses(expense_date DESC, category_id)
activity_logs(user_id, created_at DESC)
activity_logs(entity_type, entity_id)
uploaded_documents(client_id, is_current)
notifications(user_id, is_read)
```

**Exit test:** `list_tables` returns all 20; `get_advisors performance` reports no missing-index warnings on FKs.

---

### PHASE 3 — Database: functions + triggers

Migration `002_functions_triggers.sql`.

1. **`next_number(p_key text)`** — SECURITY DEFINER. Locks the `number_sequences` row with `SELECT ... FOR UPDATE`, increments, returns `PREFIX-YYYY-000001`. Resets when the year changes. This row-lock is what prevents two receptionists saving in the same millisecond from both getting `000042`. A plain Postgres `SEQUENCE` cannot do this because it cannot reset yearly with a configurable prefix.
2. **`set_updated_at()`** — BEFORE UPDATE on every table.
3. **`log_activity()`** — generic trigger writing to `activity_logs` with `old_values`/`new_values` jsonb diffs.
4. **`notify_role()`** — inserts notification rows on status transitions.
5. **`block_payment_update()`** — `RAISE EXCEPTION` on any UPDATE to `payments`.
6. **`block_log_mutation()`** — `RAISE EXCEPTION` on UPDATE/DELETE of `activity_logs`.
7. **`snapshot_client_service()`** — copies `service.name` and `service.price` into the client row on insert.
8. **`bump_print_count()`** — AFTER INSERT on `document_print_logs`.
9. **`handle_failed_login()`** / **`handle_successful_login()`** — lockout counter.
10. **`auth_role()`** — STABLE SECURITY DEFINER, returns the caller's role code without triggering recursive policy evaluation.

**Exit test:** insert a client -> reg number generated, activity log written, ALT notification created. Attempt `UPDATE payments` -> exception raised.

---

### PHASE 4 — Database: Row Level Security

Migration `003_rls_policies.sql`. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on all 20 tables, then explicit policies.

Pattern:
```sql
create policy services_update on services for update
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy payments_select on payments for select
  using (auth_role() in ('admin','finance'));

create policy payments_no_update on payments for update using (false);

create policy logs_select on activity_logs for select
  using (auth_role() = 'admin');
-- no update policy, no delete policy => impossible for anyone
```

Storage policies on `client-documents`: INSERT for `alt|admin`, SELECT for `alt|admin|finance`, no DELETE for anyone.

**Exit test:** log in as Registration in a browser console, call `supabase.from('payments').select()` -> returns empty/denied. Call `.update()` on `services` -> denied. This is the real security test.

---

### PHASE 5 — Seed data + Edge Function

Migration `004_seed.sql`: 4 roles, 13 expense categories, 1 `office_settings` row, 3 `number_sequences` rows (prefix `OLOD`), 10 starter services (House Transfer, Sale Agreement, Land Transfer, Power of Attorney, Affidavit, Property Verification, Property Gift Agreement, Rental Agreement, Mortgage Agreement, Other).

**Edge Function `admin-actions`** — deployed to Supabase, holds the `SERVICE_ROLE_KEY` as a secret.

> **Critical:** `supabase.auth.admin.createUser()` requires the service-role key, which bypasses all RLS. That key can **never** live in a `VITE_` variable because Vite inlines those into the browser bundle where any employee can read them in DevTools. Therefore every privileged operation runs server-side in this function, which first verifies the caller's JWT belongs to an active Admin.

Function handles: `create_employee`, `reset_password`, `disable_account`, `enable_account`, `unlock_account`, `delete_account`, `change_role`.

Then create the **first Admin** manually via the dashboard.

**Exit test:** call the function as Registration -> 403. As Admin -> employee created with `must_change_password = true`.

---

### PHASE 6 — Auth shell

- `AuthContext` — session, profile, role, loading state.
- `Login` page — username -> resolved to email -> `signInWithPassword`.
- `ChangePasswordGuard` — if `must_change_password`, render ONLY the change-password screen. No sidebar, no data fetching, no route escape.
- `ProtectedRoute` + `RoleGuard` — redirect unauthorized users to their own dashboard.
- `DashboardLayout` — sidebar (role-filtered), topbar (logo, date, universal search, notification bell, profile menu, logout).
- Login/logout write to `login_history` and `activity_logs`.

**Exit test:** new employee logs in with temp password -> forced to change it -> lands on the correct role dashboard. Typing another role's URL redirects away.

---

### PHASE 7 — Shared component library

Build once, use everywhere: `Button`, `Input`, `Select`, `SearchableSelect`, `DatePicker`, `Textarea`, `Checkbox`, `Modal`, `ConfirmDialog`, `Badge`, `Tabs`, `Card`, `StatCard`, `EmptyState`, `ErrorState`, `Skeleton` (table/card/form/dashboard variants), `Toast`, `FileUpload` (progress + retry), `Pagination`, and the master **`DataTable`** — server-side pagination, sorting, filtering, column visibility, CSV export, PDF export, print.

**Exit test:** a storybook-style demo route renders every component in both empty, loading, and error states.

---

### PHASE 8 — Admin module

Employees CRUD, Services CRUD, **dynamic field builder** (`service_field_definitions`), Pending Discounts approval screen, Office Settings (identity, logo, signature, stamp, receipt header/footer, disclaimer, currency, timezone, date format, print margins, number prefixes, QR), Activity Logs viewer with filters, Admin dashboard with 12 clickable stat cards and 6 charts.

**Exit test:** Admin adds a new service with 7 custom fields; those fields appear on the Registration form with no code change and no redeploy.

---

### PHASE 9 — Registration module

Dashboard (5 cards), New Client form (fixed section + dynamic section rendered from the DB), read-only auto-filled price, duplicate warning via trigram + phone match, Request Discount modal (**reason only**), My Clients list, client detail.

**Exit test:** price input rejects edits at all three layers. Discount request flips status to `waiting_admin_approval` and notifies Admin.

---

### PHASE 10 — Discount approval loop

Admin approve/reject, amount entry, `final_price` lock, audit record (original price, final price, discount amount, reason, approving admin, date, time), notification back to Registration and Finance.

**Exit test:** after approval, Registration sees the new final price live without refreshing, and cannot modify it.

---

### PHASE 11 — ALT module + Storage

Dashboard (5 cards), work queue, upload `.doc/.docx/.pdf` with progress and retry, **replace = new version** (v1 preserved), version history, preview (PDF inline; Word offers download), print with `print_count++` and `printed_by`, download, Mark Complete, Document Center grouped by client and service.

**Exit test:** upload v1, replace with v2, confirm v1 still downloadable and `is_current` correctly moved. Signed URLs expire.

---

### PHASE 12 — Finance module

Pending Payments (all data auto-pulled), Receive Payment form, auto receipt + invoice numbers, snapshot write, **A4 receipt** (logo, office name, receipt no, date, client name, customer ID, phone, service, description, total, discount, final paid, method, balance, **amount in words**, QR code, authorized signature, address, phone, email, footer), print preview modal, PDF download, unlimited identical reprints, receipt & invoice search/management.

**Exit test:** save a payment -> receipt prints on A4. Change the service price afterwards -> reprint the same receipt -> values unchanged.

---

### PHASE 13 — Expenses + Reports

Expense CRUD with 13 seeded categories plus custom, filterable history. All **13 reports**: Daily Income, Daily Expense, Weekly, Monthly, Yearly, Profit, Service Revenue, Employee Collection, Expense Category, Payment Method, Outstanding Payments, Discount, Transaction History — filterable by date range, employee, service, method, status; printable; PDF/CSV export. All totals computed dynamically, never stored.

**Exit test:** profit report equals income minus expenses for the same range, recomputed live.

---

### PHASE 14 — Cross-cutting features

Realtime subscriptions on `clients` + `notifications` invalidating React Query caches; Notification Center; universal search (clients, receipts, invoices, services, employees, reg numbers); Client Profile with 10 tabs including the visual **Timeline**; Profile page (password, avatar, phone, language, notification prefs).

**Exit test:** two browsers side by side — Registration saves a client, ALT's counter increments with no refresh.

---

### PHASE 15 — Hardening + deploy

Route-level `React.lazy`, server-side pagination everywhere (`.range()` + `count: 'exact'`), explicit column selection instead of `select('*')`, `React.memo` on table rows, 300 ms debounced search, tuned React Query `staleTime`, lazy-loaded charts, connection-status banner with retry, friendly error mapping, confirmation dialogs on every destructive action, duplicate-submit guards, `get_advisors` security + performance pass, then Vercel deploy.

**Exit test:** Lighthouse performance > 90; `get_advisors security` returns zero RLS warnings.

---

## PART 3 — DATABASE TABLE REFERENCE

```
                       +----------+
                       | services |
                       +----+-----+
                            | 1
        +-------------------+-------------------------+
        | N                 | N                       |
+-------v---------+  +------v------------------+      |
| service_field_  |  |        clients          |<-----+
|  definitions    |  |   (ONE per journey)     |
+-----------------+  +--+--+--+--+--+--+--+----+
                        |  |  |  |  |  |  |
      +-----------------+  |  |  |  |  |  +--------------+
      |        +-----------+  |  |  +----+               |
      v        v              v  v       v               v
 client_   discount_   uploaded_  payments  notific-  activity_
 service_  requests    documents     |      ations     logs
 details    (0..N)      (0..N)       | (0..1)
  (0..N)                  |          +--> receipts (1, reprintable)
                          v          +--> invoices (1)
                   document_print_   +--> payment_corrections (0..N)
                        logs
```

| # | Table | Purpose | Soft delete |
|---|---|---|:--:|
| 1 | `roles` | admin / registration / alt / finance | no |
| 2 | `users` | employee profile mirroring `auth.users` | yes |
| 3 | `services` | name, category, **price**, description, active, order | yes |
| 4 | `service_field_definitions` | Admin-defined dynamic fields per service | yes |
| 5 | `clients` | the spine + frozen price snapshots | yes |
| 6 | `client_service_details` | answers to the dynamic fields | yes |
| 7 | `discount_requests` | reason -> approval -> locked final price | no |
| 8 | `uploaded_documents` | file metadata + version + print count | yes |
| 9 | `document_print_logs` | who printed what and when | no |
| 10 | `payments` | **immutable** money in | no |
| 11 | `payment_corrections` | Admin-approved fixes, audit trail | no |
| 12 | `receipts` | **frozen snapshot**, infinite reprints | no |
| 13 | `invoices` | **immutable** after payment | no |
| 14 | `expenses` | manual money out | yes |
| 15 | `expense_categories` | 13 seeded + custom | yes |
| 16 | `activity_logs` | append-only audit trail | no |
| 17 | `login_history` | login / logout / failed attempts | no |
| 18 | `office_settings` | single-row office configuration | no |
| 19 | `notifications` | persist until marked read | no |
| 20 | `number_sequences` | `OLOD-2026-000001` generator state | no |

**Snapshot columns on `clients`:** `service_name_snapshot`, `original_price`, `discount_amount`, `final_price` — this is why changing a price next year cannot corrupt this year's records.

---

## PART 4 — FOLDER STRUCTURE

```
src/
+- assets/            logo, fonts, icons
+- components/
|  +- ui/             Button, Input, Select, Modal, Badge, Tabs, Tooltip
|  +- table/          DataTable, Pagination, ColumnToggle, ExportMenu
|  +- form/           FormField, SearchableSelect, DatePicker, FileUpload,
|  |                  DynamicServiceFields
|  +- feedback/       Skeletons, EmptyState, ErrorState, ConfirmDialog, Toast
|  +- dashboard/      StatCard, ChartCard, ActivityFeed, QuickActions
|  +- print/          ReceiptTemplate, InvoiceTemplate, ReportTemplate
+- layouts/           AuthLayout, DashboardLayout, Sidebar, Topbar, PrintLayout
+- contexts/          AuthContext, NotificationContext, OfficeSettingsContext
+- hooks/             useAuth, useRole, usePagination, useRealtime, useClients,
|                     usePayments, useDebounce, useConfirm
+- pages/
|  +- auth/           Login, ChangePassword
|  +- admin/          Dashboard, Employees, Services, ServiceFields,
|  |                  PendingDiscounts, OfficeSettings, ActivityLogs
|  +- registration/   Dashboard, NewClient, MyClients, ClientDetail
|  +- alt/            Dashboard, WorkQueue, DocumentCenter, ClientDocuments
|  +- finance/        Dashboard, PendingPayments, ReceivePayment, Receipts,
|  |                  Invoices, Expenses, Reports/*
|  +- shared/         ClientProfile, Search, Notifications, Profile, NotFound
+- services/          authService, clientService, paymentService,
|                     documentService, expenseService, reportService
+- lib/               supabaseClient.js, queryClient.js
+- utils/             formatCurrency, numberToWords, dateHelpers, validators,
|                     printHelpers, exportCsv, exportPdf
+- constants/         roles, statuses, paymentMethods, expenseCategories
+- routes/            AppRoutes, ProtectedRoute, RoleGuard

supabase/
+- migrations/        001_core_schema.sql ... 004_seed.sql
+- functions/
   +- admin-actions/  index.ts   (service-role key stays here, never in browser)
```

---

## PART 5 — ENVIRONMENT & DEPLOYMENT

**Frontend env — exactly two variables, both safe to expose:**
```
VITE_SUPABASE_URL=https://<new-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

**Never in the frontend:** `SERVICE_ROLE_KEY`. It lives only as a Supabase Edge Function secret.

**Vercel:** framework preset Vite, build `npm run build`, output `dist`, plus `vercel.json`:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```
(without this, refreshing on `/finance/reports` returns 404)

---

## PART 6 — DEFINITION OF DONE

- [ ] Public sign-up returns an error
- [ ] New employee is forced to change password before any dashboard loads
- [ ] Registration cannot read `payments` even via direct API call
- [ ] Registration cannot write a discount amount at DB level
- [ ] ALT cannot approve a discount at DB level
- [ ] Finance cannot change a service price at DB level
- [ ] `UPDATE payments` raises an exception for every role including Admin
- [ ] A receipt reprinted after a price change is byte-identical to the original
- [ ] Admin adds a service field -> it appears on the Registration form, no redeploy
- [ ] Registration saves a client -> ALT counter increments with no refresh
- [ ] Every status change produced an `activity_logs` row
- [ ] Reg / receipt / invoice numbers are gapless and unique under concurrent saves
- [ ] No list query loads more than 20 rows at a time
- [ ] `get_advisors security` returns zero warnings
- [ ] Receipt prints correctly on A4 and downloads as PDF
- [ ] Live on Vercel with only the anon key in the bundle

---

## PART 7 — OPEN QUESTIONS FOR THE OFFICE

1. Currency and formatting — USD, SOS, or both?
2. Exact receipt layout — a photo or sample of the current paper receipt.
3. Real service list with real prices.
4. The actual required fields per service (can be added later through the UI).
5. Login identifier — pure username, or username mapped to an internal email?
6. Interface language — English only, or English + Somali toggle?
