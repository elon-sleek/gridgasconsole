'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PinGate } from '@/components/PinGate';
import { createClient } from '@/lib/supabaseClient';
import Link from 'next/link';
import { IconVend } from '@/components/AppIcons';

type Meter = {
  id: string;
  meter_number: string;
  status: string;
  tenant_id: string | null;
  building_id: string | null;
  tenant?: {
    full_name: string;
    customer_id: string;
  };
  building?: {
    address: string;
  };
};

type VendHistory = {
  id: string;
  purchase_id: string;
  kg: number;
  amount_naira: number;
  vend_token: string | null;
  status: string;
  sent_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
};

export default function VendPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [selectedMeter, setSelectedMeter] = useState<Meter | null>(null);
  const [showVendDialog, setShowVendDialog] = useState(false);
  const [vendForm, setVendForm] = useState({ amountNaira: '', note: '' });
  const [searchQuery, setSearchQuery] = useState('');

  const supabase = createClient();
  const queryClient = useQueryClient();

  // Fetch all meters with tenant and building info
  const { data: meters = [], isLoading: metersLoading } = useQuery({
    queryKey: ['admin-meters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meters')
        .select(`
          id,
          meter_number,
          status,
          tenant_id,
          building_id,
          tenant:tenant_profiles!tenant_id(full_name, customer_id),
          building:buildings!building_id(address)
        `)
        .order('meter_number');
      if (error) throw error;
      return (data as unknown) as Meter[];
    },
    enabled: unlocked,
  });

  // Fetch vend history for selected meter
  const { data: vendHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ['meter-vend-history', selectedMeter?.id],
    queryFn: async () => {
      if (!selectedMeter?.id) return [];
      const { data, error } = await supabase
        .from('meter_vends')
        .select(`
          id,
          purchase_id,
          vend_token,
          status,
          sent_at,
          acknowledged_at,
          created_at,
          purchase:gas_purchases!purchase_id(kg, amount_naira)
        `)
        .eq('meter_id', selectedMeter.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []).map((v: any) => ({
        id: v.id,
        purchase_id: v.purchase_id,
        kg: v.purchase?.kg || 0,
        amount_naira: v.purchase?.amount_naira || 0,
        vend_token: v.vend_token,
        status: v.status,
        sent_at: v.sent_at,
        acknowledged_at: v.acknowledged_at,
        created_at: v.created_at,
      }));
    },
    enabled: unlocked && !!selectedMeter,
  });

  // Manual vend mutation
  const vendMutation = useMutation({
    mutationFn: async (payload: { meterId: string; amountNaira: number; note: string }) => {
      const res = await fetch('/api/admin/vend/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Vend failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meter-vend-history', selectedMeter?.id] });
      setShowVendDialog(false);
      setVendForm({ amountNaira: '', note: '' });
      alert('Vend initiated successfully!');
    },
    onError: (err: Error) => {
      alert(`Vend failed: ${err.message}`);
    },
  });

  const handleVend = () => {
    if (!selectedMeter) return;
    const amount = parseFloat(vendForm.amountNaira);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    vendMutation.mutate({
      meterId: selectedMeter.id,
      amountNaira: amount,
      note: vendForm.note,
    });
  };

  const filteredMeters = meters.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      m.meter_number.toLowerCase().includes(q) ||
      m.tenant?.full_name?.toLowerCase().includes(q) ||
      m.building?.address?.toLowerCase().includes(q)
    );
  });

  return (
    <ProtectedRoute>
      <PinGate isUnlocked={unlocked} onUnlock={() => setUnlocked(true)}>
        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold">Manual Vend</h1>
                <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
                  Manually trigger gas vends for meters (admin override)
                </p>
              </div>
              <IconVend className="h-7 w-7 text-primary" />
            </div>
          </div>

          {/* Search Bar */}
          <div className="card p-4">
            <input
              type="text"
              placeholder="Search by meter number, tenant name, or building..."
              className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Meters Table */}
          <div className="card overflow-hidden">
            {metersLoading ? (
              <div className="p-6 text-center text-textSecondary dark:text-dark-textSecondary">
                Loading meters...
              </div>
            ) : filteredMeters.length === 0 ? (
              <div className="p-6 text-center text-textSecondary dark:text-dark-textSecondary">
                No meters found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface dark:bg-dark-surface border-b border-border dark:border-dark-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Meter Number</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Tenant</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Building</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMeters.map((meter) => (
                      <tr
                        key={meter.id}
                        className="border-b border-border dark:border-dark-border hover:bg-surface dark:hover:bg-dark-surface"
                      >
                        <td className="px-4 py-3 text-sm font-mono">{meter.meter_number}</td>
                        <td className="px-4 py-3 text-sm">
                          {meter.tenant ? (
                            <Link
                              href={`/customers/${meter.tenant_id}`}
                              className="text-primary hover:underline"
                            >
                              {meter.tenant.full_name}
                            </Link>
                          ) : (
                            <span className="text-textSecondary dark:text-dark-textSecondary">
                              (Unassigned)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {meter.building ? (
                            <Link
                              href={`/buildings/${meter.building_id}`}
                              className="text-primary hover:underline"
                            >
                              {meter.building.address}
                            </Link>
                          ) : (
                            <span className="text-textSecondary dark:text-dark-textSecondary">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              meter.status === 'active'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : meter.status === 'locked'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                            }`}
                          >
                            {meter.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            className="rounded-control bg-primary text-white px-3 py-1 text-sm hover:opacity-90 disabled:opacity-50"
                            disabled={!meter.tenant_id || meter.status === 'locked'}
                            onClick={() => {
                              setSelectedMeter(meter);
                              setShowVendDialog(true);
                            }}
                          >
                            Vend Gas
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Vend Dialog */}
          {showVendDialog && selectedMeter && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="card p-6 max-w-2xl w-full m-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Manual Vend</h2>
                    <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
                      Meter: {selectedMeter.meter_number} | Tenant: {selectedMeter.tenant?.full_name}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowVendDialog(false);
                      setVendForm({ amountNaira: '', note: '' });
                    }}
                    className="text-textSecondary hover:text-text dark:text-dark-textSecondary dark:hover:text-dark-text"
                  >
                    ✕
                  </button>
                </div>

                {/* Vend History */}
                <div className="border border-border dark:border-dark-border rounded-control p-4 max-h-48 overflow-y-auto">
                  <h3 className="text-sm font-semibold mb-2">Recent Vend History</h3>
                  {historyLoading ? (
                    <p className="text-xs text-textSecondary dark:text-dark-textSecondary">
                      Loading...
                    </p>
                  ) : vendHistory.length === 0 ? (
                    <p className="text-xs text-textSecondary dark:text-dark-textSecondary">
                      No vend history
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {vendHistory.slice(0, 5).map((v) => (
                        <div
                          key={v.id}
                          className="text-xs border-b border-border dark:border-dark-border pb-2 last:border-b-0"
                        >
                          <div className="flex justify-between">
                            <span className="font-mono">{v.vend_token || '(No token)'}</span>
                            <span className="font-semibold">{v.kg}kg</span>
                          </div>
                          <div className="flex justify-between text-textSecondary dark:text-dark-textSecondary">
                            <span>Status: {v.status}</span>
                            <span>₦{v.amount_naira.toFixed(2)}</span>
                          </div>
                          {v.sent_at && (
                            <div className="text-textSecondary dark:text-dark-textSecondary">
                              Sent: {new Date(v.sent_at).toLocaleString()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Vend Form */}
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Amount (NGN)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
                      value={vendForm.amountNaira}
                      onChange={(e) => setVendForm({ ...vendForm, amountNaira: e.target.value })}
                      placeholder="e.g. 5000"
                    />
                    <p className="text-xs text-textSecondary dark:text-dark-textSecondary mt-1">
                      System will calculate kg based on current tariff
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Admin Note (optional)</label>
                    <textarea
                      rows={2}
                      className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
                      value={vendForm.note}
                      onChange={(e) => setVendForm({ ...vendForm, note: e.target.value })}
                      placeholder="Reason for manual vend..."
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowVendDialog(false);
                      setVendForm({ amountNaira: '', note: '' });
                    }}
                    className="flex-1 rounded-control border border-border dark:border-dark-border px-4 py-2 text-sm hover:bg-surface dark:hover:bg-dark-surface"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleVend}
                    disabled={vendMutation.isPending}
                    className="flex-1 rounded-control bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    {vendMutation.isPending ? 'Processing...' : 'Send Vend'}
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

