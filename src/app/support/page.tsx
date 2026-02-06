'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PinGate } from '@/components/PinGate';
import { createClient } from '@/lib/supabaseClient';
import Link from 'next/link';
import { IconSupport } from '@/components/AppIcons';
import { useRealtimeInvalidation } from '@/lib/useRealtimeInvalidation';

type Ticket = {
  id: string;
  ticket_id: string;
  status: string;
  priority: string;
  subject: string;
  tenant_id: string;
  fm_id: string | null;
  created_at: string;
  updated_at?: string | null;
  closed_at?: string | null;
  resolution?: string | null;
  tenant: {
    full_name: string;
    customer_id: string;
  } | null;
  fm: {
    full_name: string;
    phone?: string | null;
  } | null;
};

type TenantJoin = {
  full_name: string;
  customer_id: string;
};

type FmJoin = {
  full_name: string;
  phone?: string | null;
};

const OVERDUE_AFTER_DAYS = 3;

function ageInDays(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return 0;
  const now = Date.now();
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
}

function isOverdue(ticket: Ticket): boolean {
  const active = ticket.status === 'open' || ticket.status === 'in_progress';
  return active && ageInDays(ticket.created_at) >= OVERDUE_AFTER_DAYS;
}

function normalizeJoin<T>(value: unknown): T | null {
  if (Array.isArray(value)) {
    return (value[0] as T | undefined) ?? null;
  }
  return (value as T | null) ?? null;
}

export default function SupportPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');

  const supabase = createClient();

  useRealtimeInvalidation(
    [{ table: 'support_tickets', invalidate: [['support-tickets-open'], ['support-tickets-closed'], ['vw_admin_kpis']] }],
    unlocked
  );

  // Fetch open tickets
  const { data: openTickets = [], isLoading: openLoading } = useQuery({
    queryKey: ['support-tickets-open'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          id,
          ticket_id,
          status,
          priority,
          subject,
          tenant_id,
          fm_id,
          created_at,
          updated_at,
          tenant:tenant_profiles!tenant_id(full_name, customer_id),
          fm:fm_profiles!fm_id(full_name:name, phone)
        `)
        .in('status', ['open', 'in_progress', 'escalated'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        return {
          id: String(r.id ?? ''),
          ticket_id: String(r.ticket_id ?? ''),
          status: String(r.status ?? ''),
          priority: String(r.priority ?? ''),
          subject: String(r.subject ?? ''),
          tenant_id: String(r.tenant_id ?? ''),
          fm_id: r.fm_id ? String(r.fm_id) : null,
          created_at: String(r.created_at ?? ''),
          updated_at: r.updated_at ? String(r.updated_at) : null,
          closed_at: r.closed_at ? String(r.closed_at) : null,
          resolution: r.resolution ? String(r.resolution) : null,
          tenant: normalizeJoin<TenantJoin>(r.tenant),
          fm: normalizeJoin<FmJoin>(r.fm),
        } satisfies Ticket;
      });
    },
    enabled: unlocked,
  });

  // Fetch closed tickets
  const { data: closedTickets = [], isLoading: closedLoading } = useQuery({
    queryKey: ['support-tickets-closed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          id,
          ticket_id,
          status,
          priority,
          subject,
          tenant_id,
          fm_id,
          created_at,
          updated_at,
          closed_at,
          resolution,
          tenant:tenant_profiles!tenant_id(full_name, customer_id),
          fm:fm_profiles!fm_id(full_name:name, phone)
        `)
        .in('status', ['closed', 'resolved'])
        .order('closed_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        return {
          id: String(r.id ?? ''),
          ticket_id: String(r.ticket_id ?? ''),
          status: String(r.status ?? ''),
          priority: String(r.priority ?? ''),
          subject: String(r.subject ?? ''),
          tenant_id: String(r.tenant_id ?? ''),
          fm_id: r.fm_id ? String(r.fm_id) : null,
          created_at: String(r.created_at ?? ''),
          updated_at: r.updated_at ? String(r.updated_at) : null,
          closed_at: r.closed_at ? String(r.closed_at) : null,
          resolution: r.resolution ? String(r.resolution) : null,
          tenant: normalizeJoin<TenantJoin>(r.tenant),
          fm: normalizeJoin<FmJoin>(r.fm),
        } satisfies Ticket;
      });
    },
    enabled: unlocked && activeTab === 'closed',
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'in_progress':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'escalated':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'resolved':
      case 'closed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  return (
    <ProtectedRoute>
      <PinGate isUnlocked={unlocked} onUnlock={() => setUnlocked(true)}>
        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold">Support Center</h1>
                <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
                  View and manage support tickets from customers and facility managers
                </p>
              </div>
              <IconSupport className="h-7 w-7 text-primary" />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-border dark:border-dark-border">
            <button
              onClick={() => setActiveTab('open')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'open'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-textSecondary dark:text-dark-textSecondary hover:text-text dark:hover:text-dark-text'
              }`}
            >
              Open Tickets ({openTickets.length})
            </button>
            <button
              onClick={() => setActiveTab('closed')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'closed'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-textSecondary dark:text-dark-textSecondary hover:text-text dark:hover:text-dark-text'
              }`}
            >
              Closed Tickets
            </button>
          </div>

          {/* Open Tickets */}
          {activeTab === 'open' && (
            <div className="card overflow-hidden">
              {openLoading ? (
                <div className="p-6 text-center text-textSecondary dark:text-dark-textSecondary">
                  Loading tickets...
                </div>
              ) : openTickets.length === 0 ? (
                <div className="p-6 text-center text-textSecondary dark:text-dark-textSecondary">
                  No open tickets
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface dark:bg-dark-surface border-b border-border dark:border-dark-border">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Ticket ID</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Subject</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Customer</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">FM Handling</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Priority</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openTickets.map((ticket) => (
                        (() => {
                          const overdue = isOverdue(ticket);
                          const ticketAgeDays = ageInDays(ticket.created_at);
                          return (
                        <tr
                          key={ticket.id}
                          className={`border-b border-border dark:border-dark-border hover:bg-surface dark:hover:bg-dark-surface ${
                            overdue ? 'bg-red-50 dark:bg-red-900/10' : ''
                          }`}
                        >
                          <td className="px-4 py-3 text-sm">
                            <Link
                              href={`/support/${ticket.id}`}
                              className="font-mono text-primary hover:underline"
                            >
                              {ticket.ticket_id}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">{ticket.subject}</td>
                          <td className="px-4 py-3 text-sm">
                            {ticket.tenant ? (
                              <div>
                                <div>{ticket.tenant.full_name}</div>
                                <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
                                  {ticket.tenant.customer_id}
                                </div>
                              </div>
                            ) : (
                              <span className="text-textSecondary dark:text-dark-textSecondary">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {ticket.fm ? (
                              <div>
                                <div>{ticket.fm.full_name}</div>
                                {ticket.fm.phone ? (
                                  <a
                                    href={`tel:${ticket.fm.phone}`}
                                    className="text-xs text-primary hover:underline"
                                  >
                                    Call
                                  </a>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-textSecondary dark:text-dark-textSecondary">
                                (Unassigned)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                                  ticket.status
                                )}`}
                              >
                                {ticket.status.replace('_', ' ')}
                              </span>
                              {overdue ? (
                                <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                  Overdue
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-medium ${getPriorityColor(
                                ticket.priority
                              )}`}
                            >
                              {ticket.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-textSecondary dark:text-dark-textSecondary">
                            <div>{new Date(ticket.created_at).toLocaleDateString()}</div>
                            <div className="text-xs">{ticketAgeDays}d old</div>
                          </td>
                        </tr>
                          );
                        })()
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Closed Tickets */}
          {activeTab === 'closed' && (
            <div className="card overflow-hidden">
              {closedLoading ? (
                <div className="p-6 text-center text-textSecondary dark:text-dark-textSecondary">
                  Loading tickets...
                </div>
              ) : closedTickets.length === 0 ? (
                <div className="p-6 text-center text-textSecondary dark:text-dark-textSecondary">
                  No closed tickets
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface dark:bg-dark-surface border-b border-border dark:border-dark-border">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Ticket ID</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Subject</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Customer</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">FM</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Closed Date</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Resolution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closedTickets.map((ticket) => (
                        <tr
                          key={ticket.id}
                          className="border-b border-border dark:border-dark-border hover:bg-surface dark:hover:bg-dark-surface"
                        >
                          <td className="px-4 py-3 text-sm">
                            <Link
                              href={`/support/${ticket.id}`}
                              className="font-mono text-primary hover:underline"
                            >
                              {ticket.ticket_id}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">{ticket.subject}</td>
                          <td className="px-4 py-3 text-sm">
                            {ticket.tenant ? (
                              ticket.tenant.full_name
                            ) : (
                              <span className="text-textSecondary dark:text-dark-textSecondary">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {ticket.fm ? (
                              ticket.fm.full_name
                            ) : (
                              <span className="text-textSecondary dark:text-dark-textSecondary">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-textSecondary dark:text-dark-textSecondary">
                            {ticket.closed_at
                              ? new Date(ticket.closed_at).toLocaleDateString()
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {ticket.resolution ? (
                              <span className="text-xs">{ticket.resolution.substring(0, 50)}...</span>
                            ) : (
                              <span className="text-textSecondary dark:text-dark-textSecondary">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </PinGate>
    </ProtectedRoute>
  );
}

