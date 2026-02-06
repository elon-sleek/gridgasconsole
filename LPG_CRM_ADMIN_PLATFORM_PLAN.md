# LPG CRM/Admin Platform Plan

**Status:** Implementation in progress  
**Location:** `admin_portal/` (Next.js standalone project)  
**Backend:** Shared Supabase + ThingsBoard with FM/Tenant mobile apps

---

## 1. Vision
A unified web platform for LPG operations management, combining:
- **Automated onboarding:** FMs and Customers auto-appear in admin UI upon signup (no manual entry)
- **Asset management:** Meters, tanks, changeovers (manually registered by admins)
- **Hierarchical assignment:** Admin → FM → Customer with full audit trail
- **Real-time telemetry:** Via ThingsBoard MQTT/REST integration
- **Vending integration:** Manufacturer API for token generation + downlink via ThingsBoard
- **Role-based dashboards:** super_admin, admin, support, fm_viewer

---

## 2. Why Not ThingsBoard Alone?
**ThingsBoard is excellent for telemetry, but insufficient for CRM/admin workflows:**

| Requirement | ThingsBoard Capability | Gap |
|------------|------------------------|-----|
| User/Org Management | Manual device/user entry only | No auto-registration of FMs/Customers as first-class entities |
| CRM/Workflow | No native CRM | No FM/Customer/Asset assignment workflows or audit history |
| Admin Controls | Device-level access only | No business-level overrides (lock meter, reassign FM, price settings) |
| Business Dashboards | Telemetry dashboards only | No KPIs for total FMs, customers, assignments, support tickets |
| Asset Assignment | Device provisioning only | No business logic for asset assignment chains (Admin→FM→Customer) |
| Price Management | N/A | No tariff/pricing UI |
| Support Tickets | N/A | No integrated support ticket system |

**Conclusion:** ThingsBoard serves as a telemetry backend; the admin platform is the CRM/business layer.

---

## 3. Chosen Architecture

### 3.1 Tech Stack
- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **State Management:** Zustand (session), React Query (data fetching)
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions + Storage)
- **Telemetry:** ThingsBoard (MQTT ingestion, device management, telemetry storage)
- **Maps:** Leaflet (for building location visualization)

### 3.2 Data Flow
```
[FM/Tenant Mobile Apps] → Supabase (Auth, purchases, vends)
                       ↓
[Admin Portal (Web)] → Supabase (read all entities, service-role writes)
                       ↓
[ThingsBoard] ← Supabase (meter telemetry via MQTT, vend downlinks via REST)
```

### 3.3 Security Model
- **Client-side reads:** Admin portal uses Supabase anon key + user JWT (RLS enforces read-only for authenticated users)
- **Server-side writes:** All mutations go through Next.js API routes with service-role key (RLS blocks client writes)
- **Sensitive sections:** Price Settings, Vend, Support Center are password-gated (PIN prompt)
- **Audit logging:** All admin actions logged to `admin_audit_log` table (planned)

### 3.4 Database Design
**Existing tables (shared with FM/Tenant apps):**
- `tenant_profiles`, `fm_profiles`, `buildings`, `meters`
- `gas_purchases`, `meter_vends`, `meter_commands`, `meter_telemetry`
- `wallet_transactions`, `tariff_settings`, `building_tariff_overrides`

**Admin-specific tables (new):**
- `assets` (meters/tanks/changeovers inventory)
- `asset_assignments` (assignment audit log: admin→FM, FM→tenant)
- `gas_vendors` (upstream vendor registry)
- `vendor_deliveries` (vendor→FM delivery tracking)
- `admin_audit_log` (planned: all admin actions)
- `organization_settings` (planned: org info, branding, API keys)

**Admin-specific views:**
- `vw_admin_kpis` (KPI aggregates for dashboard)
- `vw_meter_comm_history` (planned: purchase→vend→command→telemetry join for Vend UI)
- `vw_asset_assignments` (planned: assignment chain view)

---

## 4. Feature Implementation Status

### ✅ Implemented (Phases 0-3)
- Project setup (Next.js, Tailwind, Supabase client, Zustand session store)
- Auth & RBAC (login, route guards, role checks, account/password change)
- App shell (sidebar, topbar, navigation, PIN prompt for sensitive sections)
- Dashboard (KPI tiles from `vw_admin_kpis`, chart UI stubs)
- Migrations for `assets`, `asset_assignments`, `gas_vendors`, `vendor_deliveries`

### 🔄 In Progress (Phase 4)
- **Assets:** List + registration + multi-assign ✅, detail page + retrieve ⏳

### ⏳ Planned (Phases 5-17)
- **Phase 5:** FM detail page (mirror FM app: buildings, tenants, assets, deliveries, support tickets), meter lock/unlock
- **Phase 6:** Tenant vend history + usage chart, admin meter lock/unlock, reassign FM
- **Phase 7:** Buildings list + detail (customers, FM, assets)
- **Phase 8:** Gas vendor detail + delivery recording
- **Phase 9:** Map with building markers + filters
- **Phase 10:** Price settings (global + building overrides via `admin-tariffs` Edge Function)
- **Phase 11:** Manual vend (orchestrator endpoint, communication log)
- **Phase 12:** Support center (ticket list, detail, admin actions)
- **Phase 13:** General settings (org info, branding, audit export)
- **Phase 14-17:** Backend wiring (chart RPCs, audit log, dark mode toggle, testing)

---

## 5. Backend Integration Strategy

### 5.1 Supabase Edge Functions (Reused)
- `admin-tariffs`: Price settings (requires `x-admin-secret` header)
- `vendor-vend-token`: Generate vend token (mock or real vendor API)
- `tb-send-vend`: Send vend downlink to ThingsBoard via REST API
- `tb-vend-ack`: Receive ACK from ThingsBoard Rule Chain (webhook)
- `vend-reconcile`: Retry/timeout/refund stuck vends (scheduled job)
- `paystack-*`: Payment integration for tenant wallet top-ups

### 5.2 Next.js API Routes (Admin-Only, Service-Role)
**Assets:**
- `POST /api/admin/assets` - Create asset (links meter via meter_number)
- `POST /api/admin/assets/assign` - Bulk assign to FM
- `POST /api/admin/assets/[id]/retrieve` - Retrieve/unassign asset ⏳

**Facility Managers:**
- `POST /api/admin/facility-managers/[id]/status` - Block/unblock FM
- `POST /api/admin/facility-managers/[id]/lock-meters` - Lock all meters (planned)
- `POST /api/admin/facility-managers/[id]/unlock-meters` - Unlock all meters (planned)

**Customers/Tenants:**
- `POST /api/admin/customers/[id]/lock-meter` - Lock tenant meter (planned)
- `POST /api/admin/customers/[id]/unlock-meter` - Unlock tenant meter (planned)
- `POST /api/admin/customers/[id]/reassign-fm` - Reassign to different FM (planned)

**Gas Vendors:**
- `POST /api/admin/gas-vendors` - Create vendor
- `POST /api/admin/vendor-deliveries` - Record delivery

**Price Settings:**
- `POST /api/admin/price-settings/global` - Set global rate (calls `admin-tariffs`)
- `POST /api/admin/price-settings/buildings` - Bulk update buildings (calls `admin-tariffs`)

**Vending:**
- `POST /api/admin/vend/manual` - Manual vend orchestrator (planned)

**Support:**
- `POST /api/admin/support/[id]/reply` - Add admin message (planned)
- `POST /api/admin/support/[id]/escalate` - Escalate ticket (planned)
- `POST /api/admin/support/[id]/close` - Close ticket (planned)
- `POST /api/admin/support/[id]/reassign` - Reassign to FM (planned)

**Settings:**
- `POST /api/admin/settings/org` - Update org info (planned)
- `GET /api/admin/audit/export` - Export audit logs (planned)

### 5.3 RLS Pattern (Read Allowed, Writes Blocked)
**All admin tables (`assets`, `asset_assignments`, `gas_vendors`, `vendor_deliveries`):**
```sql
-- Enable RLS
alter table public.assets enable row level security;

-- Allow authenticated reads
create policy "Authenticated can read assets"
  on public.assets
  for select
  to authenticated
  using (true);

-- Block authenticated writes (explicit deny)
create policy "No client writes assets"
  on public.assets
  for all
  to authenticated
  using (false)
  with check (false);
```

**Effect:**
- Admin portal UI queries with anon key + user JWT → reads succeed
- Admin portal UI tries to insert/update → fails (RLS blocks)
- API routes use service-role key → RLS bypassed → writes succeed

---

## 6. Deployment Strategy
- **Dev:** `npm run dev` (localhost:3000)
- **Build:** `npm run build` (Next.js static + SSR hybrid)
- **Deploy:** Vercel (recommended) or Docker on VPS
- **Env vars:** `.env.local` for dev, platform env config for prod
- **CI/CD:** GitHub Actions for lint/typecheck/test on PR, auto-deploy on merge to main

---

## 7. Future Enhancements
- **Mobile app:** Flutter version of admin portal for on-the-go access
- **Advanced charts:** Revenue over time, FM performance metrics, customer usage trends
- **Bulk operations:** CSV import/export for assets, bulk delete, bulk reassign
- **Notifications:** Email/SMS/push for critical events (meter offline, support escalation, low balance)
- **Activity feed:** Real-time stream of all admin/FM/customer actions
- **Multi-tenancy:** Support multiple organizations (if expanding to SaaS model)

---

**Summary:** This plan establishes a robust, auditable, role-based admin platform that complements the FM/Tenant mobile apps while reusing the existing Supabase + ThingsBoard backend. ThingsBoard remains the telemetry source; the admin portal is the business/CRM layer.
