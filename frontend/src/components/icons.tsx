/**
 * Inline SVG icon-ууд — гаднаас font/зураг татахгүй, бүгд өөрөө draw хийнэ.
 */
import type { ReactNode, SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

function base(props: P, children: ReactNode): ReactNode {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IcSettings(props: P): ReactNode {
  return base(
    props,
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09c0 .68.4 1.3 1.03 1.56a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c.26.63.88 1.03 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" />
    </>,
  );
}

export function IcRefresh(props: P): ReactNode {
  return base(
    props,
    <>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </>,
  );
}

export function IcTrendUp(props: P): ReactNode {
  return base(
    props,
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>,
  );
}

export function IcTrendDown(props: P): ReactNode {
  return base(
    props,
    <>
      <path d="M3 7l6 6 4-4 8 8" />
      <path d="M15 17h6v-6" />
    </>,
  );
}

export function IcFlat(props: P): ReactNode {
  return base(props, <path d="M4 12h16" />);
}

export function IcBrain(props: P): ReactNode {
  return base(
    props,
    <>
      <path d="M12 4a3 3 0 0 0-3 3v10a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3z" />
      <path d="M9 8H7a2.5 2.5 0 0 0 0 5h2M9 13H7a2.5 2.5 0 0 0 0 5h2" />
      <path d="M15 8h2a2.5 2.5 0 0 1 0 5h-2M15 13h2a2.5 2.5 0 0 1 0 5h-2" />
    </>,
  );
}

export function IcShield(props: P): ReactNode {
  return base(
    props,
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </>,
  );
}

export function IcTarget(props: P): ReactNode {
  return base(
    props,
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </>,
  );
}

export function IcAlert(props: P): ReactNode {
  return base(
    props,
    <>
      <path d="M12 3L2 20h20L12 3z" />
      <path d="M12 10v4M12 17.5v.5" />
    </>,
  );
}

export function IcSpark(props: P): ReactNode {
  return base(
    props,
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </>,
  );
}

export function IcBell(props: P): ReactNode {
  return base(
    props,
    <>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </>,
  );
}

export function IcClose(props: P): ReactNode {
  return base(
    props,
    <>
      <path d="M18 6L6 18M6 6l12 12" />
    </>,
  );
}

export function IcTelegram(props: P): ReactNode {
  return base(
    props,
    <>
      <path d="M22 3L2 10.5l6.5 2.5L11 20l3-5.5L20 18l2-15z" />
      <path d="M8.5 13L18 6" />
    </>,
  );
}
