# Admin Portal - Phase 1 & 2 Complete

## ✅ What was built:

### Phase 0 - Project Setup
- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Supabase JS client with auth/session management
- Leaflet (OpenStreetMap) for maps
- Environment config + API client wrappers

### Phase 1 - Auth & RBAC
- **Login screen**: `/login` with email/password via Supabase Auth
- **Roles system**: `super_admin`, `admin`, `support`, `fm_viewer` with permission checks
- **Route guards**: `RouteGuard` and `ProtectedRoute` components enforce access
- **Account page**: `/account` with profile info and password change
- **Topbar enhancements**: 
  - Avatar with first initial
  - Login duration tracker (updates every minute)
  - 3-dot menu dropdown → Account, Logout

### Phase 2 - App Shell & Navigation
- **Sidebar navigation** with all menu items:
  - Dashboard, Assets, Facility Managers, Customers/Tenants, Buildings, Gas Vendors, Map, Price Settings, Vend, Support Center, General Settings
- **Password-gated pages** with PIN entry:
  - `/price-settings` (super_admin only)
  - `/vend` (super_admin only)
  - `/support` (super_admin + support roles)
- **Shell layout** with sidebar + topbar wrapper
- **Unauthorized page** for access denials

## 🔧 How to run:

1. Create `admin_portal/.env.local`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
ADMIN_PIN=1234
```

2. Run dev server:
```bash
cd admin_portal
npm run dev
```

3. Open http://localhost:3000

## 📋 Next steps (Phase 3+):

- **Phase 3**: Dashboard KPIs (total tenants, assets, FMs, etc.) from `vw_admin_kpis` view
- **Phase 4+**: Assets, FMs, Customers, Buildings, Gas Vendors, Map pages with CRUD operations
- **Backend**: Apply SQL views from `supabase/admin_portal/admin_views.sql` to your Supabase project

## 🔑 User roles:

To test roles, set user metadata in Supabase:
- Dashboard → Authentication → Users → select user → edit `app_metadata`:
```json
{
  "role": "super_admin"
}
```

Available roles: `super_admin`, `admin`, `support`, `fm_viewer`
