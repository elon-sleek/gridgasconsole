# LPG CRM/Admin Platform TODO

**Status:** Phase 4 in progress (Assets detail page)  
**Detailed Plan:** See `ADMIN_CRM_DETAILED_TODO.md` for comprehensive step-by-step breakdown

Location: `admin_portal/` folder (separate from mobile app for easy export/spin-out). This admin web portal orchestrates FMs, customers/tenants, assets, and vendors while reusing the existing Supabase + ThingsBoard backend.

---

## 0) Project Setup
- [x] Decide stack: Next.js (App Router) + TypeScript + Tailwind + React Query + Zustand + Supabase JS client.
- [x] Create folder `admin_portal/` for the web app shell (standalone Next.js project).
- [x] Create folder `supabase/admin_portal/` for SQL/views/migrations.
- [x] Add initial SQL/views file: `supabase/admin_portal/admin_views.sql` (vw_admin_kpis, vw_meter_comm_history stub).
- [x] Add theme tokens doc: `admin_portal/design/THEME_TOKENS.md` (light/dark design tokens).
- [x] Add package scaffolding in `admin_portal/` (package.json, tsconfig, next.config, tailwind/postcss config, base app/page/layout, globals.css).
- [x] Add environment handling stub: `admin_portal/.env.example` with Supabase/TB/map/admin pin.
- [x] Install UI + state libs (npm install) and map SDK (Leaflet installed for maps).
- [x] Set up auth/session storage and API client wrappers (Supabase client + authenticated fetch for Edge Functions).
- [x] Add canonical schema reference: `supabase/admin_portal/SCHEMA_REFERENCE.md` (prevent naming mismatches).
- [x] Add migrations for admin tables: `assets`, `asset_assignments`, `gas_vendors`, `vendor_deliveries`.

## 1) Auth & RBAC
- [x] Login screen (email/password) using Supabase Auth at `/login`.
- [x] Roles: `super_admin`, `admin`, `support`, `fm_viewer` defined in `lib/roles.ts`.
- [x] Route guards (`RouteGuard.tsx`) check auth + optional permissions.
- [x] Redirect unauthenticated users to `/login`.
- [x] Account page (`/account`) with password change form.
- [ ] Create `/unauthorized` page for permission denied.

## 2) App Shell & Navigation
- [x] Left menu items: Dashboard, Assets, Facility Managers, Customers/Tenants, Buildings, Gas Vendors, Map, Price Settings (passworded), Vend (passworded), Support Center (passworded), General Settings.
- [x] Right-top bar: avatar (first letter of email), login time + duration (live update every minute), 3-dot menu → Account, Logout.
- [x] Password-gated sections (Price Settings, Vend, Support Center) use PIN prompt component.
- [x] Logout functionality wired in Topbar.

## 3) Dashboard (Admin Home)
- [x] KPI tiles query `vw_admin_kpis` (Supabase view):
  - [x] Total tenants, total active tenants
  - [x] Total assets (with breakdown by type)
  - [x] Total assigned assets (toggle: to FMs / to tenants)
  - [x] Total connected buildings
  - [x] Open support tickets
  - [x] Total gas vendors
  - [x] Gas deliveries completed, gas deliveries ongoing
- [x] Charts UI created (`DashboardCharts.tsx`):
  - [x] Real-time usage trend (calls `admin_usage_trend` RPC - placeholder)
  - [x] Daily gas top-ups bar chart (calls `admin_daily_topups` RPC - placeholder)
  - [x] Growth over time (calls `admin_growth_over_time` RPC - placeholder)
- [ ] Wire chart RPCs to actual Supabase functions (currently show "No data" if RPC missing).

## 4) Assets
- [x] Asset registration form (type: meter/tank/changeover, serial, capacity, manufacturer, firmware, install address).
- [x] For meter assets: link via `meters.meter_number` (backend resolves meter_id).
- [x] Assets list with multi-select (checkboxes).
- [x] Assign button opens dialog → select FM → submit.
- [x] Backend: `POST /api/admin/assets` (create), `POST /api/admin/assets/assign` (assign to FM).
- [x] Server routes use service-role key (RLS blocks client writes).
- [ ] **Asset detail page (`/assets/[id]`):** full metadata, assignment history (admin→FM, FM→tenant), actions: Assign/Retrieve. ← **IN PROGRESS**
- [ ] **Retrieve/unassign flow:** `POST /api/admin/assets/[id]/retrieve`. ← **IN PROGRESS**

## 5) Facility Managers
- [x] FM list page (`/facility-managers`) queries `fm_profiles`.
- [x] Block/Unblock buttons → `POST /api/admin/facility-managers/[id]/status` (server route).
- [ ] FM detail page (`/facility-managers/[id]`): mirror of FM app—show buildings, tenants, assets, deliveries, support tickets.
- [ ] Admin override actions: Lock all meters under FM, Unlock all meters.
- [ ] Server routes: `POST /api/admin/facility-managers/[id]/lock-meters`, `POST /api/admin/facility-managers/[id]/unlock-meters`.
- [ ] Backend: call existing lifecycle RPCs to change meter status.

## 6) Customers/Tenants
- [x] Tenants list page (`/customers`) queries `tenant_profiles`.
- [x] Display: Name, Customer ID, Account status, Claim status, Claimed by FM (lookup), Meter number, Created date.
- [x] Click tenant → navigate to detail page.
- [x] Tenant detail page (`/customers/[id]`): profile + purchase history (last 20) + wallet balance + wallet ledger (last 20).
- [ ] Add vend history (`meter_vends`) to detail page (join via `gas_purchases`).
- [ ] Add basic usage chart (query `meter_telemetry` for remaining_kg over time).
- [ ] Admin override actions:
  - [ ] Lock Meter: `POST /api/admin/customers/[id]/lock-meter` (call lifecycle RPC).
  - [ ] Unlock Meter: `POST /api/admin/customers/[id]/unlock-meter`.
  - [ ] Reassign to FM: `POST /api/admin/customers/[id]/reassign-fm` (update `claimed_by_fm_id`).

## 7) Buildings
- [ ] Buildings list page (`/buildings`) queries `buildings`.
- [ ] Display: Address, Lat/Long, Customer count (from `tenant_profiles.building_id`), Photo, Responsible FM.
- [ ] Click building → navigate to detail page.
- [ ] Building detail page (`/buildings/[id]`): show building info, list of customers, responsible FM, assets in building, tanks (if applicable).
- [ ] Click customer → navigate to `/customers/[id]`.
- [ ] Click FM → navigate to `/facility-managers/[id]`.

## 8) Gas Vendors
- [x] Vendors list page (`/gas-vendors`) queries `gas_vendors`.
- [x] Display: Name, Plant location, Capacity, Active status, Registered date.
- [x] Register vendor form: `POST /api/admin/gas-vendors` (server route).
- [ ] Vendor detail page (`/gas-vendors/[id]`): show vendor info + sales history to FMs (from `vendor_deliveries`).
- [ ] Add "Record Delivery" form: `POST /api/admin/vendor-deliveries` (server route).

## 9) Map
- [ ] Map page (`/map`) with Leaflet integration.
- [ ] Query `buildings` with lat/long, display markers.
- [ ] On marker click: popup with building info (address, customer count, FM), link to building detail.
- [ ] Filters: by FM, by assignment status, by alert/telemetry state (if ThingsBoard data available).
- [ ] Optional: street view toggle (link to Google Maps street view).

## 10) Price Settings (Passworded)
- [ ] Price settings page (`/price-settings`) wrapped with PIN prompt.
- [ ] Display global price (query `tariff_settings`).
- [ ] Form to set global price: submit via `POST /api/admin/price-settings/global` → calls Edge Function `admin-tariffs` (action: `set_global`).
- [ ] Display building overrides (query `building_tariff_overrides`).
- [ ] Bulk update buildings: select multiple, set rate → `POST /api/admin/price-settings/buildings` → calls Edge Function `admin-tariffs` (action: `set_buildings`).
- [ ] Optional: per-meter overrides.

## 11) Vend (Passworded)
- [ ] Vend page (`/vend`) wrapped with PIN prompt.
- [ ] Query `meters` (all registered meters), display table with search/filter.
- [ ] "Vend Gas" button per meter → opens dialog.
- [ ] Dialog: meter info, recent communication log (query `vw_meter_comm_history`), form fields (Amount/kg, Admin note).
- [ ] Submit: `POST /api/admin/vend/manual` (server route).
  - [ ] Backend creates `gas_purchases` (source: admin_manual).
  - [ ] Calls Edge Functions: `vendor-vend-token`, `tb-send-vend`.
  - [ ] Returns result.
- [ ] Display vend history panel: purchases → vends → commands → telemetry (use `vw_meter_comm_history`).

## 12) Support Center (Passworded)
- [ ] Support page (`/support`) wrapped with PIN prompt.
- [ ] Query `support_tickets`, display two sections: Open Tickets, Closed Tickets.
- [ ] Open tickets: status = open/in_progress/escalated; display Ticket ID, Customer, FM, Priority, Created date.
- [ ] Click ticket → navigate to ticket detail page (`/support/[id]`).
- [ ] Ticket detail: show ticket info + conversation history (query `support_messages`).
- [ ] Admin actions:
  - [ ] Add reply: `POST /api/admin/support/[id]/reply`.
  - [ ] Escalate: `POST /api/admin/support/[id]/escalate`.
  - [ ] Close: `POST /api/admin/support/[id]/close`.
  - [ ] Reassign to FM: `POST /api/admin/support/[id]/reassign`.
- [ ] Optional: Supabase Realtime for live chat updates.

## 13) General Settings
- [ ] Settings page (`/settings`) with sections:
  - [ ] Organization Info: name, logo, contact email/phone (store in `organization_settings` table).
  - [ ] Branding: upload logo (Supabase Storage), set theme colors.
  - [ ] Map API Key: Google Maps / Mapbox key.
  - [ ] Notification Settings: email, SMS, push toggles.
  - [ ] Audit Export: download audit logs as CSV (`GET /api/admin/audit/export`).
  - [ ] Admin Override Toggles: enable/disable certain FM/customer powers.

## 14) Backend Integration
- [x] Supabase DB is source-of-truth; client reads via anon key + JWT, writes via service-role (Next.js API routes).
- [x] Existing Edge Functions identified:
  - [x] `admin-tariffs` (price settings, requires `x-admin-secret`).
  - [x] `vendor-vend-token` (generate vend token).
  - [x] `tb-send-vend` (send vend downlink to ThingsBoard).
  - [x] `tb-vend-ack` (called by TB Rule Chain to mark ACK/fail).
  - [x] `vend-reconcile` (retry/timeout/refund stuck vends).
- [x] Tables used: `tenant_profiles`, `fm_profiles`, `buildings`, `meters`, `gas_purchases`, `meter_vends`, `meter_commands`, `meter_telemetry`, `wallet_transactions`, `tariff_settings`, `building_tariff_overrides`.
- [x] Admin-specific tables created: `assets`, `asset_assignments`, `gas_vendors`, `vendor_deliveries`.
- [x] All admin writes go through Next.js API routes (service-role) to preserve auditability.
- [ ] Add admin audit log table to track all admin actions.

## 15) Security & Audit
- [x] RLS enabled on admin tables: authenticated can read, no client writes (explicit deny policies).
- [x] Service-role key stored in `.env.local` (server-only, never exposed to browser).
- [x] PIN prompt for sensitive sections (Price Settings, Vend, Support Center).
- [ ] Create `admin_audit_log` table (columns: user_id, action, entity_type, entity_id, old_value, new_value, timestamp).
- [ ] Add audit logging to all server routes (log asset actions, FM actions, tenant actions, price changes, vends, support actions).

## 16) Data Model & Views
- [x] Reuse existing Supabase project (single source of truth for FM + Tenant + Admin apps).
- [x] Admin views created:
  - [x] `vw_admin_kpis` (totals: tenants, active tenants, assets, assigned, buildings, vendors, deliveries, support tickets).
  - [ ] `vw_meter_comm_history` (joins purchases→vends→commands→telemetry for Vend UI history).
  - [ ] `vw_asset_assignments` (optional: admin→FM→tenant chain view).
  - [ ] `vw_vendor_sales` (optional: vendor deliveries to FMs).
- [x] Admin tables created:
  - [x] `assets` (type, meter_id, serial, capacity_kg, manufacturer, firmware_version, building_id, install_address, vendor_device_id, vendor_api_ref, created_by, created_at).
  - [x] `asset_assignments` (asset_id, assigned_to_type, assigned_to_fm_id, assigned_to_tenant_id, status, assigned_by, assigned_at, retrieved_at, note).
  - [x] `gas_vendors` (name, plant_location, capacity_kg, contact, active, created_by, created_at).
  - [x] `vendor_deliveries` (vendor_id, fm_id, quantity_kg, status, delivered_at, proof_url, note, created_by, created_at).
- [ ] Verify `support_tickets` / `support_messages` tables exist (or create).
- [x] RLS: authenticated can read admin tables, no client writes (enforced via policies).
- [x] Server routes use service-role key for privileged writes.
- [ ] Add admin-only RPCs for chart data: `admin_usage_trend`, `admin_daily_topups`, `admin_growth_over_time`.

## 17) UI/UX
- [x] Design tokens defined in `admin_portal/design/THEME_TOKENS.md` (colors, typography, spacing).
- [x] Tailwind config uses design tokens (CSS variables for light/dark mode).
- [x] Base dark mode CSS applied globally.
- [ ] Add theme toggle in Topbar or Settings page.
- [ ] Persist theme preference in localStorage or user settings.
- [ ] Test all pages in dark mode (ensure readability, chart theming).
- [ ] Map component themed (dark tiles when dark mode enabled).

---

**Notes:**
- Keep this admin app separate (`admin_portal/`) for clean export/deployment.
- ThingsBoard is used for telemetry transport/visuals; the CRM logic lives here with Supabase as source-of-truth.
- See `ADMIN_CRM_DETAILED_TODO.md` for granular task breakdown (18 phases, 200+ sub-tasks).
