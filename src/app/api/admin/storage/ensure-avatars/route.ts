import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, requireAuthUser } from '@/lib/supabaseAdmin';

const BUCKET = 'avatars';

export async function POST(req: Request) {
  const user = await requireAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseAdminClient();

  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) throw listError;

    const exists = (buckets ?? []).some((b) => b.name === BUCKET);
    if (exists) return NextResponse.json({ ok: true, bucket: BUCKET, created: false });

    const { error: createError } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: '5MB',
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    });

    if (createError) throw createError;

    return NextResponse.json({ ok: true, bucket: BUCKET, created: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to ensure avatar bucket' },
      { status: 500 }
    );
  }
}
