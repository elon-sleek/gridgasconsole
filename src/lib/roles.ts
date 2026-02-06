export type Role = 'super_admin' | 'admin' | 'support' | 'fm_viewer';

export type UserWithRole = {
  id: string;
  email?: string;
  role?: Role;
};

// Feature flags for granular access control
export type Feature =
  | 'dashboard'
  | 'assets.view'
  | 'assets.create'
  | 'assets.assign'
  | 'assets.retrieve'
  | 'fms.view'
  | 'fms.block'
  | 'fms.lock_meters'
  | 'customers.view'
  | 'customers.lock_meter'
  | 'customers.reassign_fm'
  | 'buildings.view'
  | 'vendors.view'
  | 'vendors.create'
  | 'deliveries.create'
  | 'map.view'
  | 'price_settings.view'
  | 'price_settings.update_global'
  | 'price_settings.update_building'
  | 'vend.manual'
  | 'support.view'
  | 'support.reply'
  | 'support.escalate'
  | 'support.close'
  | 'support.reassign'
  | 'settings.profile'
  | 'settings.preferences'
  | 'settings.appearance'
  | 'settings.admin_users'
  | 'audit.view'
  | 'audit.export';

export function isRole(value: unknown): value is Role {
  return value === 'super_admin' || value === 'admin' || value === 'support' || value === 'fm_viewer';
}

export function getUserRole(user: any): Role | null {
  // Check user metadata for role.
  // Note: in this app, the source of truth is the `admin_roles` table.
  // We only trust metadata when it's explicitly set.
  const raw = user?.app_metadata?.role || user?.user_metadata?.role;
  if (isRole(raw)) return raw;
  return null;
}

// Permission matrix: defines what each role can do
const ROLE_PERMISSIONS: Record<Role, Feature[]> = {
  super_admin: [
    // Full access to everything
    'dashboard',
    'assets.view', 'assets.create', 'assets.assign', 'assets.retrieve',
    'fms.view', 'fms.block', 'fms.lock_meters',
    'customers.view', 'customers.lock_meter', 'customers.reassign_fm',
    'buildings.view',
    'vendors.view', 'vendors.create',
    'deliveries.create',
    'map.view',
    'price_settings.view', 'price_settings.update_global', 'price_settings.update_building',
    'vend.manual',
    'support.view', 'support.reply', 'support.escalate', 'support.close', 'support.reassign',
    'settings.profile', 'settings.preferences', 'settings.appearance', 'settings.admin_users',
    'audit.view', 'audit.export'
  ],
  admin: [
    // Standard admin: full operational access except price/vend unless PIN access granted
    'dashboard',
    'assets.view', 'assets.create', 'assets.assign', 'assets.retrieve',
    'fms.view', 'fms.block', 'fms.lock_meters',
    'customers.view', 'customers.lock_meter', 'customers.reassign_fm',
    'buildings.view',
    'vendors.view', 'vendors.create',
    'deliveries.create',
    'map.view',
    // No price_settings or vend unless explicitly granted PIN access
    'settings.profile', 'settings.preferences', 'settings.appearance',
    'audit.view'
  ],
  support: [
    // Support staff: focused on customer support
    'dashboard',
    'customers.view',
    'fms.view',
    'buildings.view',
    'support.view', 'support.reply', 'support.escalate', 'support.close', 'support.reassign',
    'settings.profile', 'settings.preferences', 'settings.appearance',
    'audit.view'
  ],
  fm_viewer: [
    // Read-only viewer
    'dashboard',
    'fms.view',
    'customers.view',
    'buildings.view',
    'vendors.view',
    'map.view',
    'settings.profile', 'settings.preferences', 'settings.appearance'
  ]
};

export function hasPermission(role: Role | null, permission: string): boolean {
  if (!role) return false;

  const permissions: Record<Role, string[]> = {
    super_admin: ['*'], // full access
    admin: ['dashboard', 'assets', 'fms', 'customers', 'buildings', 'vendors', 'map', 'settings'], // no price/vend/support unless explicitly added
    support: ['dashboard', 'support', 'customers', 'fms'], // support-focused
    fm_viewer: ['dashboard', 'fms', 'buildings', 'customers'] // read-only
  };

  const userPerms = permissions[role] || [];
  return userPerms.includes('*') || userPerms.includes(permission);
}

export function hasFeature(role: Role | null, feature: Feature): boolean {
  if (!role) return false;
  const features = ROLE_PERMISSIONS[role] || [];
  return features.includes(feature);
}

export function canAccessPriceSettings(role: Role | null): boolean {
  return role === 'super_admin';
}

export function canAccessVend(role: Role | null): boolean {
  return role === 'super_admin';
}

export function canAccessSupportCenter(role: Role | null): boolean {
  return role === 'super_admin' || role === 'support';
}

export function canManageAdminUsers(role: Role | null): boolean {
  return hasFeature(role, 'settings.admin_users');
}

export function canExportAudit(role: Role | null): boolean {
  return hasFeature(role, 'audit.export');
}

export function canBlockFM(role: Role | null): boolean {
  return hasFeature(role, 'fms.block');
}

export function canLockMeter(role: Role | null): boolean {
  return hasFeature(role, 'customers.lock_meter') || hasFeature(role, 'fms.lock_meters');
}

export function canManualVend(role: Role | null): boolean {
  return hasFeature(role, 'vend.manual');
}

export function canUpdatePrices(role: Role | null): boolean {
  return hasFeature(role, 'price_settings.update_global') || hasFeature(role, 'price_settings.update_building');
}

