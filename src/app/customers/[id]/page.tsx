'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { authedFetch } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { use, useState } from 'react';

type TenantRow = Record<string, any>;

type PurchaseRow = {
  id: string;
  kg: number;
  amount_naira: number;
  status: string;
  created_at: string;
};

type WalletTxRow = {
  id: string;
  tx_type: string;
  amount_naira: number;
  description?: string | null;
  reference?: string | null;
  created_at: string;
};

type VendRow = {
  id: string;
  purchase_id: string;
  token: string;
  status: string;
  sent_at?: string | null;
  acknowledged_at?: string | null;
  created_at: string;
};

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tenantId } = use(params);
  const qc = useQueryClient();

  const [actionError, setActionError] = useState<string | null>(null);

  const detailsQuery = useQuery({
    queryKey: ['customer_detail', tenantId],
    enabled: !!tenantId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await authedFetch(`/api/admin/customers/${encodeURIComponent(tenantId)}`, { method: 'GET' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load tenant');
      return json as {
        tenant: TenantRow;
        purchases: PurchaseRow[];
        tenantUserId: string | null;
        balance: any | null;
        walletTransactions: WalletTxRow[];
        vends: VendRow[];
      };
    }
  });

  // Admin actions
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [selectedFmId, setSelectedFmId] = useState('');

  const fmsQuery = useQuery({
    queryKey: ['fm_profiles_active'],
    queryFn: async () => {
      const res = await authedFetch('/api/admin/facility-managers', { method: 'GET' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load facility managers');
      return (json?.fms ?? []).filter((fm: any) => fm?.status === 'active');
    },
    enabled: showReassignDialog
  });

  const lockMeterMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/customers/${tenantId}/lock-meter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to lock meter');
      }
      return response.json();
    },
    onSuccess: () => {
      setActionError(null);
      alert('Meter locked successfully');
    },
    onError: (error: any) => {
      setActionError(error.message);
    }
  });

  const unlockMeterMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/customers/${tenantId}/unlock-meter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to unlock meter');
      }
      return response.json();
    },
    onSuccess: () => {
      setActionError(null);
      alert('Meter unlocked successfully');
    },
    onError: (error: any) => {
      setActionError(error.message);
    }
  });

  const reassignMutation = useMutation({
    mutationFn: async (fmId: string) => {
      const response = await fetch(`/api/admin/customers/${tenantId}/reassign-fm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fmId })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reassign tenant');
      }
      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer_detail', tenantId] });
      setShowReassignDialog(false);
      setSelectedFmId('');
      setActionError(null);
      alert('Tenant reassigned successfully');
    },
    onError: (error: any) => {
      setActionError(error.message);
    }
  });

  const tenant = detailsQuery.data?.tenant;
  const tenantUserId: string | null = detailsQuery.data?.tenantUserId ?? null;
  const showSkeleton = detailsQuery.isLoading && !detailsQuery.data;

  return (
    <ProtectedRoute>
      <div className="space-y-4">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Customer / Tenant</h1>
              <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
                Tenant profile, wallet, and purchase history.
              </p>
            </div>
            <Link href="/customers" className="text-sm text-primary hover:underline">
              Back to list
            </Link>
          </div>

          {detailsQuery.error && (
            <p className="text-sm text-red-500 mt-3">
              {detailsQuery.error instanceof Error ? detailsQuery.error.message : 'Failed to load tenant'}
            </p>
          )}

          {showSkeleton && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                'Name',
                'Email',
                'Created at',
                'Customer ID',
                'Account status',
                'Claim status',
                'Claimed by FM',
                'Meter number',
                'Building',
              ].map((label) => (
                <div key={label}>
                  <div className="text-xs text-textSecondary dark:text-dark-textSecondary">{label}</div>
                  <div className="mt-1 h-4 w-40 rounded-control bg-surfaceMuted dark:bg-dark-surfaceMuted" />
                </div>
              ))}
            </div>
          )}

          {tenant && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs text-textSecondary dark:text-dark-textSecondary">Name</div>
                <div className="font-medium">{tenant.full_name ?? tenant.name ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-textSecondary dark:text-dark-textSecondary">Email</div>
                <div className="font-medium">{tenant.email ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-textSecondary dark:text-dark-textSecondary">Created at</div>
                <div className="font-medium">{tenant.created_at ? new Date(tenant.created_at).toLocaleString() : '—'}</div>
              </div>
              <div>
                <div className="text-xs text-textSecondary dark:text-dark-textSecondary">Customer ID</div>
                <div className="font-medium">{tenant.customer_id ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-textSecondary dark:text-dark-textSecondary">Account status</div>
                <div className="font-medium">{tenant.account_status ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-textSecondary dark:text-dark-textSecondary">Claim status</div>
                <div className="font-medium">{tenant.claim_status ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-textSecondary dark:text-dark-textSecondary">Claimed by FM</div>
                <div className="font-medium">{tenant.claimed_by_fm_id ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-textSecondary dark:text-dark-textSecondary">Meter number</div>
                <div className="font-medium">{tenant.meter_number ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-textSecondary dark:text-dark-textSecondary">Building</div>
                <div className="font-medium">{tenant.building_id ?? '—'}</div>
              </div>
            </div>
          )}

          {/* Admin Actions */}
          {tenant && (
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={() => lockMeterMutation.mutate()}
                disabled={lockMeterMutation.isPending}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-control disabled:opacity-50"
              >
                {lockMeterMutation.isPending ? 'Locking...' : 'Lock Meter'}
              </button>
              <button
                onClick={() => unlockMeterMutation.mutate()}
                disabled={unlockMeterMutation.isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-control disabled:opacity-50"
              >
                {unlockMeterMutation.isPending ? 'Unlocking...' : 'Unlock Meter'}
              </button>
              <button
                onClick={() => setShowReassignDialog(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-control"
              >
                Reassign to FM
              </button>
            </div>
          )}

          {actionError && (
            <p className="text-sm text-red-500 mt-3">{actionError}</p>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <h2 className="text-lg font-semibold">Wallet</h2>
            <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-1">Balance and last 20 transactions.</p>

            {showSkeleton && <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-3">Loading wallet...</p>}

            {!showSkeleton && !tenantUserId && (
              <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-3">
                This tenant profile does not expose a <span className="font-medium">user_id</span> field, so wallet ledger cannot be queried.
              </p>
            )}

            {!showSkeleton && tenantUserId && (
              <div className="mt-3">
                <div className="text-sm">
                  <span className="text-textSecondary dark:text-dark-textSecondary">Balance: </span>
                  <span className="font-semibold">{detailsQuery.data?.balance?.balance_naira ?? '0.00'} NGN</span>
                </div>
                {detailsQuery.data?.balance?.last_tx_at && (
                  <div className="text-xs text-textSecondary dark:text-dark-textSecondary">
                    Last tx: {new Date(detailsQuery.data.balance.last_tx_at).toLocaleString()}
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-textSecondary dark:text-dark-textSecondary border-b border-border dark:border-dark-border">
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Reference</th>
                    <th className="py-2 pr-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailsQuery.data?.walletTransactions ?? []).map((tx) => (
                    <tr key={tx.id} className="border-b border-border dark:border-dark-border">
                      <td className="py-2 pr-3 align-top">{tx.tx_type}</td>
                      <td className="py-2 pr-3 align-top">{tx.amount_naira}</td>
                      <td className="py-2 pr-3 align-top">{tx.reference ?? '—'}</td>
                      <td className="py-2 pr-3 align-top">{tx.created_at ? new Date(tx.created_at).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                  {!detailsQuery.isLoading && (detailsQuery.data?.walletTransactions ?? []).length === 0 && (
                    <tr>
                      <td className="py-4 text-sm text-textSecondary dark:text-dark-textSecondary" colSpan={4}>
                        No transactions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-lg font-semibold">Purchases</h2>
            <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-1">Last 20 gas purchases.</p>

            {showSkeleton && <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-3">Loading purchases...</p>}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-textSecondary dark:text-dark-textSecondary border-b border-border dark:border-dark-border">
                    <th className="py-2 pr-3">kg</th>
                    <th className="py-2 pr-3">Amount (NGN)</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailsQuery.data?.purchases ?? []).map((p) => (
                    <tr key={p.id} className="border-b border-border dark:border-dark-border">
                      <td className="py-2 pr-3 align-top">{p.kg}</td>
                      <td className="py-2 pr-3 align-top">{p.amount_naira}</td>
                      <td className="py-2 pr-3 align-top">{p.status}</td>
                      <td className="py-2 pr-3 align-top">{p.created_at ? new Date(p.created_at).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                  {!detailsQuery.isLoading && (detailsQuery.data?.purchases ?? []).length === 0 && (
                    <tr>
                      <td className="py-4 text-sm text-textSecondary dark:text-dark-textSecondary" colSpan={4}>
                        No purchases found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vend History */}
          <div className="card p-5">
            <h2 className="text-lg font-semibold">Vend History</h2>
            <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-1">Last 20 vend tokens.</p>

            {showSkeleton && <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-3">Loading vends...</p>}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-textSecondary dark:text-dark-textSecondary border-b border-border dark:border-dark-border">
                    <th className="py-2 pr-3">Token</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Sent At</th>
                    <th className="py-2 pr-3">Acknowledged At</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailsQuery.data?.vends ?? []).map((v) => (
                    <tr key={v.id} className="border-b border-border dark:border-dark-border">
                      <td className="py-2 pr-3 align-top font-mono text-xs">{v.token}</td>
                      <td className="py-2 pr-3 align-top">{v.status}</td>
                      <td className="py-2 pr-3 align-top">{v.sent_at ? new Date(v.sent_at).toLocaleString() : '—'}</td>
                      <td className="py-2 pr-3 align-top">{v.acknowledged_at ? new Date(v.acknowledged_at).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                  {!detailsQuery.isLoading && (detailsQuery.data?.vends ?? []).length === 0 && (
                    <tr>
                      <td className="py-4 text-sm text-textSecondary dark:text-dark-textSecondary" colSpan={4}>
                        No vends found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Reassign FM Dialog */}
        {showReassignDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowReassignDialog(false)}>
            <div className="card p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-xl font-semibold mb-4">Reassign Tenant to FM</h2>
              {fmsQuery.isLoading ? (
                <div className="text-textSecondary">Loading FMs...</div>
              ) : fmsQuery.error ? (
                <div className="text-red-500 text-sm">Error loading FMs</div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Select Facility Manager</label>
                    <select
                      value={selectedFmId}
                      onChange={(e) => setSelectedFmId(e.target.value)}
                      className="input w-full"
                    >
                      <option value="">-- Select FM --</option>
                      {fmsQuery.data?.map((fm: any) => (
                        <option key={fm.id} value={fm.id}>
                          {fm.full_name} ({fm.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowReassignDialog(false)}
                      className="px-4 py-2 bg-surfaceMuted hover:bg-surfaceHover rounded-control"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => reassignMutation.mutate(selectedFmId)}
                      disabled={!selectedFmId || reassignMutation.isPending}
                      className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-control disabled:opacity-50"
                    >
                      {reassignMutation.isPending ? 'Reassigning...' : 'Reassign'}
                    </button>
                  </div>
                  {actionError && (
                    <div className="mt-2 text-red-500 text-sm">{actionError}</div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
