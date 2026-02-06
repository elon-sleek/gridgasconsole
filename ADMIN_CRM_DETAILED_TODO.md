# LPG Admin CRM Platform - Detailed Implementation TODO

**Purpose:** Comprehensive admin web portal for managing FMs, customers/tenants, assets, vendors, and operations.  
**Location:** `admin_portal/` folder (separate from mobile app for easy export)  
**Tech Stack:** Next.js 15 (App Router) + TypeScript + Tailwind + React Query + Zustand + Supabase JS client  
**Backend:** Reuses existing Supabase DB + Edge Functions + ThingsBoard references (do not delete legacy checklist items; Supabase remains the source of truth)

---

## Phase 0: Project Foundation & Separation

### 0.1 Repository Structure
- [x] Create `admin_portal/` folder as standalone Next.js project
- [x] Create `supabase/admin_portal/` for admin-specific SQL (views, migrations)
- [x] Add `.gitignore` for `admin_portal/` (node_modules, .next, .env.local)
- [x] Document export/deployment strategy (can be moved to separate repo)

### 0.2 Core Setup
- [x] Initialize Next.js 15 project with App Router + TypeScript
- [x] Configure Tailwind CSS + PostCSS
- [x] Install dependencies: `@supabase/supabase-js`, `@tanstack/react-query`, `zustand`, `date-fns`, `classnames`, `leaflet`
- [x] Create `package.json` with scripts (dev, build, start, lint, typecheck)
- [x] Configure `tsconfig.json` with strict mode + path aliases
- [x] Configure `next.config.mjs` with typed routes enabled

### 0.3 Environment & Secrets
- [x] Create `.env.example` with all required variables (Supabase URL/keys, TB URL, map API, admin PIN)
- [x] Add `.env.local` to `.gitignore`
- [x] Document: `NEXT_PUBLIC_*` = client-side, no prefix = server-only
- [x] Add `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose to browser)
- [x] Configure Tailwind theme with design tokens
- [x] Create reusable card/button/input components (optional)
### 0.5 Auth & Session Infrastructure
- [x] Create `lib/supabaseClient.ts` (client-side Supabase client factory)
- [x] Create `lib/supabaseAdmin.ts` (server-side admin client with service-role key)
- [x] Create `lib/api.ts` (authedFetch helper for API routes)
- [x] Create `lib/roles.ts` (role checks: super_admin, admin, support, fm_viewer)

- [x] Create `supabase/admin_portal/admin_views.sql` with:
  - [x] `vw_admin_kpis` (tenant counts, asset counts, buildings, vendors, deliveries, support tickets)
  - [x] `vw_meter_comm_history` (purchase→vend→command→telemetry join for Vend UI)
- [x] Add migrations for admin-specific tables:
  - [x] `admin_portal_01_assets_and_assignments.sql` (assets + asset_assignments)
  - [x] `admin_portal_02_gas_vendors_and_deliveries.sql` (gas_vendors + vendor_deliveries)
---

## Phase 1: Authentication & RBAC

### 1.1 Login Screen
- [x] Create `app/login/page.tsx` (email/password form)
- [x] Supabase Auth integration (signInWithPassword)

### 1.2 Role System
- [x] Implement `getUserRole(user)` from JWT claims or user metadata
- [x] Implement `hasPermission(role, permission)` for granular checks

- [x] Create `components/RouteGuard.tsx` (checks auth + optional permission)
- [x] Create `components/ProtectedRoute.tsx` (wraps RouteGuard + Shell)
- [x] Redirect unauthenticated users to `/login`
- [x] Create `/unauthorized` page for permission denied
### 1.4 Profile & Account
---
## Phase 2: App Shell & Navigation

- [x] Create `components/Shell.tsx` (Sidebar + Topbar + main content area)
- [x] Create `components/Topbar.tsx` (avatar, login time, duration, 3-dot menu)
- [x] Implement logout in Topbar menu

### 2.2 Navigation Menu Items
- [x] Dashboard (/)
- [x] Assets (/assets)
- [x] Customers/Tenants (/customers)
- [x] Buildings (/buildings)
- [x] Gas Vendors (/gas-vendors)
- [x] Map (/map)
- [x] Price Settings (/price-settings) - passworded
- [x] Vend (/vend) - passworded
- [x] Support Center (/support) - passworded
- [x] General Settings (/settings)

### 2.3 Password-Gated Sections
- [x] Create `components/PinPrompt.tsx` (dialog for admin PIN)
- [x] Integrate PIN check for Price Settings, Vend, Support Center
- [x] Store PIN gate state in session/local storage (optional)

### 2.4 Top-Right Bar
- [x] Display avatar (first letter of email)
- [x] Display login time + duration (live update every minute)
- [x] 3-dot menu with Account + Logout

---

## Phase 3: Dashboard (Admin Home)

### 3.1 KPI Tiles
- [x] Create `components/DashboardKPIs.tsx` (queries `vw_admin_kpis`)
- [x] Display KPI tiles:
  - [x] Total tenants
  - [x] Total active tenants
  - [x] Total assets (with breakdown by type)
  - [x] Total assigned assets (toggle: to FMs / to tenants)
  - [x] Total connected buildings
  - [x] Open support tickets
  - [x] Total gas vendors
  - [x] Gas deliveries completed
  - [x] Gas deliveries ongoing

### 3.2 Charts
- [x] Create `components/DashboardCharts.tsx`
- [x] Chart 1: Real-time usage trend (cumulative gas usage from `meter_telemetry`)
  - [x] Wire to actual RPC/view (currently placeholder)
- [x] Chart 2: Daily gas top-ups (bar chart from `gas_purchases`)
  - [x] Wire to actual RPC/view (currently placeholder)
- [x] Chart 3: Growth over time (FMs, tenants, buildings)
  - [x] Wire to actual RPC/view (currently placeholder)

### 3.3 Backend Wiring
- [x] KPI tiles query `vw_admin_kpis` (Supabase client-side read)
- [x] Create Supabase RPCs for chart data:
  - [x] `admin_usage_trend(start_date, end_date)` → returns telemetry aggregates
  - [x] `admin_daily_topups(start_date, end_date)` → returns daily purchase sums
  - [x] `admin_growth_over_time(entity_type, start_date, end_date)` → returns growth series

---

## Phase 4: Assets Management

> Note (2026 clarification): Tanks are registered as `assets.type='tank'`.
> Their operational state (active/exhausted/refilled/offline) must be wired from the FM changeover/tank logic,
> and visible in the Admin portal with durations + filters.

### 4.1 Assets List Page
- [x] Create `app/assets/page.tsx`
- [x] Query `assets` table (client-side read via Supabase)
- [x] Display table: Type, Serial, Manufacturer, Created, Actions
- [x] Add checkbox for multi-select
- [x] Add "Assign" button (opens dialog when assets selected)

### 4.2 Asset Registration Form
- [x] Form to register new asset:
  - [x] Type dropdown: Meter / Tank / Changeover / Padlock
  - [x] Meter number (if meter) → links to `meters.meter_number`
  - [x] Serial/ID (if tank/changeover)
  - [ ] Serial/ID (if padlock)
  - [x] Capacity (kg)
  - [x] Manufacturer
  - [x] Firmware version
  - [x] Install address
  - [x] Vendor device ID (optional)
  - [x] Vendor API reference (optional)
  - [ ] TTLock fields (if padlock):
    - [ ] Lock ID (TTLock device identifier)
    - [ ] Lock MAC address (Bluetooth MAC)
    - [ ] Building/location binding (which building/cage/door this lock controls)
    - [ ] Lock admin credentials (stored securely; used for OTP generation)
- [x] Submit via server route: `POST /api/admin/assets` (service-role write)
- [x] On success, refresh assets list
- [ ] Padlock assignment: assign padlock to building (one-to-one or one-to-many)

### 4.3 Multi-Select Assignment
- [x] Select multiple assets
- [x] Click "Assign" → open dialog
- [x] Dialog: dropdown to select FM (from `fm_profiles`)
- [x] Submit via server route: `POST /api/admin/assets/assign` (service-role write)
- [x] Backend closes existing `asset_assignments` for selected assets, creates new assignments
- [x] On success, refresh list

### 4.4 Asset Detail Page
- [x] Create `app/assets/[id]/page.tsx`
- [x] Display full metadata: all fields from `assets` table
- [x] Display assignment history (query `asset_assignments` filtered by `asset_id`)
  - [x] Show chain: Admin → FM → Tenant (if applicable)
  - [x] Show timestamps, who assigned, status
- [x] Add "Assign" button (opens dialog)
- [x] Add "Retrieve" button (marks assignment as retrieved)
  - [x] Submit via server route: `POST /api/admin/assets/[id]/retrieve`
  - [x] Update `asset_assignments.status = 'retrieved'`, set `retrieved_at`

### 4.5 Backend Linkage
- [x] Migrations applied: `assets`, `asset_assignments`
- [x] RLS: authenticated can read, no client writes
- [x] Server routes (Next.js Route Handlers):
  - [x] `POST /api/admin/assets` (create asset)
  - [x] `POST /api/admin/assets/assign` (assign to FM)
  - [x] `POST /api/admin/assets/[id]/retrieve` (retrieve asset)
- [ ] Optional: add audit log for all asset actions

### 4.6 Tank Operational States (From FM App Radio Codes)
> Wire tank statuses from FM app logic: active/exhausted/refilled/offline/disengaged

- [ ] 5 tank states with detailed semantics:
  - [ ] **Active** (green): Tank in use, connected, not empty
  - [ ] **Exhausted** (red): Empty, auto-changeover switched, awaiting refill (urgent)
  - [ ] **Refilled** (orange): Tank refilled at vendor, waiting for FM return/re-installation
  - [ ] **Offline** (grey): Tank disengaged/removed for refill (FM picked up, in transit)
  - [ ] **Disengaged** (grey): Tank physically removed but not yet marked picked up
- [ ] Tank metadata:
  - [ ] `tank_status` (enum)
  - [ ] `tank_status_since` (timestamp) → compute duration ("exhausted for 6h 23m")
  - [ ] `last_seen_at` (connectivity indicator)
  - [ ] `last_refill_at`, `last_empty_at`
- [ ] Assets list UI:
  - [ ] Tank status badge with color matching FM radio codes
  - [ ] Duration display next to badge (e.g., "exhausted for 2d 5h 12m")
  - [ ] Connected/disconnected indicator
  - [ ] Last refill date
- [ ] Comprehensive filters (4 levels):
  - [ ] **Assignment status**: All / Unassigned / Assigned-to-FM / Assigned-to-Tenant
  - [ ] **Asset type**: All / Meter / Tank / Changeover / Padlock
  - [ ] **Connectivity**: All / Connected / Disconnected
  - [ ] **Tank state**: All / Active / Exhausted / Refilled / Offline / Disengaged
- [ ] Dashboard tiles (Tanks by State section):
  - [ ] **Tanks Active** (green) - clickable filter
  - [ ] **Tanks Exhausted** (red) - urgent, clickable filter
  - [ ] **Tanks Refilled** (orange) - awaiting return, clickable filter
  - [ ] **Tanks Offline/Disengaged** (grey) - clickable filter
  - [ ] Clicking tile navigates to Assets page with filter pre-applied
---

## Phase 5: Facility Managers Management

### 5.1 FM List Page
- [x] Create `app/facility-managers/page.tsx`
- [x] Query `fm_profiles` (client-side read)
- [x] Display table: Name, Status, Phone, Created, Actions
- [x] Actions: Block / Unblock buttons
  - [x] Submit via server route: `POST /api/admin/facility-managers/[id]/status`
  - [x] Update `fm_profiles.status` (active / blocked)

### 5.2 FM Detail Page (Mirror of FM App)
- [x] Create `app/facility-managers/[id]/page.tsx`
- [x] Display FM profile (all fields from `fm_profiles`)
- [x] Display FM's buildings:
  - [x] Query `buildings` filtered by `fm_id`
  - [x] Show list with address, lat/long, customer count, photo
  - [x] Click building → navigate to building detail
- [x] Display FM's tenants:
  - [x] Query `tenant_profiles` where `claimed_by_fm_id = fm_id`
  - [x] Show list with name, claim status, meter number
  - [x] Click tenant → navigate to tenant detail
- [x] Display FM's assets:
  - [x] Query `asset_assignments` where `assigned_to_fm_id = fm_id` and `status = 'assigned'`
  - [x] Show list of assets with type, serial, assigned date
- [x] Display FM's delivery history:
  - [x] Query `vendor_deliveries` where `fm_id = fm_id`
  - [x] Show list with vendor, quantity, date, status
- [x] Display FM's support tickets:
  - [x] Query `support_tickets` where handling FM is this FM
  - [x] Show list with ticket ID, customer, status, created date
  - [x] Highlight overdue tickets (>= 7 days open/in_progress)

### 5.3 Admin Override Actions
- [x] Add "Lock All Meters" button (locks all meters under this FM)
  - [x] Iterate meters, call lifecycle RPC to lock each
  - [x] Submit via server route: `POST /api/admin/facility-managers/[id]/lock-meters`
- [x] Add "Unlock All Meters" button
- [x] Add "Block FM" button (changes FM status to blocked)
- [x] Add "Unblock FM" button

### 5.4 Backend Linkage
- [x] Query `fm_profiles` (client read)
- [x] Server route for status update
- [x] Server routes for meter lock/unlock:
  - [x] `POST /api/admin/facility-managers/[id]/lock-meters`
  - [x] `POST /api/admin/facility-managers/[id]/unlock-meters`
  - [x] Backend calls existing lifecycle RPC or updates `meters.status`
- [ ] Optional: add audit log for FM admin actions

---

## Phase 6: Customers/Tenants Management

### 6.1 Tenants List Page
- [x] Create `app/customers/page.tsx`
- [x] Query `tenant_profiles` (client-side read)
- [x] Display table:
  - [x] Tenant name/email
  - [x] Customer ID
  - [x] Account status
  - [x] Claim status (unclaimed / claimed)
  - [x] Claimed by FM (lookup from `fm_profiles`)
  - [x] Meter number
  - [x] Created date
- [x] Click tenant → navigate to detail

### 6.2 Tenant Detail Page
- [x] Create `app/customers/[id]/page.tsx`
- [x] Display tenant profile (all fields from `tenant_profiles`)
- [x] Display wallet balance:
  - [x] Query `wallet_balances` view (by `tenant_profiles.user_id`)
  - [x] Show balance, last transaction date
- [x] Display wallet ledger (last 20 transactions):
  - [x] Query `wallet_transactions` filtered by `user_id`
  - [x] Show table: Type (credit/debit), Amount, Reference, Date
- [x] Display purchase history (last 20):
  - [x] Query `gas_purchases` filtered by `tenant_id`
  - [x] Show table: kg, Amount (NGN), Status, Date
- [x] Display vend history (last 20):
  - [x] Query `meter_vends` filtered by `tenant_id` (via join with `gas_purchases`)
  - [x] Show table: Vend token, Status, Sent at, Acknowledged at
- [ ] Display basic usage chart (optional):
  - [ ] Query `meter_telemetry` for tenant's meter
  - [ ] Show simple line chart of remaining_kg over time

### 6.3 Admin Override Actions
- [x] Add "Lock Meter" button
  - [x] Submit via server route: `POST /api/admin/customers/[id]/lock-meter`
  - [x] Backend calls lifecycle RPC to lock meter
- [x] Add "Unlock Meter" button
- [x] Add "Reassign to FM" button (opens dialog)
  - [x] Dialog: dropdown to select new FM
  - [x] Submit via server route: `POST /api/admin/customers/[id]/reassign-fm`
  - [x] Backend updates `tenant_profiles.claimed_by_fm_id`

### 6.4 Backend Linkage
- [x] Query `tenant_profiles`, `wallet_balances`, `wallet_transactions`, `gas_purchases` (client read)
- [x] Query `meter_vends` (client read)
- [x] Server routes for admin actions:
  - [x] `POST /api/admin/customers/[id]/lock-meter`
  - [x] `POST /api/admin/customers/[id]/unlock-meter`
  - [x] `POST /api/admin/customers/[id]/reassign-fm`
  - [x] Backend calls existing lifecycle RPCs or updates meter status
- [ ] Optional: add audit log for tenant admin actions

---

# FM TODO Phase 7: Complete 12-Step Delivery Workflow

**Replace Phase 7 in FM_MVP_TODO.md (lines 56-172) with this content:**

---

## 🧾 PHASE 7: Delivery Workflow (FM Pickup + Vendor Refill + 12-Step Process) (Week 7+)

> **Critical Reality**: FMs double as delivery personnel. Gas vendors are static plants (do not move).
> This phase implements the complete 12-step delivery workflow with wallet locking, TTLock padlock BLE unlock, live GPS tracking, photo proofs, and vendor payment settlement.

### 7.0 Overview: 12-Step Delivery Workflow

**FM Workflow:**
1. Auto-changeover switch triggers red tank indicator → tank becomes `exhausted`
2. FM sees tank appear in "Delivery Page" (exhausted tanks queue)
3. FM batches multiple exhausted tanks (selects all; total kg accumulates)
4. FM clicks "Start Delivery" → turns on location + Bluetooth → becomes live on admin map
5. FM en route to buildings for pickup (flag moves on admin map)
6. At each building: unlock TTLock padlock via BLE → upload meter reading photo → unlock padlock → upload disengaged tank photo → mark "Collected"
7. After all pickups: FM selects gas vendor from 10 closest (by coordinates)
8. FM wallet check: highest vendor price × total kg + buffer; if insufficient, FM tops up wallet; if sufficient, amount is locked
9. Vendor receives notification: kg ordered, FM identity, tank list, Accept/Reject
10. Vendor accepts → FM sees "650KG OF GAS RESERVED at (vendor name)" → FM en route to vendor
11. Vendor refills each tank and ticks them; clicks "Batch Filled" → triggers FM confirmation button
12. FM confirms → locked funds transfer to vendor wallet (book balance); FM returns tanks to buildings (re-engage + upload photo + relock padlock) → delivery complete

### 7.1 Roles, Auth, and Onboarding (Shared App)
- [ ] 7.1.1 - Add role taxonomy: `tenant`, `fm`, `vendor`, `admin` (redirect after login)
- [ ] 7.1.2 - Vendor signup fields (integrated in app, same login system):
  - [ ] 7.1.2a - Gas company name (business name)
  - [ ] 7.1.2b - Business address
  - [ ] 7.1.2c - Phone number (primary contact)
  - [ ] 7.1.2d - Email (login credential)
  - [ ] 7.1.2e - Tank size in tonnes (capacity)
  - [ ] 7.1.2f - Representative details: name + phone number (primary contact)
  - [ ] 7.1.2g - Password (general phone/password login)
  - [ ] On signup: create `vendor_profiles` linked to `gas_vendors`, status `pending_verification`, coordinates null
- [ ] 7.1.3 - Vendor approval workflow (admin action):
  - [ ] Admin manually enters plant coordinates (lat/lng) via map picker
  - [ ] Admin approves → status `approved`, coordinates saved, `verified_at` set
  - [ ] Only `approved` vendors visible to FMs for refill vendor selection

### 7.2 Delivery Page (FM App - Exhausted Tanks Queue)
- [x] 7.2.1 - Create "Delivery" page (replaces or extends Refill Queue)
  - [x] Auto-populate with tanks where `tank_status = 'exhausted'` (red indicator)
  - [x] Display: building address, tank code, kg capacity, duration exhausted, last refill
  - [x] Multi-select checkboxes for batching
  - [x] Show cumulative kg selected (e.g., "5 tanks, 650kg total")
- [x] 7.2.2 - "Start Delivery" button (only enabled when ≥1 tank selected)
  - [x] Prompt FM to enable location + Bluetooth
  - [x] Check FM wallet balance: highest_vendor_price × total_kg + buffer
  - [x] If insufficient: show top-up prompt with exact shortfall
  - [x] If sufficient: lock amount in wallet → delivery batch created (status `batching`)
  - [x] FM becomes "live" on admin map (flag appears at FM current location)

### 7.3 Delivery Lifecycle (Server-Verified State Machine)
- [x] 7.3.1 - Define canonical delivery statuses:
  - [x] `batching` - FM selected tanks, wallet locked, moving to buildings
  - [x] `en_route_pickup` - FM moving to first/next building
  - [x] `pickup_arrived` - FM at building (GPS radius check)
  - [x] `padlock_unlocking` - FM connecting to TTLock BLE
  - [x] `padlock_unlocked` - OTP sent, unlock successful
  - [x] `meter_reading_uploaded` - FM uploaded meter reading photo
  - [x] `tank_disengaged_photo_uploaded` - FM uploaded disengaged tank photo
  - [x] `tank_collected` - Tank marked collected, repeat for next tank
  - [x] `all_tanks_collected` - All tanks in batch collected
  - [x] `vendor_selection` - FM choosing vendor from 10 closest
  - [x] `vendor_reservation_sent` - Vendor notified, awaiting acceptance
  - [x] `vendor_accepted` - Vendor accepted, kg reserved
  - [x] `en_route_vendor` - FM moving to vendor plant
  - [x] `at_vendor` - FM arrived at vendor (GPS radius check)
  - [x] `vendor_refilling` - Vendor ticking tanks as refilled
  - [x] `vendor_batch_filled` - Vendor clicked "Batch Filled" (immutable)
  - [x] `fm_confirmation_pending` - FM sees confirmation button
  - [x] `fm_confirmed_payment` - FM confirmed, payment transferred to vendor
  - [x] `en_route_return` - FM returning to buildings
  - [x] `return_arrived` - FM at building for tank re-installation
  - [x] `tank_reengaged_photo_uploaded` - FM uploaded re-engaged tank photo
  - [x] `padlock_relocked` - Padlock re-secured
  - [x] `delivery_complete` - All tanks returned, delivery closed
  - [x] `disputed` / `cancelled` - Dispute or cancellation flow

### 7.4 Pickup Flow (FM App - Per Tank)
- [ ] 7.4.1 - At each building (per-tank iteration):
  - [ ] 7.4.1a - Display building address, tank code, padlock assigned
  - [ ] 7.4.1b - "Unlock Padlock" button (enabled only when at building GPS radius)
- [ ] 7.4.2 - TTLock BLE unlock flow:
  - [ ] 7.4.2a - FM taps "Unlock Padlock" → app scans for BLE devices
  - [ ] 7.4.2b - Display padlock as Bluetooth device (TTLock SDK)
  - [ ] 7.4.2c - FM connects to padlock (Bluetooth pairing)
  - [ ] 7.4.2d - On successful connection: prompt FM to upload meter reading photo
  - [ ] 7.4.2e - FM opens camera, snaps meter reading, uploads (no document picker, straight camera)
  - [ ] 7.4.2f - Server validates upload → sends OTP to FM email (title: "PADLOCK KEYS")
  - [ ] 7.4.2g - FM enters OTP in app → server issues unlock grant (short TTL)
  - [ ] 7.4.2h - App unlocks padlock via TTLock SDK (BLE command)
  - [ ] 7.4.2i - Show in-app instructions: "Carefully disengage the tank"
  - [ ] 7.4.2j - FM uploads disengaged tank photo (camera → upload)
  - [ ] 7.4.2k - Server marks tank `collected` → triggers "Collected" status on admin FT
  - [ ] 7.4.2l - In-app warning: "Please relock the gas tank chamber"
- [ ] 7.4.3 - Repeat for all tanks in batch
- [ ] 7.4.4 - After all tanks collected: "Next" button comes alive

### 7.5 Vendor Selection (FM App)
- [x] 7.5.1 - "Choose Gas Vendor" screen (after all tanks collected)
  - [x] Query approved vendors (`vendor_profiles.status = 'approved'`)
  - [x] Calculate distance from FM current location to each vendor's plant coordinates
  - [x] Shortlist 10 closest vendors
  - [x] Display: vendor name, distance, price/kg, capacity (tonnes), contact numbers
- [x] 7.5.2 - FM selects vendor → display vendor details + location (map view)
  - [x] Show contact numbers (FM can call to confirm availability)
- [x] 7.5.3 - FM confirms vendor selection:
  - [x] Server creates reservation request
  - [x] Vendor notified: kg ordered, FM identity, tank list, warning not to fill unlisted tanks
  - [x] Vendor prompted: "Do you have sufficient gas for 650kg?" → Yes/No
  - [x] Vendor must click "Accept Refill Order" button

### 7.6 Vendor App: Refill Acceptance + Confirmation
- [x] 7.6.1 - Vendor receives notification (in-app + optional push):
  - [x] Display: FM name, tanks list (codes + kg each), total kg, current price/kg, total amount
  - [x] "Sufficient gas?" checkbox (Yes/No)
  - [x] "Accept Refill Order" button
- [x] 7.6.2 - Vendor accepts:
  - [x] Server marks order `vendor_accepted`
  - [x] FM sees "650KG OF GAS RESERVED at (vendor name)"
  - [x] Timeline shows FM "en route to vendor"
- [x] 7.6.3 - FM arrives at vendor (GPS radius check)
- [x] 7.6.4 - Vendor refill screen:
  - [x] List all tanks in order (codes + kg)
  - [x] Vendor ticks each tank as refilled (checkboxes)
  - [x] "Batch Filled" button (only enabled after all tanks ticked)
  - [x] Once clicked, selections become immutable (cannot untick)
  - [x] Server marks order `vendor_batch_filled` → registers in vendor history + admin Gas Vendor menu

### 7.7 Payment Settlement (FM Confirmation)
- [x] 7.7.1 - Vendor clicks "Batch Filled" → triggers FM confirmation button:
  - [x] FM sees: "(Vendor name) claims to have duly transferred 650kg of LPG to you"
  - [x] "Confirm" button visible
- [x] 7.7.2 - FM clicks "Confirm":
  - [x] Locked wallet funds transfer to vendor wallet
  - [x] Vendor sees deposit notification: amount visible to vendor (based on vendor's rate)
  - [x] Vendor wallet history shows **book balance** (awaiting admin review)
  - [x] Payment ledger: FM wallet debited (ledger balance), vendor wallet credited (book balance)
  - [x] Server marks order `fm_confirmed_payment`

### 7.8 Return Flow (FM App - Per Tank Re-Installation)
- [x] 7.8.1 - After payment confirmed: delivery stage "en route buildings" for FM and admin FT
- [x] 7.8.2 - At each building (per-tank iteration):
  - [x] Display building address, tank code
  - [x] Instructions: "Carefully re-engage the tank"
  - [x] FM uploads re-engaged tank photo (camera → upload)
  - [x] "Relock Padlock" button (enabled after photo upload)
  - [x] FM relocks padlock (TTLock BLE or manual; log event)
  - [x] Server marks tank `returned`
- [x] 7.8.3 - After all tanks returned:
  - [x] FM clicks "Delivered" → server marks order `delivery_complete`
  - [x] Reflects on admin FT as completed

### 7.9 Delivery History (FM App)
- [x] 7.9.1 - Create "Deliveries" menu item (FM app)
  - [x] List all completed deliveries (newest first)
  - [x] Display: date, tanks (codes + kg), vendor, amount paid, status
  - [x] Click delivery → show full timeline replay:
    - [x] Batch created
    - [x] Pickup details (per tank): GPS, timestamps, photos
    - [x] Vendor selection + acceptance
    - [x] Refill confirmation
    - [x] Payment transfer
    - [x] Return details (per tank): photos, timestamps
    - [x] Delivery complete

### 7.10 Wallet Locking Logic (Server-Side)
- [x] 7.10.1 - On "Start Delivery":
  - [x] Query all approved vendors, get highest price/kg
  - [x] Calculate required balance: `highest_price × total_kg × 1.05` (5% buffer)
  - [x] If FM wallet balance < required: reject + show shortfall
  - [x] If sufficient: create wallet lock entry:
    - [x] `wallet_locked_funds` table: (fm_id, amount, delivery_id, locked_at)
    - [x] Deduct from available balance (but not from ledger balance)
- [x] 7.10.2 - On vendor acceptance:
  - [x] Snapshot vendor's current price/kg into delivery record (immutable)
  - [x] Calculate exact amount: `vendor_price × total_kg`
- [x] 7.10.3 - On FM confirmation (payment transfer):
  - [x] Wallet transaction: FM wallet debited (ledger balance)
  - [x] Wallet transaction: Vendor wallet credited (book balance, awaiting review)
  - [x] Release wallet lock (mark used)
- [x] 7.10.4 - On cancellation/dispute:
  - [x] Release wallet lock (mark cancelled)
  - [x] Funds return to FM available balance

### 7.11 Admin Portal Integration (Live Tracking + History)
- [x] 7.11.1 - Deliveries menu (refactored from Buildings Map):
  - [x] Top: Live delivery map (FMs currently on delivery)
    - [x] Flag/marker per FM (moves as FM moves)
    - [x] Clicking flag opens Floating Tile (FT) overlay:
      - [x] FM name, delivery batch details
      - [x] Tanks (codes + kg total)
      - [x] Current stage/progress (pickup → vendor → return)
      - [x] Real-time updates
  - [x] Bottom: Delivery history (all FMs, all completed deliveries)
    - [x] List: FM, date, tanks, kg, vendor, amount, status
    - [x] Click → navigate to delivery detail page
- [ ] 7.11.2 - Delivery detail page (admin):
  - [ ] Full timeline replay (12-step workflow)
  - [ ] All photos uploaded (meter readings, disengaged/re-engaged tanks)
  - [ ] GPS breadcrumbs (optional map replay)
  - [ ] Wallet transactions (lock → transfer → settlement)

### 7.12 Admin Portal: Gas Vendors Menu Enhancements
- [x] 7.12.1 - Vendor approvals in current Vendor page/menu:
  - [x] List vendors (`status = 'pending_verification'`)
  - [x] Display vendor signup details
  - [x] Admin manually enters coordinates of vendor location (map picker)
  - [x] Approve/reject buttons (audit logged)
- [x] 7.12.2 - Vendor list page:
  - [x] Display all approved vendors with price/kg, capacity, verified date
  - [x] Click vendor → vendor detail page
- [x] 7.12.3 - Vendor detail page:
  - [x] KPI tiles: deliveries (7/30 days), kg delivered, settlement amount, disputes
  - [x] Sales history table: date, FM, tanks, kg, amount, status (reserved/settled/disputed)
  - [x] Filters: by status, date range, FM
  - [x] This is a mirror of vendor's own app view
- [x] 7.12.4 - Vendor pricing view:
  - [x] Display current price/kg for each vendor
  - [x] Price history (immutable log)

### 7.13 Admin Portal: Buildings Menu Map Addition
- [ ] 7.13.1 - Keep existing Buildings list page
- [ ] 7.13.2 - Add map section **below** buildings list (replica of old Buildings Map):
  - [ ] Display all buildings as markers
  - [ ] Marker shows: address, FM, tenant count, tank states
  - [ ] Clicking opens building detail summary

### 7.14 TTLock SDK Integration (FM App)
- [ ] 7.14.1 - Research TTLock API/SDK for Flutter:
  - [ ] BLE connection methods
  - [ ] Unlock/lock commands
  - [ ] OTP/password management
- [ ] 7.14.2 - Add TTLock dependencies to `pubspec.yaml`
- [ ] 7.14.3 - Implement TTLock service wrapper:
  - [ ] `lib/services/ttlock_service.dart`
  - [ ] Methods: scanLocks(), connectLock(lockId), unlockLock(lockId, otp), lockLock(lockId)
  - [ ] Error handling + retry logic
- [ ] 7.14.4 - Integrate into pickup/return flows
- [ ] 7.14.5 - Log all lock events (unlock/lock/failures) → server audit log

### 7.15 GPS + Live Tracking (FM App)
- [ ] 7.15.1 - Request location permissions (when "Start Delivery" clicked)
- [ ] 7.15.2 - Enable continuous location tracking (while delivery active)
- [ ] 7.15.3 - Send location updates to server (every 30s or on significant movement)
- [ ] 7.15.4 - Server stores FM location + timestamp → queryable by admin map
- [ ] 7.15.5 - Stop tracking when delivery complete or cancelled

### 7.16 Anti-Fraud & Security
- [ ] 7.16.1 - GPS radius checks (server-side):
  - [ ] Unlock padlock only when FM within 1m of building
  - [ ] Vendor arrival only when FM within 5m of vendor plant
  - [ ] Return padlock relock only when FM within 10m of building
- [ ] 7.16.2 - Photo upload validation:
  - [ ] Photos must be fresh (taken within last 5 minutes)
  - [ ] Optional: EXIF GPS validation (photo location matches FM location)
- [ ] 7.16.3 - OTP expiry:
  - [ ] Padlock unlock OTP valid for 5 minutes only
- [ ] 7.16.4 - Rate limiting:
  - [ ] Max 5 unlock attempts per padlock per hour
  - [ ] Max 3 OTP requests per delivery per hour
- [ ] 7.16.5 - Audit trail:
  - [ ] Every state transition logged (immutable)
  - [ ] Every photo upload logged (URL, timestamp, FM, GPS)
  - [ ] Every wallet transaction logged

### 7.17 Testing (12-Step Delivery Workflow)
- [ ] 7.17.1 - Happy path end-to-end test:
  - [ ] Tank exhausted → batch → pickup (unlock padlock, upload photos) → vendor selection → vendor acceptance → refill → FM confirmation → payment transfer → return (relock padlock, upload photos) → complete
- [ ] 7.17.2 - Wallet insufficient balance test
- [ ] 7.17.3 - Padlock unlock failure test (rate limit, OTP expiry, BLE connection failure)
- [ ] 7.17.4 - Vendor rejection test
- [ ] 7.17.5 - Dispute flow test (FM disputes refill quality → admin review)
- [ ] 7.17.6 - GPS spoof detection test
- [ ] 7.17.7 - Offline mode test (photo caching → upload when online)


---

## Phase 8: Gas Vendors Management

> Note (2026 expansion): Phase 8 UI exists, but the product focus shifts to **Vendor approvals + pricing + delivery operations**.
> The items below that are already checked remain valid; new sub-phases add the anti-fraud workflow requirements.

### 8.1 Vendors List Page
- [x] Create `app/gas-vendors/page.tsx`
- [x] Query `gas_vendors` (client-side read)
- [x] Display table:
  - [x] Vendor name
  - [x] Plant location
  - [x] Capacity (kg)
  - [x] Active status
  - [x] Registered date
- [x] Add "Register Vendor" form:
  - [x] Name, Plant location, Capacity, Active toggle
  - [x] Submit via server route: `POST /api/admin/gas-vendors`

### 8.2 Vendor Detail Page
- [x] Create `app/gas-vendors/[id]/page.tsx`
- [x] Display vendor info (all fields from `gas_vendors`)
- [x] Display sales history to FMs:
  - [x] Query `vendor_deliveries` where `vendor_id = id`
  - [x] Show table: FM name, Quantity (kg), Delivered date, Status, Proof URL
  - [x] Click FM → navigate to FM detail
- [x] Display deliveries ongoing vs completed (filter by status)

### 8.3 Record Delivery Form
- [x] Add "Record Delivery" button on vendor detail
- [x] Form fields:
  - [x] Select FM (dropdown)
  - [x] Quantity (kg)
  - [x] Delivery date/time
  - [x] Status (ongoing / completed)
  - [x] Proof URL (optional file upload or link)
  - [x] Note
- [x] Submit via server route: `POST /api/admin/vendor-deliveries`

### 8.4 Backend Linkage
- [x] Query `gas_vendors` (client read)
- [x] Query `vendor_deliveries` (client read)
- [x] Server route: `POST /api/admin/gas-vendors` (create vendor)
- [x] Server route: `POST /api/admin/vendor-deliveries` (create delivery)
- [ ] Optional: add edit/delete routes

### 8.5 Vendor Approval + Identity (New)
- [ ] Add vendor approval fields + status to vendor identity table (plan: `vendor_profiles` separate from but linked to `gas_vendors`)
  - [ ] On Vendor signup: autocreate/autopopulate `vendor_profiles` linked to `gas_vendors`, status `pending_verification`, coordinates null
  - [ ] `status`: `pending_verification | approved | suspended `
  - [ ] Approvals page listing pending vendors (`status = 'pending_verification'`)
  - [ ] Display vendor signup details (gas company, address, phone, email, capacity, rep)
  - [ ] Admin manually enters plant coordinates (lat/lng) via map picker
  - [ ] Identity docs (RC, IDs) stored in Supabase Storage
- [ ] Build Vendor Approvals page:
  - [ ] List pending vendors with submitted docs
  - [ ] Approve / suspend / reject/ request re-submission
  - [ ] Approve button → status `approved`, coordinates saved, `verified_at` set
  - [ ] Reject button → status `rejected`, reason logged
  - [ ] Audit log every action
- [ ] Enforce policy: only `approved` visible to FMs for refill vendor selection

### 8.6 Vendor Pricing (Self-Managed + Admin View)
- [ ] Vendor sets own price/kg in vendor app (effective immediately or scheduled)
- [ ] Immutable price history log (vendor_pricing_history table)
- [ ] Admin portal mirrors vendor pricing:
  - [ ] Current price/kg per vendor
  - [ ] Price history view (effective dates, changes)
- [ ] FM wallet locking uses **highest vendor price** among all registered vendors to calculate minimum required balance
- [ ] Snapshot vendor pricing into each delivery at assignment time (so pricing can’t be changed retroactively)

### 8.7 Vendor Sales History (Mirror of Vendor App)
- [ ] Vendor detail page (admin):
  - [ ] KPI tiles (7/30 days): deliveries, kg delivered, settlement amount, disputes
  - [ ] Sales history table: date, FM, tanks, kg, amount, status (reserved/settled/disputed)
- [ ] Gas Vendors menu: Sales History tab (all vendors aggregated)
  - [ ] Filters: by vendor, by FM, by date range, by status
  - [ ] CSV export
- [ ] This is a mirror of what vendor sees in their own app
- [ ] Ensure list reads from server-authoritative delivery ledger (not client-authored fields)

---

## Phase 9: Deliveries (Live FM Tracking + 12-Step Workflow)

> Note (2026 clarification): **Deliveries** replaces the old Buildings Map menu.
> Gas vendors are **static plants**; the FM transports tanks to/from the plant.
> This phase implements the complete FM delivery workflow: batch tanks → pickup (TTLock unlock) → vendor refill → return.

### 9.1 Deliveries Menu (Refactor from Buildings Map)
- [ ] Rename current `Buildings Map` menu to `Deliveries`
- [ ] Route: `/deliveries` (replaces `/map`)
- [ ] Top section: **Live Delivery Map**
  - [ ] Display live location of FMs currently on delivery (location + BLE enabled)
  - [ ] FM represented by flag/marker; moves as FM moves
  - [ ] Clicking flag opens **Floating Tile (FT)** over map with:
    - [ ] FM name, current delivery batch details
    - [ ] Tanks selected (codes + kg total)
    - [ ] Current delivery stage/progress (pickup → vendor → return)
    - [ ] Real-time updates as FM progresses
- [ ] Bottom section: **Delivery History** (all FMs, all completed deliveries)
  - [ ] List view: FM, batch summary, date, status, kg delivered, vendor
  - [ ] Replica of the formerly live FT pane content (frozen/historical)
  - [ ] Click item → navigate to delivery detail page

### 9.2 Delivery Detail Page (New)
- [ ] Create `app/deliveries/[id]/page.tsx`
- [ ] Display full delivery timeline (12-step workflow replay) refer to C:\lpg_customer_app_flutter\FM_MVP_TODO.md, PHASE 7 and compare for execution:
  - [ ] Batch created (tanks + kg)
  - [ ] FM en route to buildings
  - [ ] Per-tank pickup: padlock unlock, meter reading photo, disengaged tank photo
  - [ ] Vendor selection + reservation
  - [ ] En route to vendor
  - [ ] At vendor: refill confirmation by vendor (per-tank ticks)
  - [ ] FM confirmation + payment transfer
  - [ ] En route back to buildings
  - [ ] Per-tank return: re-engaged tank photo, padlock re-secured
  - [ ] Delivery complete
- [ ] Display wallet transaction: locked amount → transferred amount → vendor book balance
- [ ] Display all uploaded photos (meter readings, disengaged/re-engaged tanks)
- [ ] Display GPS breadcrumbs (optional map replay)

### 9.3 Delivery Timeline Tiles (Dashboard)
- [ ] Add KPI tiles at top of Deliveries page:
  - [ ] `Exhausted (awaiting batch)` - tanks turned red, not yet batched
  - [ ] `Batched (FM en route pickup)` - FM moving to buildings
  - [ ] `Picking up` - FM at buildings, unlocking padlocks
  - [ ] `En route vendor` - FM transporting tanks to vendor
  - [ ] `At vendor` - vendor refilling tanks
  - [ ] `En route return` - FM returning to buildings
  - [ ] `Returning` - FM re-installing tanks
  - [ ] `Completed today` - deliveries closed today
- [ ] Each tile shows count + clicking filters delivery list

### 9.4 Delivery Filters
- [ ] Filter by delivery status (batched / pickup / at_vendor / return / completed / disputed)
- [ ] Filter by FM (dropdown)
- [ ] Filter by gas vendor plant (dropdown)
- [ ] Filter by date range
- [ ] Filter by risk flags (stuck too long, repeated failures, disputes)

### 9.5 Vendor Plants as Static Markers 
- [ ] Display approved gas vendor plants as static markers on map
  - [ ] Marker shows vendor name, capacity (tonnes), price/kg
  - [ ] Clicking opens vendor detail summary

### 9.6 Backend Linkage (Deliveries)
- [ ] Query `tank_refill_orders` + `tank_refill_events` for delivery timeline
- [ ] Query FM live location (when delivery active + location enabled)
- [ ] Query padlock unlock events + photo uploads
- [ ] Query wallet transactions (locked funds + transfers)
- [ ] Real-time subscription to delivery state updates (for FT live updates)
- [ ] Ensure all state transitions are server-authoritative

### 9.7 Security + Fraud Controls (Deliveries)
- [ ] Compute delivery risk flags (server-side):
  - [ ] Stuck at stage beyond SLA (e.g., pickup took > 4 hours)
  - [ ] Repeated padlock unlock failures
  - [ ] GPS anomalies (impossible travel speed, spoofing)
  - [ ] Repeated disputes for same FM/vendor pair
  - [ ] Unusually frequent refills (same tank)
- [ ] Admin override actions (all audit logged):
  - [ ] Force close delivery
  - [ ] Initiate dispute review
  - [ ] Unlock stuck funds

### 9.8 Buildings Menu: Add Map Below List (New)
- [ ] Keep existing Buildings list page (`app/buildings/page.tsx`)
- [ ] Add map section **below** the buildings list (replica of old Buildings Map)
  - [ ] Display all buildings as markers
  - [ ] Marker shows building address, FM, tenant count, tank states
  - [ ] Clicking opens building detail summary
- [ ] This replicates the original Buildings Map functionality (before refactor to Deliveries)

---

## Phase 10: Price Settings (Passworded)

### 10.1 Price Settings Page
- [x] Create `app/price-settings/page.tsx`
- [x] Wrap with PIN prompt component
- [x] Query `tariff_settings` (global rate)
- [x] Query `building_tariff_overrides` (per-building rates)
- [ ] Query `meters` (for per-meter overrides if applicable)

### 10.2 Global Price Form
- [x] Display current global price per kg
- [x] Form to set new global price
- [x] Submit via Edge Function: `admin-tariffs` (action: `set_global`)
  - [x] Use `x-admin-secret` header (from env)
  - [x] Call Edge Function from server route: `POST /api/admin/price-settings/global`

### 10.3 Building Price Overrides
- [x] List buildings with current rate (global or override)
- [x] Bulk update form: select multiple buildings, set new rate
- [x] Submit via Edge Function: `admin-tariffs` (action: `set_buildings`)
  - [x] Call from server route: `POST /api/admin/price-settings/buildings`

### 10.4 Meter Price Overrides (Optional)
- [ ] List meters with current rate
- [ ] Form to set per-meter override
- [ ] Submit via server route or Edge Function (if RPC exists)

### 10.5 Backend Linkage
- [x] Reuse existing Edge Function: `admin-tariffs`
- [x] Server routes call Edge Function with service-role or admin secret
- [x] Query `tariff_settings`, `building_tariff_overrides` (client read)
- [x] Optional: add audit log for price changes

---

## Phase 11: Vend (Passworded)

### 11.1 Vend Page
- [x] Create `app/vend/page.tsx`
- [x] Wrap with PIN prompt component
- [x] Query `meters` (all registered meters)
- [x] Display table: Meter number, Tenant name, Building, Status
- [x] Add search/filter by meter number, tenant name, building

### 11.2 Manual Vend Dialog
- [x] Add "Vend Gas" button per meter
- [x] Dialog opens with:
  - [x] Meter info (number, tenant, building)
  - [x] Recent communication log (query `meter_vends` for history)
  - [x] Form fields: Amount (NGN) or kg, Admin note
- [x] Submit vend action:
  - [x] Option 2: Create orchestrator endpoint: `POST /api/admin/vend/manual`
    - [x] Backend creates `gas_purchases` record (source: admin_manual)
    - [x] Calls `vendor-vend-token` Edge Function
    - [x] Calls `tb-send-vend` Edge Function
    - [x] Returns result to UI

### 11.3 Vend History Panel
- [x] Display recent vend attempts for selected meter:
  - [x] Query `gas_purchases` → `meter_vends`
  - [x] Show: Purchase ID, kg, Amount, Token, Sent at, ACK at, Status
- [x] Display in dialog when Vend Gas is clicked

### 11.4 Backend Linkage
- [x] Query `meters`, `gas_purchases`, `meter_vends` (client read)
- [x] Server route: `POST /api/admin/vend/manual`
  - [x] Create purchase record (service-role)
  - [x] Call existing Edge Functions: `vendor-vend-token`, `tb-send-vend`
  - [x] Return result
- [x] Rely on existing Edge Functions: `tb-vend-ack`, `vend-reconcile` for lifecycle updates
- [x] Optional: add audit log for manual vends

---

## Phase 12: Support Center (Passworded)

### 12.1 Support Page
- [x] Create `app/support/page.tsx`
- [x] Wrap with PIN prompt component
- [x] Query `support_tickets` (all tickets)
- [x] Two sections: Open Tickets, Closed Tickets

### 12.2 Open Tickets Section
- [x] Display list of open tickets (status: open, in_progress, escalated)
- [x] Table columns: Ticket ID, Customer, FM handling, Status, Priority, Created date
- [x] Highlight overdue tickets (>= 7 days open/in_progress)
- [x] Provide quick "Call" link when FM phone is available
- [x] Click ticket → navigate to ticket detail

### 12.3 Closed Tickets Section
- [x] Display list of closed tickets (status: closed, resolved)
- [ ] Auto-delete after 6 months (backend policy or manual cleanup)
- [x] Table columns: Ticket ID, Customer, FM, Closed date, Resolution

### 12.4 Ticket Detail Page
- [x] Create `app/support/[id]/page.tsx`
- [x] Display ticket info (all fields from `support_tickets`)
- [x] Display conversation history:
  - [x] Query `support_ticket_messages` filtered by `ticket_id`
  - [x] Show chat-style list: Sender, Message, Timestamp
  - [ ] Auto-refresh with Supabase Realtime (optional)
- [x] Admin actions:
  - [x] Add admin reply (insert into `support_ticket_messages`)
  - [x] Escalate ticket (update status to escalated)
  - [x] Close ticket (update status to closed)
  - [x] Reassign to different FM (update ticket `fm_id`)

### 12.5 Backend Linkage
- [x] Query `support_tickets`, `support_ticket_messages` (client read)
- [x] Server routes for admin actions:
  - [x] `POST /api/admin/support/[id]/reply` (add message)
  - [x] `POST /api/admin/support/[id]/escalate`
  - [x] `POST /api/admin/support/[id]/close`
  - [x] `POST /api/admin/support/[id]/reassign`
- [ ] Optional: Supabase Realtime for live chat updates
- [x] Optional: add audit log for support actions

---

## Phase 13: Settings & Admin Management

### 13A: User Settings (All Admins)
**Personal preferences - safe for all staff**

#### 13A.1 My Profile Settings
- [x] Create `app/settings/profile/page.tsx`
- [x] Display: Name, Email, Role (read-only)
- [x] Change password form (Supabase Auth updateUser)
- [x] Notification preferences:
  - [x] Email notifications for assigned tickets (toggle)
  - [x] SMS notifications for escalated tickets (toggle)
  - [x] Desktop notifications (toggle)
- [x] Timezone setting (for timestamps)
- [x] Submit via: `POST /api/admin/settings/profile`

#### 13A.2 My Dashboard Preferences
- [x] Create `app/settings/preferences/page.tsx`
- [x] Default date range for charts (7/30/90 days dropdown)
- [x] Default KPI tile order (drag-and-drop - store in user preferences)
- [x] Default filters:
  - [x] Show only my assigned support tickets (toggle)
  - [ ] Show only specific FMs in list (multi-select, optional)
- [x] Table row density: Compact / Comfortable / Spacious
- [x] Submit via: `POST /api/admin/settings/preferences`

#### 13A.3 My App Appearance
- [x] Create `app/settings/appearance/page.tsx`
- [x] Theme: Light / Dark / System (toggle)
- [x] Sidebar collapsed by default (toggle)
- [x] Language: English (future: add more)
- [x] Store in localStorage + backend for sync across devices

---

### 13B: Admin Management (Super Admin Only)
**Staff account management - CEO/Founder access only**

#### 13B.1 Admin Users List
- [x] Create `app/settings/admins/page.tsx`
- [x] Wrap with `<RouteGuard requiredRole="super_admin" />`
- [x] Query `admin_users` view (joins `auth.users` + `admin_roles` table)
- [ ] Display table:
  - [x] Name (from auth.users metadata)
  - [x] Email (from auth.users.email)
  - [x] Role (super_admin / admin / support)
  - [x] Has Passworded Access (yes/no - vend/price/support PIN)
  - [x] Status (active / suspended)
  - [x] Created date
  - [x] Last login
  - [x] Actions: Edit / Suspend / Delete

#### 13B.2 Create New Admin
- [x] Button: "Add New Admin Staff"
- [ ] Dialog form:
  - [x] Full name (stored in auth.users.raw_user_meta_data)
  - [x] Email (used for login)
  - [x] Initial password (auto-generate or manual)
  - [x] Role dropdown: Admin / Support (super_admin cannot be created)
  - [x] Grant passworded access (toggle - if yes, prompt for PIN)
    - [x] If toggled: show PIN input (same PIN for price/vend/support)
    - [x] Store hashed PIN in `admin_passworded_access` table
  - [ ] Send welcome email (toggle)
- [x] Submit via: `POST /api/admin/settings/admins/create`
  - [x] Backend creates auth.users record (via Supabase Admin API)
  - [x] Inserts into `admin_roles` table (user_id, role)
  - [x] If passworded access granted, inserts into `admin_passworded_access` (user_id, hashed_pin)
  - [ ] Sends welcome email with login credentials

#### 13B.3 Edit Admin
- [x] Click "Edit" on admin user row
- [x] Dialog form:
  - [x] Email (read-only - cannot change after creation)
  - [x] Full name (editable)
  - [x] Change role (dropdown)
  - [ ] Change passworded access:
    - [x] Toggle on/off
    - [x] If toggling on: prompt for new PIN
    - [x] If toggling off: delete from `admin_passworded_access`
  - [x] Suspend account (toggle - updates auth.users.banned_until)
  - [x] Force password reset on next login (toggle)
- [x] Submit via: `POST /api/admin/settings/admins/[userId]/update`

#### 13B.4 Delete Admin
- [x] Click "Delete" on admin user row
- [x] Confirmation dialog: "This will permanently delete [name]'s account. Continue?"
- [x] Submit via: `DELETE /api/admin/settings/admins/[userId]`
  - [x] Backend soft-deletes (sets deleted_at) or hard-deletes auth.users record
  - [x] Deletes from `admin_roles` and `admin_passworded_access`

---

### 13C: Audit & Reports (All Admins - Read Only)

#### 13C.1 Audit Log Viewer
- [x] Create `app/settings/audit/page.tsx`
- [x] Query `admin_audit_log` table
- [ ] Filters:
  - [x] Date range picker
  - [x] Action type dropdown (create, update, delete, lock, unlock, assign, etc.)
  - [ ] Entity type dropdown (asset, fm, tenant, meter, purchase, etc.)
  - [ ] Admin user dropdown (filter by who did the action)
- [ ] Display table:
  - [x] Timestamp
  - [x] Admin Email
  - [x] Action (e.g., "Locked Meter")
  - [x] Entity (e.g., "Meter #M12345")
  - [x] Details (old value → new value, or JSON diff)
  - [x] IP Address (optional)
- [ ] Pagination (100 rows per page)

#### 13C.2 Audit Export
- [x] Button: "Export Audit Logs"
- [ ] Dialog:
  - [ ] Date range picker
  - [ ] Entity type filter (optional)
  - [ ] Admin filter (optional)
- [x] Submit via: `GET /api/admin/audit/export?days=...&action=...`
- [x] Backend generates CSV:
  - [x] Columns: Timestamp, Admin, Action, Entity Type, Entity ID, Old Value, New Value, IP
  - [x] Stream as file download
- [ ] Optional: Email CSV to requesting admin

#### 13C.3 System Activity Dashboard
- [ ] Display recent activity stats:
  - [ ] Total admin users (by role)
  - [ ] Admin logins today
  - [ ] Failed login attempts (last 24h)
  - [ ] Top 5 most active admins (by action count)
  - [ ] Recent critical actions (last 20):
    - [ ] Manual vends
    - [ ] Price changes
    - [ ] FM blocks
    - [ ] Meter locks
- [ ] Refresh button (React Query refetch)

---

### 13D: Branding & App Info (Read-Only)

#### 13D.1 About Page
- [x] Create `app/settings/about/page.tsx`
- [x] Display hardcoded branding:
  - [x] **App Name:** GridGas Board
  - [x] **Tagline:** by The Grid Gas Network
  - [x] **Logo:** Placeholder or uploaded logo (hardcoded path)
  - [ ] **Primary Color:** #your-brand-color (hardcoded in globals.css)
  - [ ] **Version:** v1.0.0 (from package.json)
  - [x] **Backend:** Supabase + ThingsBoard (legacy naming; Supabase is source of truth)
  - [ ] **Copyright:** © 2025 The Grid Gas Network
- [x] No edit form (branding is hardcoded in codebase)
- [ ] Optional: "Request Branding Change" button (opens support ticket for dev team)

---

## Phase 14: Backend Integration Deep-Dive ✅

### 14.1 Supabase Tables (Existing)
- [x] Verify `tenant_profiles`, `fm_profiles`, `buildings`, `meters`
- [x] Verify `gas_purchases`, `meter_vends`, `meter_commands`, `meter_telemetry`
- [x] Verify `wallet_transactions`, `wallet_balances` view
- [x] Verify `tariff_settings`, `building_tariff_overrides`
- [x] Verify `support_tickets`, `support_messages` (already exist)

### 14.2 Supabase Views (Admin Portal)
- [x] `vw_admin_kpis` (verified)
- [x] `vw_meter_comm_history` (verified)
- [x] `vw_asset_assignments` (optional - implemented via queries)
- [x] `vw_vendor_sales` (optional - implemented via queries)

### 14.3 Supabase RPCs (Admin Portal)
- [x] Create `admin_usage_trend(start_date, end_date)` for chart data
- [x] Create `admin_daily_topups(start_date, end_date)` for chart data
- [x] Create `admin_growth_over_time(entity_type, start_date, end_date)` for chart data
- [x] Verify existing lifecycle RPCs:
  - [x] `system_purchase_create(...)` (for manual vends)
  - [x] `system_purchase_mark_token_generated(...)`
  - [x] `system_purchase_mark_sent_to_meter(...)`
  - [x] Meter lock/unlock RPC (implemented via status updates)

### 14.4 Edge Functions (Existing)
- [x] `admin-tariffs` (price settings)
- [x] `vendor-vend-token` (generate token)
- [x] `tb-send-vend` (send vend downlink)
- [x] `tb-vend-ack` (ACK from ThingsBoard)
- [x] `vend-reconcile` (retry/timeout/refund)
- [ ] Optional: create `admin-manual-vend` orchestrator (or reuse existing)

### 14.5 RLS Policies (Read/Write Pattern)
- [x] Authenticated can read all admin tables (assets, gas_vendors, etc.)
- [x] Authenticated cannot write (all writes via service-role)
- [ ] Verify RLS on `support_tickets`, `support_messages`
- [ ] Verify RLS on `organization_settings` (if created)

### 14.6 Next.js API Routes (Service-Role)
- [x] `POST /api/admin/assets` (create asset)
- [x] `POST /api/admin/assets/assign` (assign to FM)
- [x] `POST /api/admin/assets/[id]/retrieve` (retrieve asset)
- [x] `POST /api/admin/facility-managers/[id]/status` (block/unblock)
- [x] `POST /api/admin/facility-managers/[id]/lock-meters`
- [x] `POST /api/admin/facility-managers/[id]/unlock-meters`
- [x] `POST /api/admin/customers/[id]/lock-meter`
- [x] `POST /api/admin/customers/[id]/unlock-meter`
- [x] `POST /api/admin/customers/[id]/reassign-fm`
- [x] `POST /api/admin/gas-vendors` (create vendor)
- [x] `POST /api/admin/vendor-deliveries` (create delivery)
- [x] `POST /api/admin/price-settings/global`
- [x] `POST /api/admin/price-settings/buildings`
- [x] `POST /api/admin/vend/manual`
- [x] `POST /api/admin/support/[id]/reply`
- [x] `POST /api/admin/support/[id]/escalate`
- [x] `POST /api/admin/support/[id]/close`
- [x] `POST /api/admin/support/[id]/reassign`
- [x] `POST /api/admin/settings/org`
- [x] `GET /api/admin/audit/export`

---

## Phase 15: Security & Audit ✅

### 15.1 RLS Enforcement
- [x] Enable RLS on all admin tables
- [x] Authenticated can read (so admin portal UI can query)
- [x] Authenticated cannot write (so all writes go through service-role routes)
- [x] Verify RLS on `support_tickets`, `support_messages`

### 15.2 Service-Role Key Protection
- [x] Store `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (server-only)
- [x] Never expose to browser (no `NEXT_PUBLIC_` prefix)
- [x] Use only in API routes and server components

### 15.3 Secondary Auth (PIN/OTP)
- [x] PIN prompt for passworded sections (Price Settings, Vend, Support)
- [x] Store PIN in env: `ADMIN_PIN` (server-only)

### 15.4 Audit Log
- [x] Create `admin_audit_log` table (created in supabase/admin_portal/audit_log.sql)
  - [x] Columns: id, user_id, action, entity_type, entity_id, old_value, new_value, timestamp, ip_address, user_agent
- [x] Log all admin actions:
  - [x] Asset registration, assignment, retrieval
  - [x] FM block/unblock, meter lock/unlock
  - [x] Tenant reassign, meter lock/unlock
  - [x] Price changes (global, building)
  - [x] Manual vends
  - [x] Support ticket actions (escalate, close, reassign)
- [x] Add audit logging to all server routes (using `insertAdminAuditLog` helper)
- [x] Created audit log viewer UI at /settings/audit-logs

### 15.5 Access Control
- [x] Implement role-based feature flags (35 granular permissions in roles.ts):
  - [x] `super_admin`: full access
  - [x] `admin`: operational access
  - [x] `support`: support center access
  - [x] `fm_viewer`: read-only access
- [x] Enforce in route guards and API routes

---

## Phase 16: Testing & Validation ✅

### 16.1 Manual Testing Checklist
- [x] Test login/logout flow
- [x] Test role-based routing (super_admin, admin, support, fm_viewer)
- [x] Test dashboard KPIs load correctly
- [x] Test asset registration → assignment flow
- [x] Test FM list → detail → block/unblock
- [x] Test tenant list → detail → purchases/wallet
- [x] Test building list → detail → customers/FM
- [x] Test gas vendor list → detail → deliveries
- [x] Test map markers → building detail
- [x] Test price settings (global + building overrides)
- [x] Test manual vend flow → check purchase/vend/command records
- [x] Test support ticket list → detail → reply/escalate/close
- [x] Test general settings → org info / branding
- [x] Test audit log viewer with filtering and export

### 16.2 Integration Tests
- [x] Test Supabase RLS policies (client read, no write)
- [x] Test server routes (service-role writes succeed)
- [x] Test Edge Function calls (admin-tariffs, vendor-vend-token, etc.)
- [x] Test audit logging (all actions logged correctly)

### 16.3 UAT (User Acceptance Testing)
- [x] Admin logs in, sees dashboard
- [x] Admin registers meter asset, assigns to FM
- [x] Admin blocks FM, verifies FM cannot login
- [x] Admin manually vends gas, verifies purchase/vend records created
- [x] Admin changes global price, updates tariff settings
- [x] Admin handles support tickets (reply/escalate/close)
- [x] Admin views audit trail for all actions

---

## Phase 17: UI/UX Polish ✅

### 17.1 Dark Mode
- [x] Dark mode CSS variables already in globals.css
- [x] Dark mode classes applied throughout (dark:bg-*, dark:text-*, etc.)
- [x] All pages tested with dark mode classes

### 17.2 Responsive Design
- [x] All pages use responsive grid layouts (grid md:grid-cols-2 lg:grid-cols-3)
- [x] Mobile-friendly sidebar and navigation
- [x] Touch-friendly buttons and interactive elements
- [x] Tested on mobile (375px, 414px), tablet (768px, 1024px), desktop (1280px+)

### 17.3 Loading States
- [x] React Query loading states throughout
- [x] Button disabled states during mutations
- [x] Loading spinners for data fetches

### 17.4 Error Handling ✅ (PHASE 17 COMPLETED)
- [x] Error boundaries added (ErrorBoundary.tsx integrated in root layout)
- [x] Toast notification system created (ToastProvider.tsx)
- [x] Error sanitization implemented (errorHandling.ts)
- [x] All 19 API routes sanitized to prevent information disclosure
- [x] Error pages (unauthorized page exists)
- [x] Safe error messages (no database/internal details exposed to clients)
- [x] Server-side error logging with context tags

### 17.5 Accessibility
- [x] ARIA labels on interactive elements (role="alert" on toasts, aria-label on buttons)
- [x] Keyboard navigation supported (tab, enter, escape)
- [x] Semantic HTML throughout

---

## Phase 18: Deployment & Documentation

### 18.1 Deployment Preparation
- [ ] Build Next.js app (`npm run build`)
- [ ] Test production build locally (`npm run start`)
- [ ] Set up deployment target (Vercel, Netlify, VPS, Docker)
- [ ] Configure environment variables on deployment platform
- [ ] Configure custom domain (optional)

### 18.2 CI/CD Pipeline
- [ ] Set up GitHub Actions (or equivalent) for:
  - [ ] Lint check on PR
  - [ ] Type check on PR
  - [ ] Test run on PR (if tests added)
  - [ ] Auto-deploy on merge to main

### 18.3 Documentation
- [ ] Create `admin_portal/README.md` with:
  - [ ] Project overview
  - [ ] Tech stack
  - [ ] Local setup instructions
  - [ ] Environment variables reference
  - [ ] Deployment instructions
  - [ ] Troubleshooting guide
- [ ] Create `admin_portal/ARCHITECTURE.md` with:
  - [ ] Folder structure explanation
  - [ ] Data flow diagrams
  - [ ] Backend integration overview
  - [ ] Security model
- [ ] Create `admin_portal/API_REFERENCE.md` with:
  - [ ] List of all API routes
  - [ ] Request/response schemas
  - [ ] Authentication requirements

### 18.4 Handoff / Export
- [ ] Package `admin_portal/` folder for export to separate repo
- [ ] Include `supabase/admin_portal/` SQL files
- [ ] Include `.env.example` with all required variables
- [ ] Include deployment checklist
- [ ] Include Supabase schema reference doc

---

## Notes

### Separation Strategy
- Admin portal lives in `admin_portal/` folder
- Can be exported to separate repo at any time
- Shares Supabase project with FM/Tenant apps (same DB, same Edge Functions)
- Uses service-role key for privileged writes (not exposed to FM/Tenant apps)

### Backend Reuse
- Reuses existing Supabase tables: `tenant_profiles`, `fm_profiles`, `buildings`, `meters`, `gas_purchases`, etc.
- Reuses existing Edge Functions: `admin-tariffs`, `vendor-vend-token`, `tb-send-vend`, etc.
- Adds admin-specific tables: `assets`, `asset_assignments`, `gas_vendors`, `vendor_deliveries`
- Adds admin-specific views: `vw_admin_kpis`, `vw_meter_comm_history`

### Security Model
- Client-side queries use anon key + user JWT (RLS enforced)
- Server-side writes use service-role key (RLS bypassed)
- PIN prompt for sensitive sections (price, vend, support)
- Role-based access control (super_admin, admin, support, fm_viewer)

### Future Enhancements
- Add more charts (revenue over time, FM performance metrics, etc.)
- Add CSV export for all list pages
- Add bulk actions (bulk assign, bulk delete, etc.)
- Add activity feed (recent actions across all admins)
- Add notifications for critical events (meter offline, support escalation, etc.)
- Add mobile app version (Flutter) for on-the-go admin access

---

## ✅ PHASES 0-17 COMPLETE

**Phase 17 Deliverables:**
- Toast notification system with 4 types (success, error, warning, info)
- Error sanitization across 19 API routes (prevents information disclosure)
- Error boundary component (prevents app crashes)
- Comprehensive error handling utilities (errorHandling.ts)
- Security hardening (OWASP A01, A04 compliance)
- Audit log viewer with advanced filtering
- All responsive design verified

**See Also:**
- [PHASE_17_COMPLETE.md](./PHASE_17_COMPLETE.md) - Detailed completion report
- [PHASE_17_DEVELOPER_GUIDE.md](./PHASE_17_DEVELOPER_GUIDE.md) - Developer quick reference

---

**End of Detailed TODO**
