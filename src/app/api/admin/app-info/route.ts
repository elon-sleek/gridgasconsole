import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Import from admin_portal/package.json
  const pkgModule = await import('../../../../../package.json');
  const pkg: any = (pkgModule as any).default ?? pkgModule;

  const nowYear = new Date().getFullYear();

  const appNameRaw =
    (typeof pkg?.displayName === 'string' && pkg.displayName.trim().length > 0
      ? pkg.displayName.trim()
      : null) ??
    (typeof pkg?.name === 'string' && pkg.name.trim().length > 0 ? pkg.name.trim() : null);
  const appName = appNameRaw ?? 'GridGas Board';
  const copyrightHolder =
    typeof pkg?.copyrightHolder === 'string' && pkg.copyrightHolder.trim().length > 0
      ? pkg.copyrightHolder.trim()
      : 'GridGas';
  const copyrightText =
    typeof pkg?.copyright === 'string' && pkg.copyright.trim().length > 0
      ? pkg.copyright.trim()
      : `© ${nowYear} ${copyrightHolder}`;

  return NextResponse.json({
    name: appName,
    version: typeof pkg?.version === 'string' ? pkg.version : '0.0.0',
    copyright: copyrightText,
  });
}
