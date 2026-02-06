'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PinGate } from '@/components/PinGate';
import { createClient } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

type Ticket = {
  id: string;
  ticket_id: string;
  status: string;
  priority: string;
  subject: string;
  description: string;
  tenant_id: string;
  fm_id: string | null;
  building_id: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  escalated_at: string | null;
  escalation_reason: string | null;
  resolution: string | null;
  tenant: {
    full_name: string;
    customer_id: string;
  } | null;
  fm: {
    full_name: string;
    phone: string;
  } | null;
  building: {
    address: string;
  } | null;
};

type Message = {
  id: string;
  sender_type: string;
  message: string;
  is_internal: boolean;
  created_at: string;
  tenant?: {
    full_name: string;
  };
  fm?: {
    full_name: string;
  };
};

type FmProfile = {
  id: string;
  full_name: string;
  phone: string;
};

export default function TicketDetailPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [selectedFmId, setSelectedFmId] = useState('');
  const [resolution, setResolution] = useState('');

  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;

  const supabase = createClient();
  const queryClient = useQueryClient();

  // Fetch ticket details
  const { data: ticket, isLoading: ticketLoading } = useQuery({
    queryKey: ['support-ticket', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          tenant:tenant_profiles!tenant_id(full_name, customer_id),
          fm:fm_profiles!fm_id(full_name, phone),
          building:buildings!building_id(address)
        `)
        .eq('id', ticketId)
        .single();
      if (error) throw error;
      return data as Ticket;
    },
    enabled: unlocked,
  });

  // Fetch messages
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['support-messages', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_ticket_messages')
        .select(`
          *,
          tenant:tenant_profiles!tenant_id(full_name),
          fm:fm_profiles!fm_id(full_name:name)
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
    enabled: unlocked,
  });

  // Fetch FMs for reassignment
  const { data: fms = [] } = useQuery<FmProfile[]>({
    queryKey: ['fms-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fm_profiles')
        .select('id, full_name:name, phone')
        .eq('account_status', 'active')
        .order('name');
      if (error) throw error;
      return (data ?? []) as FmProfile[];
    },
    enabled: unlocked && showReassignDialog,
  });

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: async (payload: { message: string; isInternal: boolean }) => {
      const res = await fetch(`/api/admin/support/${ticketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to send reply');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-messages', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['support-ticket', ticketId] });
      setReplyText('');
      setIsInternal(false);
    },
  });

  // Escalate mutation
  const escalateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/support/${ticketId}/escalate`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to escalate');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-ticket', ticketId] });
      alert('Ticket escalated');
    },
  });

  // Close mutation
  const closeMutation = useMutation({
    mutationFn: async (resolutionText: string) => {
      const res = await fetch(`/api/admin/support/${ticketId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution: resolutionText }),
      });
      if (!res.ok) throw new Error('Failed to close ticket');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-ticket', ticketId] });
      alert('Ticket closed');
      router.push('/support');
    },
  });

  // Reassign mutation
  const reassignMutation = useMutation({
    mutationFn: async (fmId: string) => {
      const res = await fetch(`/api/admin/support/${ticketId}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fmId }),
      });
      if (!res.ok) throw new Error('Failed to reassign');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-ticket', ticketId] });
      setShowReassignDialog(false);
      setSelectedFmId('');
      alert('Ticket reassigned');
    },
  });

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
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Link
                  href="/support"
                  className="text-sm text-textSecondary dark:text-dark-textSecondary hover:text-text dark:hover:text-dark-text"
                >
                  ← Back to Support
                </Link>
              </div>
              {ticket && (
                <h1 className="text-2xl font-bold mt-2">{ticket.ticket_id}</h1>
              )}
            </div>
          </div>

          {ticketLoading ? (
            <div className="card p-6 text-center text-textSecondary dark:text-dark-textSecondary">
              Loading ticket...
            </div>
          ) : !ticket ? (
            <div className="card p-6 text-center text-textSecondary dark:text-dark-textSecondary">
              Ticket not found
            </div>
          ) : (
            <>
              {/* Ticket Info */}
              <div className="card p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <h2 className="text-xl font-semibold">{ticket.subject}</h2>
                    <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
                      {ticket.description}
                    </p>
                  </div>
                  <span
                    className={`inline-block px-3 py-1 rounded text-sm font-medium ${getStatusColor(
                      ticket.status
                    )}`}
                  >
                    {ticket.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border dark:border-dark-border">
                  <div>
                    <p className="text-xs text-textSecondary dark:text-dark-textSecondary">Customer</p>
                    <p className="text-sm font-medium">
                      {ticket.tenant ? ticket.tenant.full_name : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-textSecondary dark:text-dark-textSecondary">FM Handling</p>
                    <p className="text-sm font-medium">
                      {ticket.fm ? ticket.fm.full_name : '(Unassigned)'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-textSecondary dark:text-dark-textSecondary">Priority</p>
                    <p className="text-sm font-medium capitalize">{ticket.priority}</p>
                  </div>
                  <div>
                    <p className="text-xs text-textSecondary dark:text-dark-textSecondary">Created</p>
                    <p className="text-sm font-medium">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Admin Actions */}
                {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
                  <div className="flex gap-3 pt-4 border-t border-border dark:border-dark-border">
                    <button
                      onClick={() => setShowReassignDialog(true)}
                      className="rounded-control border border-border dark:border-dark-border px-4 py-2 text-sm hover:bg-surface dark:hover:bg-dark-surface"
                    >
                      Reassign FM
                    </button>
                    <button
                      onClick={() => escalateMutation.mutate()}
                      disabled={escalateMutation.isPending || ticket.status === 'escalated'}
                      className="rounded-control border border-border dark:border-dark-border px-4 py-2 text-sm hover:bg-surface dark:hover:bg-dark-surface disabled:opacity-50"
                    >
                      {ticket.status === 'escalated' ? 'Already Escalated' : 'Escalate'}
                    </button>
                    <button
                      onClick={() => {
                        const res = prompt('Enter resolution notes:');
                        if (res) closeMutation.mutate(res);
                      }}
                      disabled={closeMutation.isPending}
                      className="rounded-control bg-primary text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
                    >
                      Close Ticket
                    </button>
                  </div>
                )}
              </div>

              {/* Conversation History */}
              <div className="card p-6 space-y-4">
                <h3 className="text-lg font-semibold">Conversation</h3>
                {messagesLoading ? (
                  <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
                    Loading messages...
                  </p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
                    No messages yet
                  </p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-control border ${
                          msg.is_internal
                            ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800'
                            : 'bg-surface dark:bg-dark-surface border-border dark:border-dark-border'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">
                              {msg.sender_type === 'tenant' && msg.tenant
                                ? msg.tenant.full_name
                                : msg.sender_type === 'fm' && msg.fm
                                ? msg.fm.full_name
                                : msg.sender_type === 'admin'
                                ? 'Admin'
                                : 'System'}
                            </span>
                            <span className="text-xs text-textSecondary dark:text-dark-textSecondary">
                              ({msg.sender_type})
                            </span>
                            {msg.is_internal && (
                              <span className="text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-200 px-2 py-0.5 rounded">
                                Internal
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-textSecondary dark:text-dark-textSecondary">
                            {new Date(msg.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Form */}
                {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
                  <div className="pt-4 border-t border-border dark:border-dark-border space-y-3">
                    <textarea
                      rows={3}
                      placeholder="Type your reply..."
                      className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={isInternal}
                          onChange={(e) => setIsInternal(e.target.checked)}
                          className="rounded"
                        />
                        Internal note (staff only)
                      </label>
                      <button
                        onClick={() => replyMutation.mutate({ message: replyText, isInternal })}
                        disabled={replyMutation.isPending || !replyText.trim()}
                        className="rounded-control bg-primary text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
                      >
                        {replyMutation.isPending ? 'Sending...' : 'Send Reply'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Reassign Dialog */}
          {showReassignDialog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="card p-6 max-w-md w-full m-4 space-y-4">
                <h3 className="text-lg font-semibold">Reassign Ticket</h3>
                <div>
                  <label className="text-sm font-medium">Select FM</label>
                  <select
                    className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
                    value={selectedFmId}
                    onChange={(e) => setSelectedFmId(e.target.value)}
                  >
                    <option value="">-- Select FM --</option>
                    {fms.map((fm: FmProfile) => (
                      <option key={fm.id} value={fm.id}>
                        {fm.full_name} ({fm.phone})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowReassignDialog(false);
                      setSelectedFmId('');
                    }}
                    className="flex-1 rounded-control border border-border dark:border-dark-border px-4 py-2 text-sm hover:bg-surface dark:hover:bg-dark-surface"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (selectedFmId) reassignMutation.mutate(selectedFmId);
                    }}
                    disabled={!selectedFmId || reassignMutation.isPending}
                    className="flex-1 rounded-control bg-primary text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
                  >
                    {reassignMutation.isPending ? 'Reassigning...' : 'Reassign'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </PinGate>
    </ProtectedRoute>
  );
}
