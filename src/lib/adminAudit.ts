import { getSupabaseAdminClient } from './supabaseAdmin';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export async function insertAdminAuditLog(args: {
  req?: Request;
  actor: { id: string; email?: string | null };
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: JsonValue;
  newValue?: JsonValue;
  metadata?: JsonValue;
}) {
  const supabase = getSupabaseAdminClient();

  const ipAddressRaw = args.req?.headers.get('x-forwarded-for') || args.req?.headers.get('x-real-ip');
  const ipAddress = ipAddressRaw ? ipAddressRaw.split(',')[0].trim() : null;
  const userAgent = args.req?.headers.get('user-agent') || null;

  await supabase.from('admin_audit_log').insert({
    user_id: args.actor.id,
    user_email: args.actor.email ?? null,
    action: args.action,
    entity_type: args.entityType,
    entity_id: args.entityId ?? null,
    old_value: (args.oldValue ?? null) as any,
    new_value: (args.newValue ?? null) as any,
    metadata: (args.metadata ?? null) as any,
    ip_address: ipAddress,
    user_agent: userAgent
  });
}
