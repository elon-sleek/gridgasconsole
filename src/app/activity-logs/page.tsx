'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

import { getSupabaseClient } from '@/lib/supabaseClient';
import { IconList } from '@/components/AppIcons';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PinGate } from '@/components/PinGate';

type ActivityLogRow = {
  id: string;
  user_id: string | null;
  user_role: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string | null;
  metadata: unknown;
  ip_address: string | null;
  created_at: string;
  fm_id: string | null;
  building_id: string | null;
};

export default function ActivityLogsPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [dateRange, setDateRange] = useState('7d');
  const [roleFilter, setRoleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');

  const supabase = getSupabaseClient();

  const { data: logs, isLoading, error } = useQuery({
    queryKey: ['activity_logs', dateRange, roleFilter, actionFilter, entityTypeFilter],
    queryFn: async () => {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (dateRange !== 'all') {
        const days = parseInt(dateRange.replace('d', ''), 10);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        query = query.gte('created_at', cutoff.toISOString());
      }

      if (roleFilter) {
        query = query.eq('user_role', roleFilter);
      }

      if (actionFilter) {
        query = query.ilike('action', `%${actionFilter}%`);
      }

      if (entityTypeFilter) {
        query = query.eq('entity_type', entityTypeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ActivityLogRow[];
    },
  });

  return (
    <ProtectedRoute>
      <PinGate isUnlocked={unlocked} onUnlock={() => setUnlocked(true)}>
        <div className="space-y-4">
        <div className="card p-5">
          <div>
            <p className="text-sm text-textSecondary dark:text-dark-textSecondary">Operations</p>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <IconList className="w-6 h-6 text-primary" />
              Activity Logs
            </h1>
            <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-1">
              App/system events (tenant/FM/system) history. Use the filters below to narrow down specific actions.
            </p>
          </div>
        </div>

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
              <label className="text-xs font-medium mb-1 block">Role</label>
              <select
                className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="">All Roles</option>
                <option value="tenant">tenant</option>
                <option value="fm">fm</option>
                <option value="system">system</option>
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
              <input
                type="text"
                className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm"
                placeholder="e.g. support_ticket, meter, tenant_profile"
                value={entityTypeFilter}
                onChange={(e) => setEntityTypeFilter(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border dark:border-dark-border">
                <tr className="text-left text-xs font-medium text-textSecondary dark:text-dark-textSecondary">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">FM / Building</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-dark-border">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-textSecondary dark:text-dark-textSecondary"
                    >
                      Loading activity logs...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-red-600 dark:text-red-400"
                    >
                      Failed to load activity logs.
                    </td>
                  </tr>
                ) : logs && logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted">
                      <td className="px-4 py-3 text-sm">
                        <div>{new Date(log.created_at).toLocaleString()}</div>
                        <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{log.user_role}</td>
                      <td className="px-4 py-3 text-sm">{log.action}</td>
                      <td className="px-4 py-3 text-sm">
                        <div>{log.entity_type}</div>
                        {log.entity_id && (
                          <div className="text-xs text-textSecondary dark:text-dark-textSecondary font-mono">
                            {log.entity_id.substring(0, 8)}...
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm max-w-[420px] truncate">{log.description ?? '—'}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="text-xs text-textSecondary dark:text-dark-textSecondary font-mono">
                          FM: {log.fm_id ? `${log.fm_id.substring(0, 8)}...` : '—'}
                        </div>
                        <div className="text-xs text-textSecondary dark:text-dark-textSecondary font-mono">
                          BLD: {log.building_id ? `${log.building_id.substring(0, 8)}...` : '—'}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-textSecondary dark:text-dark-textSecondary"
                    >
                      No activity logs found for current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </PinGate>
    </ProtectedRoute>
  );
}
