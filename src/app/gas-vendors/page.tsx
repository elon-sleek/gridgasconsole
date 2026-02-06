'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authedFetch } from '@/lib/api';
import { formatSupabaseError, isMissingRelationError } from '@/lib/supabaseErrors';
import { IconVendors } from '@/components/AppIcons';
import Link from 'next/link';
import { AlertTriangle, CheckCircle, Clock, MapPin, XCircle, List, Map as MapIcon } from 'lucide-react';
import VendorsMap from '../../components/VendorsMap';

type VendorRow = {
  id: string;
  name: string;
  plant_location?: string | null;
  capacity_kg?: number | null;
  active?: boolean | null;
  created_at?: string | null;
  plant_lat?: number | null;
  plant_lng?: number | null;
  verified_at?: string | null;
};

type PendingVendor = {
  id: string;
  user_id: string;
  vendor_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  created_at: string;
  cac_certificate_url?: string | null;
  cac_status_doc_url?: string | null;
  nmdpra_license_url?: string | null;
  gas_plant_photo_url?: string | null;
  representative_id_url?: string | null;
  gas_vendors: { id: string; name: string; plant_location: string | null; capacity_kg: number | null } | null;
};

type VendorsPayload = {
  ok: boolean;
  vendors: VendorRow[];
  pendingProfiles: PendingVendor[];
};

export default function GasVendorsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [plantLocation, setPlantLocation] = useState('');
  const [capacityKg, setCapacityKg] = useState('');
  const [active, setActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'approved' | 'pending'>('pending');
  const [vendorViewMode, setVendorViewMode] = useState<'list' | 'map'>('list');
  
  // Approval modal state
  const [approvalModal, setApprovalModal] = useState<PendingVendor | null>(null);
  const [approvalLat, setApprovalLat] = useState('');
  const [approvalLng, setApprovalLng] = useState('');
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [reviewDocUrl, setReviewDocUrl] = useState<string | null>(null);

  const vendorsDataQuery = useQuery({
    queryKey: ['gas_vendors_admin_payload'],
    queryFn: async () => {
      const res = await authedFetch('/api/admin/gas-vendors', { method: 'GET' });
      const json = (await res.json().catch(() => ({}))) as Partial<VendorsPayload> & { error?: string };
      if (!res.ok) throw new Error(json?.error || 'Failed to load vendors');
      return {
        vendors: (json.vendors ?? []) as VendorRow[],
        pendingProfiles: (json.pendingProfiles ?? []) as PendingVendor[],
      };
    }
  });

  const allVendors = useMemo(() => vendorsDataQuery.data?.vendors ?? [], [vendorsDataQuery.data]);
  const pendingProfiles = useMemo(() => vendorsDataQuery.data?.pendingProfiles ?? [], [vendorsDataQuery.data]);

  const approvedVendors = useMemo(() => {
    return allVendors.filter((v) => !!v.verified_at);
  }, [allVendors]);

  const createVendor = useMutation({
    mutationFn: async () => {
      setFormError(null);
      const cap = capacityKg.trim() ? Number(capacityKg) : null;

      const res = await authedFetch('/api/admin/gas-vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          plantLocation: plantLocation.trim() || null,
          capacityKg: Number.isFinite(cap as any) ? cap : null,
          active
        })
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to create vendor');
    },
    onSuccess: async () => {
      setName('');
      setPlantLocation('');
      setCapacityKg('');
      setActive(true);
      await qc.invalidateQueries({ queryKey: ['gas_vendors_admin_payload'] });
    },
    onError: (err) => setFormError(formatSupabaseError(err))
  });

  // Approve vendor mutation
  const approveVendor = useMutation({
    mutationFn: async ({ vendorId, profileId, lat, lng }: { vendorId: string; profileId: string; lat: number; lng: number }) => {
      setApprovalError(null);
      const res = await authedFetch('/api/admin/gas-vendors/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId, profileId, lat, lng })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to approve vendor');
    },
    onSuccess: async () => {
      setApprovalModal(null);
      setApprovalLat('');
      setApprovalLng('');
      await qc.invalidateQueries({ queryKey: ['gas_vendors_admin_payload'] });
    },
    onError: (err) => setApprovalError(formatSupabaseError(err))
  });

  // Reject vendor mutation
  const rejectVendor = useMutation({
    mutationFn: async (profileId: string) => {
      const res = await authedFetch('/api/admin/gas-vendors/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to reject vendor');
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['gas_vendors_admin_payload'] });
    }
  });

  const missing = vendorsDataQuery.error ? isMissingRelationError(vendorsDataQuery.error) : false;

  return (
    <ProtectedRoute>
      <div className="space-y-4">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Gas Vendors</h1>
              <p className="text-sm text-textSecondary dark:text-dark-textSecondary">
                Manage upstream vendors, approve new registrations, and track deliveries.
              </p>
            </div>
            <IconVendors className="h-7 w-7 text-primary mt-1" />
          </div>
        </div>

        {missing && (
          <div className="card p-5">
            <h2 className="text-lg font-semibold">Gas vendors table not found</h2>
            <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-1">
              Create/apply the <span className="font-medium">gas_vendors</span> table (from the admin portal migrations).
            </p>
            <p className="text-sm text-red-500 mt-2">{formatSupabaseError(vendorsDataQuery.error)}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="card p-0 overflow-hidden">
          <div className="flex border-b border-border dark:border-dark-border">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                activeTab === 'pending'
                  ? 'bg-surfaceMuted dark:bg-dark-surfaceMuted border-b-2 border-primary'
                  : 'hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending Approvals
                {(pendingProfiles.length ?? 0) > 0 && (
                  <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full">
                    {pendingProfiles.length}
                  </span>
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('approved')}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                activeTab === 'approved'
                  ? 'bg-surfaceMuted dark:bg-dark-surfaceMuted border-b-2 border-primary'
                  : 'hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Approved Vendors
              </span>
            </button>
          </div>

          <div className="p-5">
            {activeTab === 'pending' && (
              <>
                {vendorsDataQuery.isLoading && (
                  <div className="py-8 text-center text-textSecondary">Loading...</div>
                )}
                {vendorsDataQuery.error && (
                  <p className="text-sm text-red-500">{formatSupabaseError(vendorsDataQuery.error)}</p>
                )}
                {!vendorsDataQuery.isLoading && (pendingProfiles.length ?? 0) === 0 && (
                  <div className="py-8 text-center text-textSecondary dark:text-dark-textSecondary">
                    <AlertTriangle className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    No pending vendor approvals
                  </div>
                )}
                <div className="space-y-3">
                  {pendingProfiles.map((v) => (
                    <div
                      key={v.id}
                      className="p-4 rounded-lg border border-border dark:border-dark-border hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-medium">{v.gas_vendors?.name ?? 'Unknown Vendor'}</div>
                          <div className="text-sm text-textSecondary dark:text-dark-textSecondary mt-1">
                            Contact: {v.full_name ?? '—'} • {v.phone ?? v.email ?? '—'}
                          </div>
                          <div className="text-sm text-textSecondary dark:text-dark-textSecondary">
                            Location: {v.gas_vendors?.plant_location ?? '—'} • Capacity: {v.gas_vendors?.capacity_kg ?? '—'} kg
                          </div>
                          <div className="text-xs text-textSecondary dark:text-dark-textSecondary mt-1">
                            Applied: {new Date(v.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setReviewDocUrl(null);
                              setApprovalModal(v);
                            }}
                            className="rounded-control bg-green-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-green-700"
                          >
                            Review
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Reject this vendor application?')) {
                                rejectVendor.mutate(v.id);
                              }
                            }}
                            disabled={rejectVendor.isPending}
                            className="rounded-control bg-red-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeTab === 'approved' && (
              <>
                {/* View Mode Toggle */}
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-textSecondary">
                    {approvedVendors.length ?? 0} approved vendor{(approvedVendors.length ?? 0) !== 1 ? 's' : ''}
                  </div>
                  <div className="flex items-center gap-1 rounded-lg border border-border dark:border-dark-border overflow-hidden">
                    <button
                      onClick={() => setVendorViewMode('list')}
                      className={`p-2 transition-colors ${
                        vendorViewMode === 'list' 
                          ? 'bg-primary text-white' 
                          : 'bg-surface dark:bg-dark-surface hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                      title="List View"
                    >
                      <List className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setVendorViewMode('map')}
                      className={`p-2 transition-colors ${
                        vendorViewMode === 'map' 
                          ? 'bg-primary text-white' 
                          : 'bg-surface dark:bg-dark-surface hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                      title="Map View"
                    >
                      <MapIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {vendorsDataQuery.error && !missing && (
                  <p className="text-sm text-red-500 mb-3">{formatSupabaseError(vendorsDataQuery.error)}</p>
                )}

                {/* Map View */}
                {vendorViewMode === 'map' && (
                  <VendorsMap 
                    vendors={approvedVendors}
                    className="h-[40rem] mb-4"
                  />
                )}

                {/* List View */}
                {vendorViewMode === 'list' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-textSecondary dark:text-dark-textSecondary border-b border-border dark:border-dark-border">
                        <th className="py-2 pr-3">Name</th>
                        <th className="py-2 pr-3">Location</th>
                        <th className="py-2 pr-3">Coordinates</th>
                        <th className="py-2 pr-3">Capacity</th>
                        <th className="py-2 pr-3">Verified</th>
                        <th className="py-2 pr-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvedVendors.map((v) => (
                        <tr key={v.id} className="border-b border-border dark:border-dark-border">
                          <td className="py-2 pr-3 align-top">
                            <Link href={`/gas-vendors/${v.id}`} className="font-medium text-primary hover:underline">
                              {v.name}
                            </Link>
                          </td>
                          <td className="py-2 pr-3 align-top">{v.plant_location ?? '—'}</td>
                          <td className="py-2 pr-3 align-top">
                            {v.plant_lat != null && v.plant_lng != null ? (
                              <span className="inline-flex items-center gap-1 text-green-600">
                                <MapPin className="h-3 w-3" />
                                {v.plant_lat.toFixed(4)}, {v.plant_lng.toFixed(4)}
                              </span>
                            ) : (
                              <span className="text-yellow-600">Not set</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 align-top">{typeof v.capacity_kg === 'number' ? `${v.capacity_kg} kg` : '—'}</td>
                          <td className="py-2 pr-3 align-top">
                            {v.verified_at ? (
                              <span className="text-green-600">{new Date(v.verified_at).toLocaleDateString()}</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 align-top">
                            <Link
                              href={`/gas-vendors/${v.id}`}
                              className="text-primary hover:underline text-xs"
                            >
                              View Details →
                            </Link>
                          </td>
                        </tr>
                      ))}
                      {!vendorsDataQuery.isLoading && approvedVendors.length === 0 && (
                        <tr>
                          <td className="py-4 text-sm text-textSecondary dark:text-dark-textSecondary" colSpan={6}>
                            No vendors found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Register New Vendor Card */}
        <div className="card p-5">
          <h2 className="text-lg font-semibold">Register vendor</h2>
          <p className="text-sm text-textSecondary dark:text-dark-textSecondary mt-1">Creates a new vendor record (for admin-created vendors).</p>

          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              createVendor.mutate();
            }}
          >
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <input
                  className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme Gas"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Plant location</label>
                <input
                  className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
                  value={plantLocation}
                  onChange={(e) => setPlantLocation(e.target.value)}
                  placeholder="(optional)"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Capacity (kg)</label>
                <input
                  type="number"
                  step="0.001"
                  className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
                  value={capacityKg}
                  onChange={(e) => setCapacityKg(e.target.value)}
                  placeholder="(optional)"
                />
              </div>
              <div className="flex items-end gap-3">
                <label className="inline-flex items-center gap-2 text-sm font-medium mb-2">
                  <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                  Active
                </label>
                <button
                  type="submit"
                  disabled={createVendor.isPending}
                  className="rounded-control bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
                >
                  {createVendor.isPending ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
            {formError && <p className="text-sm text-red-500">{formError}</p>}
          </form>
        </div>

        {/* Approval Modal */}
        {approvalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-surface dark:bg-dark-surface rounded-lg p-6 w-full max-w-md shadow-xl">
              <h3 className="text-lg font-semibold mb-2">Review Vendor</h3>
              <div className="text-sm text-textSecondary dark:text-dark-textSecondary mb-4">
                <div className="font-medium text-textPrimary dark:text-dark-textPrimary">
                  {approvalModal.gas_vendors?.name ?? 'Unknown Vendor'}
                </div>
                <div>Contact: {approvalModal.full_name ?? '—'} • {approvalModal.phone ?? approvalModal.email ?? '—'}</div>
                <div>Applied: {new Date(approvalModal.created_at).toLocaleString()}</div>
              </div>

              <div className="mb-4">
                <div className="text-sm font-medium mb-2">Documents</div>
                <div className="grid gap-2">
                  {(
                    [
                      { label: 'CAC Certificate', url: approvalModal.cac_certificate_url },
                      { label: 'CAC Status Doc', url: approvalModal.cac_status_doc_url },
                      { label: 'NMDPRA License', url: approvalModal.nmdpra_license_url },
                      { label: 'Gas Plant Photo', url: approvalModal.gas_plant_photo_url },
                      { label: 'Representative ID', url: approvalModal.representative_id_url },
                    ] as const
                  ).map((d) => (
                    <div key={d.label} className="flex items-center justify-between gap-3">
                      <div className="text-sm">{d.label}</div>
                      {d.url ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setReviewDocUrl(d.url!)}
                            className="text-xs text-primary hover:underline"
                          >
                            View
                          </button>
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-textSecondary hover:underline"
                          >
                            Open
                          </a>
                        </div>
                      ) : (
                        <div className="text-xs text-textSecondary">—</div>
                      )}
                    </div>
                  ))}
                </div>

                {reviewDocUrl && (
                  <div className="mt-3 rounded-lg border border-border dark:border-dark-border overflow-hidden">
                    {reviewDocUrl.toLowerCase().includes('.pdf') ? (
                      <iframe title="Document" src={reviewDocUrl} className="w-full h-56" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={reviewDocUrl} alt="Document" className="w-full h-56 object-contain bg-black/5" />
                    )}
                  </div>
                )}
              </div>

              <p className="text-sm text-textSecondary dark:text-dark-textSecondary mb-4">
                Enter the plant coordinates to enable geolocation features.
              </p>
              <div className="grid gap-3 grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Latitude</label>
                  <input
                    type="number"
                    step="0.0000001"
                    className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
                    value={approvalLat}
                    onChange={(e) => setApprovalLat(e.target.value)}
                    placeholder="e.g. 6.5244"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Longitude</label>
                  <input
                    type="number"
                    step="0.0000001"
                    className="w-full rounded-control border border-border dark:border-dark-border bg-surface dark:bg-dark-surface px-3 py-2 text-sm mt-1"
                    value={approvalLng}
                    onChange={(e) => setApprovalLng(e.target.value)}
                    placeholder="e.g. 3.3792"
                  />
                </div>
              </div>
              {approvalError && <p className="text-sm text-red-500 mt-3">{approvalError}</p>}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setApprovalModal(null);
                    setApprovalLat('');
                    setApprovalLng('');
                    setApprovalError(null);
                    setReviewDocUrl(null);
                  }}
                  className="rounded-control border border-border dark:border-dark-border px-4 py-2 text-sm hover:bg-surfaceMuted dark:hover:bg-dark-surfaceMuted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const lat = parseFloat(approvalLat);
                    const lng = parseFloat(approvalLng);
                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                      setApprovalError('Please enter valid coordinates');
                      return;
                    }
                    approveVendor.mutate({
                      vendorId: approvalModal.vendor_id,
                      profileId: approvalModal.id,
                      lat,
                      lng
                    });
                  }}
                  disabled={approveVendor.isPending}
                  className="rounded-control bg-green-600 text-white px-4 py-2 text-sm font-semibold hover:bg-green-700 disabled:opacity-60"
                >
                  {approveVendor.isPending ? 'Approving…' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
