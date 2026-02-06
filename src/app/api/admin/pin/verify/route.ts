import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const adminPin = (process.env.ADMIN_PIN ?? '').trim();

  // If no PIN configured, treat as unlocked.
  if (!adminPin) {
    return NextResponse.json({ ok: true, disabled: true });
  }

  let pin = '';
  try {
    const body = (await req.json()) as { pin?: unknown };
    pin = typeof body?.pin === 'string' ? body.pin : '';
  } catch {
    pin = '';
  }

  if (!pin || pin !== adminPin) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
