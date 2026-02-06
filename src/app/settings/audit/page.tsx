'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabaseClient';
import { PinGate } from '@/components/PinGate';

interface AuditLog {
  id: string;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: unknown;
  new_value: unknown;
  metadata: unknown;
  ip_address: string | null;
  created_at: string;
}

const PAGE_SIZE = 100;

const CRITICAL_ACTIONS = new Set([
  'deleted_admin',
  'updated_admin_role',
  'set_admin_pin',
  'locked_meter',
  'unlocked_meter',
  'updated_tariff',
  'vended_gas',
]);

export default function AuditLogsPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [actionFilter, setActionFilter] = useState('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState('all');
  const [adminEmailFilter, setAdminEmailFilter] = useState('all');
  const [dateRange, setDateRange] = useState(7);
  const [page, setPage] = useState(0);
  const supabase = createClient();

  const startDateIso = useMemo(() => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRange);
    return startDate.toISOString();
  }, [dateRange]);

  const endDateIso = useMemo(() => new Date().toISOString(), []);

  const { data: facets } = useQuery<{ entityTypes: string[]; adminEmails: string[] }>({
    queryKey: ['audit-log-facets', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('entity_type,user_email,created_at')
        .gte('created_at', startDateIso)
        .order('created_at', { ascending: false })
        .limit(2000);

      if (error) throw error;

      const entityTypes = new Set<string>();
      const adminEmails = new Set<string>();

      for (const row of (data ?? []) as any[]) {
        if (typeof row?.entity_type === 'string' && row.entity_type) entityTypes.add(row.entity_type);
        if (typeof row?.user_email === 'string' && row.user_email) adminEmails.add(row.user_email);
      }

      return {
        entityTypes: Array.from(entityTypes).sort((a, b) => a.localeCompare(b)),
        adminEmails: Array.from(adminEmails).sort((a, b) => a.localeCompare(b)),
      };
    },
    enabled: unlocked,
  });

  // Fetch audit logs (paged)
  const { data: logsPage, isFetching, refetch } = useQuery<{ rows: AuditLog[]; total: number }>({
    queryKey: ['audit-logs', actionFilter, entityTypeFilter, adminEmailFilter, dateRange, page],
    queryFn: async () => {
      let query = supabase
        .from('admin_audit_log')
        .select(
          'id,user_email,action,entity_type,entity_id,old_value,new_value,metadata,ip_address,created_at',
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .gte('created_at', startDateIso);

      if (actionFilter !== 'all') query = query.eq('action', actionFilter);
      if (entityTypeFilter !== 'all') query = query.eq('entity_type', entityTypeFilter);
      if (adminEmailFilter !== 'all') query = query.eq('user_email', adminEmailFilter);

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await query.range(from, to);
      if (error) throw error;

      return {
        rows: (data ?? []) as AuditLog[],
        total: count ?? 0,
      };
    },
    enabled: unlocked,
    refetchInterval: unlocked ? 5000 : false,
  });

  const logs = logsPage?.rows ?? [];
  const total = logsPage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPageDisplay = Math.min(totalPages, page + 1);

  const { data: activity } = useQuery<{
    totalActions: number;
    uniqueAdmins: number;
    criticalActions: number;
    actionsToday: number;
    topAdmins: Array<{ email: string; count: number }>;
    recentCritical: Array<{ id: string; created_at: string; user_email: string; action: string; entity_type: string; entity_id: string | null }>;
  }>({
    queryKey: ['audit-activity', dateRange, actionFilter, entityTypeFilter, adminEmailFilter],
    queryFn: async () => {
      let query = supabase
        .from('admin_audit_log')
        .select('id,user_email,action,entity_type,entity_id,created_at')
        .gte('created_at', startDateIso)
        .order('created_at', { ascending: false })
        .limit(2000);

      if (actionFilter !== 'all') query = query.eq('action', actionFilter);
      if (entityTypeFilter !== 'all') query = query.eq('entity_type', entityTypeFilter);
      if (adminEmailFilter !== 'all') query = query.eq('user_email', adminEmailFilter);

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as any[];
      const adminCounts = new Map<string, number>();

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfTodayIso = startOfToday.toISOString();

      let criticalActions = 0;
      let actionsToday = 0;
      const recentCritical: Array<{ id: string; created_at: string; user_email: string; action: string; entity_type: string; entity_id: string | null }> = [];

      for (const row of rows) {
        const email = typeof row?.user_email === 'string' && row.user_email ? row.user_email : 'Unknown';
        adminCounts.set(email, (adminCounts.get(email) ?? 0) + 1);

        if (typeof row?.created_at === 'string' && row.created_at >= startOfTodayIso) actionsToday += 1;

        if (typeof row?.action === 'string' && CRITICAL_ACTIONS.has(row.action)) {
          criticalActions += 1;
          if (recentCritical.length < 10) {
            recentCritical.push({
              id: String(row.id),
              created_at: String(row.created_at),
              user_email: email,
              action: String(row.action),
              entity_type: String(row.entity_type ?? ''),
              entity_id: row.entity_id ? String(row.entity_id) : null,
            });
          }
        }
      }

      const topAdmins = Array.from(adminCounts.entries())
        .map(([email, count]) => ({ email, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalActions: rows.length,
        uniqueAdmins: adminCounts.size,
        criticalActions,
        actionsToday,
        topAdmins,
        recentCritical,
      };
    },
    enabled: unlocked,
    refetchInterval: unlocked ? 5000 : false,
  });

  const bumpPage = (nextPage: number) => setPage(Math.max(0, Math.min(totalPages - 1, nextPage)));

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      params.set('days', String(dateRange));
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (entityTypeFilter !== 'all') params.set('entity_type', entityTypeFilter);
      if (adminEmailFilter !== 'all') params.set('admin_email', adminEmailFilter);

      const res = await fetch(`/api/admin/audit/export?${params.toString()}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error: any) {
      alert(`Export failed: ${error.message}`);
    }
  };

  return (
    <PinGate isUnlocked={unlocked} onUnlock={() => setUnlocked(true)}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Audit Logs</h1>
            <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
              Track all admin actions and system changes
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              className="rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-4 py-2 text-sm font-semibold hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted"
              type="button"
            >
              Refresh
            </button>
            <button
              onClick={handleExport}
              className="rounded-control bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
              type="button"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* System Activity Dashboard (Phase 13C.3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-1 space-y-4">
          <div className="text-sm font-semibold">Activity Summary</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-textSecondary dark:text-dark-textSecondary">Total actions</div>
              <div className="text-lg font-semibold">{activity?.totalActions ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-textSecondary dark:text-dark-textSecondary">Unique admins</div>
              <div className="text-lg font-semibold">{activity?.uniqueAdmins ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-textSecondary dark:text-dark-textSecondary">Critical actions</div>
              <div className="text-lg font-semibold">{activity?.criticalActions ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-textSecondary dark:text-dark-textSecondary">Actions today</div>
              <div className="text-lg font-semibold">{activity?.actionsToday ?? '—'}</div>
            </div>
          </div>
          <div className="text-[11px] text-textSecondary dark:text-dark-textSecondary">
            Window: last {dateRange} day{dateRange === 1 ? '' : 's'}
          </div>
        </div>

        <div className="card p-5 lg:col-span-1">
          <div className="text-sm font-semibold mb-3">Top Active Admins</div>
          <div className="space-y-2">
            {(activity?.topAdmins ?? []).map((a) => (
              <div key={a.email} className="flex items-center justify-between text-sm">
                <div className="truncate">{a.email}</div>
                <div className="text-textSecondary dark:text-dark-textSecondary">{a.count}</div>
              </div>
            ))}
            {(activity?.topAdmins?.length ?? 0) === 0 && (
              <div className="text-sm text-textSecondary dark:text-dark-textSecondary">No data</div>
            )}
          </div>
        </div>

        <div className="card p-5 lg:col-span-1">
          <div className="text-sm font-semibold mb-3">Recent Critical Actions</div>
          <div className="space-y-2">
            {(activity?.recentCritical ?? []).map((item) => (
              <div key={item.id} className="text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="truncate font-medium">{item.action}</div>
                  <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
                    {new Date(item.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-xs text-textSecondary dark:text-dark-textSecondary truncate">
                  {item.user_email} · {item.entity_type}
                </div>
              </div>
            ))}
            {(activity?.recentCritical?.length ?? 0) === 0 && (
              <div className="text-sm text-textSecondary dark:text-dark-textSecondary">No critical actions</div>
            )}
          </div>
        </div>
        </div>

        {/* Filters */}
        <div className="card p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium">Action Type</label>
          <select
            className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All Actions</option>
            <option value="created_admin">Created Admin</option>
            <option value="updated_admin_role">Updated Admin Role</option>
            <option value="deleted_admin">Deleted Admin</option>
            <option value="set_admin_pin">Set Admin PIN</option>
            <option value="locked_meter">Locked Meter</option>
            <option value="unlocked_meter">Unlocked Meter</option>
            <option value="vended_gas">Vended Gas</option>
            <option value="updated_tariff">Updated Tariff</option>
            <option value="updated_preferences">Updated Preferences</option>
            <option value="updated_appearance">Updated Appearance</option>
          </select>
        </div>

        <div className="flex-1">
          <label className="text-sm font-medium">Entity Type</label>
          <select
            className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
            value={entityTypeFilter}
            onChange={(e) => {
              setEntityTypeFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All Entities</option>
            {(facets?.entityTypes ?? []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="text-sm font-medium">Admin</label>
          <select
            className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
            value={adminEmailFilter}
            onChange={(e) => {
              setAdminEmailFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All Admins</option>
            {(facets?.adminEmails ?? []).map((email) => (
              <option key={email} value={email}>
                {email}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="text-sm font-medium">Date Range</label>
          <select
            className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
            value={dateRange}
            onChange={(e) => {
              setDateRange(Number(e.target.value));
              setPage(0);
            }}
          >
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
        </div>

        {/* Audit Logs Table */}
        <div className="card p-6 overflow-x-auto">
        <div className="flex items-center justify-between pb-4">
          <div className="text-sm text-textSecondary dark:text-dark-textSecondary">
            Showing {(total === 0 ? 0 : page * PAGE_SIZE + 1).toLocaleString()}–
            {Math.min((page + 1) * PAGE_SIZE, total).toLocaleString()} of {total.toLocaleString()}
          </div>
          <div className="flex items-center gap-2">
              <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
                {unlocked ? 'Live (5s)' : 'Locked'}
              </div>
            <button
              type="button"
              onClick={() => bumpPage(page - 1)}
              disabled={page <= 0}
              className="rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Prev
            </button>
            <div className="text-sm text-textSecondary dark:text-dark-textSecondary">
              Page {currentPageDisplay} / {totalPages}
            </div>
            <button
              type="button"
              onClick={() => bumpPage(page + 1)}
              disabled={page >= totalPages - 1}
              className="rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border dark:border-dark-border">
              <th className="text-left py-3 px-2 font-semibold">Timestamp</th>
              <th className="text-left py-3 px-2 font-semibold">Admin</th>
              <th className="text-left py-3 px-2 font-semibold">Action</th>
              <th className="text-left py-3 px-2 font-semibold">Entity</th>
              <th className="text-left py-3 px-2 font-semibold">Changes</th>
              <th className="text-left py-3 px-2 font-semibold">IP Address</th>
            </tr>
          </thead>
          <tbody>
            {logs?.map((log) => (
              <tr key={log.id} className="border-b border-border/50 dark:border-dark-border/50">
                <td className="py-3 px-2">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="py-3 px-2">{log.user_email}</td>
                <td className="py-3 px-2">
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100">
                    {log.action}
                  </span>
                </td>
                <td className="py-3 px-2">
                  <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
                    {log.entity_type}
                  </div>
                  <div className="font-mono text-xs">
                    {log.entity_id ? `${log.entity_id.slice(0, 8)}...` : 'N/A'}
                  </div>
                </td>
                <td className="py-3 px-2 max-w-md">
                  {log.old_value != null && (
                    <div className="text-xs">
                      <span className="text-red-600 dark:text-red-400">Old:</span>{' '}
                      {JSON.stringify(log.old_value).slice(0, 50)}
                    </div>
                  )}
                  {log.new_value != null && (
                    <div className="text-xs">
                      <span className="text-green-600 dark:text-green-400">New:</span>{' '}
                      {JSON.stringify(log.new_value).slice(0, 50)}
                    </div>
                  )}
                </td>
                <td className="py-3 px-2 font-mono text-xs">{log.ip_address || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {isFetching && (
          <div className="text-center py-6 text-textSecondary dark:text-dark-textSecondary">
            Loading…
          </div>
        )}

        {logs?.length === 0 && (
          <div className="text-center py-12 text-textSecondary dark:text-dark-textSecondary">
            No audit logs found for the selected filters
          </div>
        )}
        </div>
      </div>
    </PinGate>
  );
}
