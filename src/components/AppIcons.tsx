'use client';

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & {
  title?: string;
};

function Svg({ title, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      aria-label={title}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function IconDashboard(props: IconProps) {
  return (
    <Svg title="Dashboard" {...props}>
      <path d="M3 13h8V3H3v10z" />
      <path d="M13 21h8V11h-8v10z" />
      <path d="M13 3h8v6h-8V3z" />
      <path d="M3 21h8v-6H3v6z" />
    </Svg>
  );
}

export function IconAssets(props: IconProps) {
  return (
    <Svg title="Assets" {...props}>
      <path d="M7 7h10v10H7z" />
      <path d="M4 10V4h6" />
      <path d="M20 14v6h-6" />
    </Svg>
  );
}

export function IconFacilityManagers(props: IconProps) {
  return (
    <Svg title="Facility Managers" {...props}>
      <path d="M16 11a4 4 0 10-8 0" />
      <path d="M12 12c-4 0-7 2.5-7 5.5V20h14v-2.5C19 14.5 16 12 12 12z" />
      <path d="M12 4a3 3 0 110 6 3 3 0 010-6z" />
    </Svg>
  );
}

export function IconCustomers(props: IconProps) {
  return (
    <Svg title="Customers" {...props}>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <path d="M12 11a4 4 0 100-8 4 4 0 000 8z" />
    </Svg>
  );
}

export function IconBuildings(props: IconProps) {
  return (
    <Svg title="Buildings" {...props}>
      <path d="M3 21h18" />
      <path d="M6 21V5a2 2 0 012-2h8a2 2 0 012 2v16" />
      <path d="M9 7h1" />
      <path d="M9 11h1" />
      <path d="M9 15h1" />
      <path d="M14 7h1" />
      <path d="M14 11h1" />
      <path d="M14 15h1" />
    </Svg>
  );
}

export function IconVendors(props: IconProps) {
  return (
    <Svg title="Gas Vendors" {...props}>
      <path d="M7 3h10v6H7z" />
      <path d="M9 9v12" />
      <path d="M15 9v12" />
      <path d="M5 21h14" />
    </Svg>
  );
}

export function IconMap(props: IconProps) {
  return (
    <Svg title="Map" {...props}>
      <path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z" />
      <path d="M9 3v15" />
      <path d="M15 6v15" />
    </Svg>
  );
}

export function IconPriceSettings(props: IconProps) {
  return (
    <Svg title="Price Settings" {...props}>
      <path d="M12 1v22" />
      <path d="M17 5H9.5a3.5 3.5 0 100 7H14a3.5 3.5 0 110 7H6" />
    </Svg>
  );
}

export function IconVend(props: IconProps) {
  return (
    <Svg title="Vend" {...props}>
      <path d="M7 7h10v14H7z" />
      <path d="M9 3h6v4H9z" />
      <path d="M10 11h4" />
      <path d="M10 15h4" />
    </Svg>
  );
}

export function IconSupport(props: IconProps) {
  return (
    <Svg title="Support" {...props}>
      <path d="M21 15a4 4 0 01-4 4H8l-5 3V7a4 4 0 014-4h10a4 4 0 014 4v8z" />
      <path d="M8 8h8" />
      <path d="M8 12h6" />
    </Svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <Svg title="Settings" {...props}>
      <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
      <path d="M19.4 15a7.8 7.8 0 00.1-2l2-1.5-2-3.5-2.4 1a8 8 0 00-1.7-1l-.4-2.6H10l-.4 2.6a8 8 0 00-1.7 1l-2.4-1-2 3.5 2 1.5a7.8 7.8 0 000 2l-2 1.5 2 3.5 2.4-1a8 8 0 001.7 1l.4 2.6h4.9l.4-2.6a8 8 0 001.7-1l2.4 1 2-3.5-2-1.5z" />
    </Svg>
  );
}

export function IconAccount(props: IconProps) {
  return (
    <Svg title="Account" {...props}>
      <path d="M20 21a8 8 0 10-16 0" />
      <path d="M12 13a4 4 0 100-8 4 4 0 000 8z" />
    </Svg>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <Svg title="Info" {...props}>
      <path d="M12 17v-6" />
      <path d="M12 8h.01" />
      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </Svg>
  );
}

export function IconList(props: IconProps) {
  return (
    <Svg title="List" {...props}>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </Svg>
  );
}

export function IconPen(props: IconProps) {
  return (
    <Svg title="Pen" {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 013 3L8 18l-4 1 1-4 11.5-11.5z" />
    </Svg>
  );
}

export function IconPalette(props: IconProps) {
  return (
    <Svg title="Palette" {...props}>
      <path d="M12 21a9 9 0 119-9c0 1.7-1.3 3-3 3h-1a2 2 0 00-2 2c0 2.2-1.8 4-4 4z" />
      <path d="M7.5 10.5h.01" />
      <path d="M9.5 7.5h.01" />
      <path d="M14.5 6.5h.01" />
      <path d="M16.5 10.5h.01" />
    </Svg>
  );
}

export function IconTruck(props: IconProps) {
  return (
    <Svg title="Deliveries" {...props}>
      <path d="M1 3h15v13H1z" />
      <path d="M16 8h4l3 3v5h-7V8z" />
      <path d="M5 19a2 2 0 100-4 2 2 0 000 4z" />
      <path d="M19 19a2 2 0 100-4 2 2 0 000 4z" />
    </Svg>
  );
}
