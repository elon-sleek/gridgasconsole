'use client';

import { useEffect, useMemo } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/lib/supabaseClient';

export type RealtimeInvalidateSpec = {
  table: string;
  schema?: string;
  events?: Array<'INSERT' | 'UPDATE' | 'DELETE'>;
  invalidate: QueryKey[];
};

function stableKey(specs: RealtimeInvalidateSpec[]): string {
  // Avoid putting QueryKey objects directly in deps.
  return JSON.stringify(
    specs.map((s) => ({
      table: s.table,
      schema: s.schema ?? 'public',
      events: s.events ?? ['INSERT', 'UPDATE', 'DELETE'],
      invalidate: s.invalidate
    }))
  );
}

export function useRealtimeInvalidation(
  specs: RealtimeInvalidateSpec[],
  enabled: boolean = true,
  pollIntervalMs: number = 0,
) {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const key = stableKey(specs);

  useEffect(() => {
    if (!enabled) return;
    if (!specs.length) return;

    const channels = specs.map((spec) => {
      const schema = spec.schema ?? 'public';
      const events = spec.events ?? ['INSERT', 'UPDATE', 'DELETE'];

      const channel: any = (supabase as any).channel(
        `invalidate:${schema}:${spec.table}:${Math.random().toString(36).slice(2)}`
      );

      events.forEach((event) => {
        channel.on('postgres_changes', { event, schema, table: spec.table }, () => {
          for (const qk of spec.invalidate) {
            queryClient.invalidateQueries({ queryKey: qk });
          }
        });
      });

      channel.subscribe();
      return channel;
    });

    // Optional fallback polling: keeps UI counts accurate even when Realtime is not enabled
    // for one or more tables (common in new Supabase projects).
    const pollId =
      pollIntervalMs > 0
        ? setInterval(() => {
            for (const spec of specs) {
              for (const qk of spec.invalidate) {
                queryClient.invalidateQueries({ queryKey: qk });
              }
            }
          }, pollIntervalMs)
        : null;

    return () => {
      if (pollId) clearInterval(pollId);
      channels.forEach((ch) => {
        try {
          (supabase as any).removeChannel(ch);
        } catch {
          // ignore
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, pollIntervalMs]);
}
