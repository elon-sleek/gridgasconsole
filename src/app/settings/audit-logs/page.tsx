'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { formatDistanceToNow } from 'date-fns';
import { IconList } from '@/components/AppIcons';
import { PinGate } from '@/components/PinGate';

type AuditLog = {
  id: string;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  old_value: any;
  new_value: any;
  metadata: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

type AuditStats = {
  actions_last_24h: number;
  actions_last_7d: number;
  actions_last_30d: number;
  active_admins_24h: number;
  critical_actions_24h: number;
};

export default function AuditLogsPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [dateRange, setDateRange] = useState('7d');
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [adminFilter, setAdminFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const supabase = getSupabaseClient();

  // Fetch audit stats
  const { data: stats } = useQuery({
    queryKey: ['audit_stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_audit_stats')
        .select('*')
        .single();
      if (error) throw error;
      return data as AuditStats;
    },
  });

  // Fetch audit logs
  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit_logs', dateRange, actionFilter, entityTypeFilter, adminFilter],
    queryFn: async () => {
      let query = supabase
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Apply date range filter
      if (dateRange !== 'all') {
        const days = parseInt(dateRange.replace('d', ''));
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        query = query.gte('created_at', cutoff.toISOString());
      }

      // Apply action filter
      if (actionFilter) {
        query = query.ilike('action', `%${actionFilter}%`);
      }

      // Apply entity type filter
      if (entityTypeFilter) {
        query = query.eq('entity_type', entityTypeFilter);
      }

      // Apply admin filter
      if (adminFilter) {
        query = query.ilike('user_email', `%${adminFilter}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLog[];
    },
  });

  const getActionBadgeColor = (action: string) => {
    if (action.includes('manual_vend') || action.includes('update_price') || action.includes('block') || action.includes('lock')) {
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    }
    if (action.includes('created') || action.includes('assigned') || action.includes('escalate')) {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  };

  return (
    <PinGate isUnlocked={unlocked} onUnlock={() => setUnlocked(true)}>
      <div className="space-y-4">
        {/* Header */}
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-textSecondary dark:text-dark-textSecondary">Settings</p>
              <h1 className="text-2xl font-semibold flex items-center gap-2">
                <IconList className="w-6 h-6 text-primary" />
                Audit Logs
              </h1>
              <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-1">
                Track all administrative actions for compliance and security
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-5">
            <div className="card p-4">
              <p className="text-xs text-textSecondary dark:text-dark-textSecondary">Last 24 Hours</p>
              <p className="text-2xl font-semibold mt-1">{stats.actions_last_24h}</p>
              <p className="text-xs text-textSecondary dark:text-dark-textSecondary mt-1">actions</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-textSecondary dark:text-dark-textSecondary">Last 7 Days</p>
              <p className="text-2xl font-semibold mt-1">{stats.actions_last_7d}</p>
              <p className="text-xs text-textSecondary dark:text-dark-textSecondary mt-1">actions</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-textSecondary dark:text-dark-textSecondary">Last 30 Days</p>
              <p className="text-2xl font-semibold mt-1">{stats.actions_last_30d}</p>
              <p className="text-xs text-textSecondary dark:text-dark-textSecondary mt-1">actions</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-textSecondary dark:text-dark-textSecondary">Active Admins</p>
              <p className="text-2xl font-semibold mt-1">{stats.active_admins_24h}</p>
              <p className="text-xs text-textSecondary dark:text-dark-textSecondary mt-1">last 24h</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-textSecondary dark:text-dark-textSecondary">Critical Actions</p>
              <p className="text-2xl font-semibold mt-1 text-red-600 dark:text-red-400">{stats.critical_actions_24h}</p>
              <p className="text-xs text-textSecondary dark:text-dark-textSecondary mt-1">last 24h</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="card p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="text-xs font-medium mb-1 block">Date Range</label>
              <select
                className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
              >
                <option value="1d">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Action</label>
              <input
                type="text"
                className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm"
                placeholder="Filter by action..."
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Entity Type</label>
              <select
                className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm"
                value={entityTypeFilter}
                onChange={(e) => setEntityTypeFilter(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="asset">Asset</option>
                <option value="fm_profile">FM Profile</option>
                <option value="tenant_profile">Tenant Profile</option>
                <option value="meter">Meter</option>
                <option value="gas_purchase">Gas Purchase</option>
                <option value="tariff_setting">Tariff Setting</option>
                <option value="support_ticket">Support Ticket</option>
                <option value="admin_user">Admin User</option>
                <option value="gas_vendor">Gas Vendor</option>
                <option value="vendor_delivery">Vendor Delivery</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Admin User</label>
              <input
                type="text"
                className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm"
                placeholder="Filter by email..."
                value={adminFilter}
                onChange={(e) => setAdminFilter(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border dark:border-dark-border">
                <tr className="text-left text-xs font-medium text-textSecondary dark:text-dark-textSecondary">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-dark-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-textSecondary dark:text-dark-textSecondary">
                      Loading audit logs...
                    </td>
                  </tr>
                ) : logs && logs.length > 0 ? (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="px-4 py-3 text-sm">
                        <div>{new Date(log.created_at).toLocaleString()}</div>
                        <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{log.user_email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${getActionBadgeColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div>{log.entity_type || 'N/A'}</div>
                        {log.entity_id && (
                          <div className="text-xs text-textSecondary dark:text-dark-textSecondary font-mono">
                            {log.entity_id.substring(0, 8)}...
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-textSecondary dark:text-dark-textSecondary max-w-xs truncate">
                        {log.details || 'No details'}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-textSecondary dark:text-dark-textSecondary">
                        {log.ip_address || 'N/A'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-textSecondary dark:text-dark-textSecondary">
                      No audit logs found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Modal */}
        {selectedLog && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedLog(null)}
          >
            <div
              className="card max-w-3xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-border dark:border-dark-border">
                <h2 className="text-lg font-semibold">Audit Log Details</h2>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-textSecondary dark:text-dark-textSecondary">Timestamp</p>
                    <p className="text-sm mt-1">{new Date(selectedLog.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-textSecondary dark:text-dark-textSecondary">Admin User</p>
                    <p className="text-sm mt-1">{selectedLog.user_email}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-textSecondary dark:text-dark-textSecondary">Action</p>
                    <p className="text-sm mt-1">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${getActionBadgeColor(selectedLog.action)}`}>
                        {selectedLog.action}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-textSecondary dark:text-dark-textSecondary">Entity Type</p>
                    <p className="text-sm mt-1">{selectedLog.entity_type || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-textSecondary dark:text-dark-textSecondary">Entity ID</p>
                    <p className="text-sm mt-1 font-mono">{selectedLog.entity_id || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-textSecondary dark:text-dark-textSecondary">IP Address</p>
                    <p className="text-sm mt-1 font-mono">{selectedLog.ip_address || 'N/A'}</p>
                  </div>
                </div>

                {selectedLog.details && (
                  <div>
                    <p className="text-xs font-medium text-textSecondary dark:text-dark-textSecondary">Details</p>
                    <p className="text-sm mt-1">{selectedLog.details}</p>
                  </div>
                )}

                {selectedLog.old_value && (
                  <div>
                    <p className="text-xs font-medium text-textSecondary dark:text-dark-textSecondary mb-1">Old Value</p>
                    <pre className="text-xs bg-surfaceMuted dark:bg-dark-surfaceMuted p-3 rounded overflow-x-auto">
                      {JSON.stringify(selectedLog.old_value, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.new_value && (
                  <div>
                    <p className="text-xs font-medium text-textSecondary dark:text-dark-textSecondary mb-1">New Value</p>
                    <pre className="text-xs bg-surfaceMuted dark:bg-dark-surfaceMuted p-3 rounded overflow-x-auto">
                      {JSON.stringify(selectedLog.new_value, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.metadata && (
                  <div>
                    <p className="text-xs font-medium text-textSecondary dark:text-dark-textSecondary mb-1">Metadata</p>
                    <pre className="text-xs bg-surfaceMuted dark:bg-dark-surfaceMuted p-3 rounded overflow-x-auto">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.user_agent && (
                  <div>
                    <p className="text-xs font-medium text-textSecondary dark:text-dark-textSecondary">User Agent</p>
                    <p className="text-xs mt-1 text-textSecondary dark:text-dark-textSecondary break-all">{selectedLog.user_agent}</p>
                  </div>
                )}
              </div>
              <div className="p-5 border-t border-border dark:border-dark-border flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="rounded-control bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PinGate>
  );
}
