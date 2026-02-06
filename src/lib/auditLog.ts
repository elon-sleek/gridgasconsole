/**
 * Audit Logging Helper
 * 
 * Provides utilities for logging administrative actions to the audit trail.
 * All admin actions should be logged for compliance and security.
 */

import { getSupabaseAdminClient } from './supabaseAdmin';
import type { User } from '@supabase/supabase-js';

export type AuditAction =
  // Asset actions
  | 'create_asset'
  | 'assign_asset'
  | 'retrieve_asset'
  | 'update_asset'
  | 'delete_asset'
  // FM actions
  | 'block_fm'
  | 'unblock_fm'
  | 'lock_fm_meters'
  | 'unlock_fm_meters'
  | 'update_fm'
  // Tenant actions
  | 'lock_meter'
  | 'unlock_meter'
  | 'reassign_fm'
  | 'update_tenant'
  // Price actions
  | 'update_price_global'
  | 'update_price_building'
  | 'update_price_meter'
  // Vend actions
  | 'manual_vend'
  | 'vend_retry'
  | 'vend_refund'
  // Support actions
  | 'escalate_ticket'
  | 'close_ticket'
  | 'reassign_ticket'
  | 'reply_ticket'
  // Vendor actions
  | 'create_vendor'
  | 'update_vendor'
  | 'create_delivery'
  // Admin management actions
  | 'create_admin'
  | 'update_admin'
  | 'suspend_admin'
  | 'delete_admin'
  | 'grant_pin_access'
  | 'revoke_pin_access'
  // General
  | 'login'
  | 'logout'
  | 'update_settings';

export interface AuditLogEntry {
  userId: string;
  userEmail: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an admin action to the audit trail
 * 
 * @param entry - The audit log entry
 * @returns The UUID of the created audit log entry
 */
export async function logAuditAction(entry: AuditLogEntry): Promise<string | null> {
  try {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase.rpc('log_admin_action', {
      p_user_id: entry.userId,
      p_user_email: entry.userEmail,
      p_action: entry.action,
      p_entity_type: entry.entityType || null,
      p_entity_id: entry.entityId || null,
      p_old_value: entry.oldValue ? JSON.stringify(entry.oldValue) : null,
      p_new_value: entry.newValue ? JSON.stringify(entry.newValue) : null,
      p_details: entry.details || null,
      p_ip_address: entry.ipAddress || null,
      p_user_agent: entry.userAgent || null,
    });

    if (error) {
      console.error('[Audit Log] Failed to log action:', error);
      return null;
    }

    return data as string;
  } catch (err) {
    console.error('[Audit Log] Exception while logging:', err);
    return null;
  }
}

/**
 * Extract IP address from Next.js request
 */
export function getIpFromRequest(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  return realIp || undefined;
}

/**
 * Extract user agent from Next.js request
 */
export function getUserAgentFromRequest(request: Request): string | undefined {
  return request.headers.get('user-agent') || undefined;
}

/**
 * Helper to create audit context from request
 */
export function getAuditContext(request: Request) {
  return {
    ipAddress: getIpFromRequest(request),
    userAgent: getUserAgentFromRequest(request),
  };
}

/**
 * Log asset-related actions
 */
export async function logAssetAction(
  user: User,
  action: 'create_asset' | 'assign_asset' | 'retrieve_asset',
  assetId: string,
  details: string,
  oldValue?: Record<string, any>,
  newValue?: Record<string, any>,
  context?: { ipAddress?: string; userAgent?: string }
) {
  return logAuditAction({
    userId: user.id,
    userEmail: user.email!,
    action,
    entityType: 'asset',
    entityId: assetId,
    oldValue,
    newValue,
    details,
    ...context,
  });
}

/**
 * Log FM-related actions
 */
export async function logFmAction(
  user: User,
  action: 'block_fm' | 'unblock_fm' | 'lock_fm_meters' | 'unlock_fm_meters',
  fmId: string,
  details: string,
  oldValue?: Record<string, any>,
  newValue?: Record<string, any>,
  context?: { ipAddress?: string; userAgent?: string }
) {
  return logAuditAction({
    userId: user.id,
    userEmail: user.email!,
    action,
    entityType: 'fm_profile',
    entityId: fmId,
    oldValue,
    newValue,
    details,
    ...context,
  });
}

/**
 * Log tenant-related actions
 */
export async function logTenantAction(
  user: User,
  action: 'lock_meter' | 'unlock_meter' | 'reassign_fm',
  tenantId: string,
  details: string,
  oldValue?: Record<string, any>,
  newValue?: Record<string, any>,
  context?: { ipAddress?: string; userAgent?: string }
) {
  return logAuditAction({
    userId: user.id,
    userEmail: user.email!,
    action,
    entityType: 'tenant_profile',
    entityId: tenantId,
    oldValue,
    newValue,
    details,
    ...context,
  });
}

/**
 * Log price-related actions
 */
export async function logPriceAction(
  user: User,
  action: 'update_price_global' | 'update_price_building' | 'update_price_meter',
  entityId: string,
  oldPrice: number,
  newPrice: number,
  details: string,
  context?: { ipAddress?: string; userAgent?: string }
) {
  return logAuditAction({
    userId: user.id,
    userEmail: user.email!,
    action,
    entityType: action === 'update_price_global' ? 'tariff_setting' : 'tariff_override',
    entityId,
    oldValue: { price_per_kg: oldPrice },
    newValue: { price_per_kg: newPrice },
    details,
    ...context,
  });
}

/**
 * Log vend-related actions
 */
export async function logVendAction(
  user: User,
  action: 'manual_vend' | 'vend_retry' | 'vend_refund',
  purchaseId: string,
  details: string,
  metadata?: Record<string, any>,
  context?: { ipAddress?: string; userAgent?: string }
) {
  return logAuditAction({
    userId: user.id,
    userEmail: user.email!,
    action,
    entityType: 'gas_purchase',
    entityId: purchaseId,
    newValue: metadata,
    details,
    ...context,
  });
}

/**
 * Log support ticket actions
 */
export async function logSupportAction(
  user: User,
  action: 'escalate_ticket' | 'close_ticket' | 'reassign_ticket' | 'reply_ticket',
  ticketId: string,
  details: string,
  oldValue?: Record<string, any>,
  newValue?: Record<string, any>,
  context?: { ipAddress?: string; userAgent?: string }
) {
  return logAuditAction({
    userId: user.id,
    userEmail: user.email!,
    action,
    entityType: 'support_ticket',
    entityId: ticketId,
    oldValue,
    newValue,
    details,
    ...context,
  });
}

/**
 * Log admin management actions
 */
export async function logAdminAction(
  user: User,
  action: 'create_admin' | 'update_admin' | 'suspend_admin' | 'delete_admin' | 'grant_pin_access' | 'revoke_pin_access',
  adminId: string,
  details: string,
  oldValue?: Record<string, any>,
  newValue?: Record<string, any>,
  context?: { ipAddress?: string; userAgent?: string }
) {
  return logAuditAction({
    userId: user.id,
    userEmail: user.email!,
    action,
    entityType: 'admin_user',
    entityId: adminId,
    oldValue,
    newValue,
    details,
    ...context,
  });
}
