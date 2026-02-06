export function formatSupabaseError(err: unknown): string {
  const anyErr = err as any;
  if (!anyErr) return 'Unknown error';

  // Supabase PostgrestError shape: { message, details, hint, code }
  const message = anyErr.message || anyErr.error_description || anyErr.toString?.();
  const details = anyErr.details;
  const hint = anyErr.hint;

  return [message, details, hint].filter(Boolean).join(' · ');
}

export function isMissingRelationError(err: unknown): boolean {
  const anyErr = err as any;
  const code = String(anyErr?.code ?? '');
  const message = String(anyErr?.message ?? '');

  // Postgres undefined_table
  if (code === '42P01') return true;
  return message.toLowerCase().includes('relation') && message.toLowerCase().includes('does not exist');
}
