import type { ReactNode, SVGProps } from 'react';

// Icon SVG chép từ legacy/index.html + legacy/app.js (không thêm bộ icon, D-003/plan).
type P = SVGProps<SVGSVGElement> & { size?: number };
const Svg = ({ size = 18, children, ...p }: P & { children: ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
);

export const IconDashboard = (p: P) => (
  <Svg {...p}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></Svg>
);
export const IconTable = (p: P) => (
  <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16" /></Svg>
);
export const IconUpload = (p: P) => (
  <Svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></Svg>
);
export const IconUsers = (p: P) => (
  <Svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Svg>
);
export const IconDownload = (p: P) => (
  <Svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></Svg>
);
export const IconChevronLeft =(p: P) => <Svg strokeWidth={2.4} {...p}><path d="M15 18l-6-6 6-6" /></Svg>;
export const IconChevronRight = (p: P) => <Svg strokeWidth={2.4} {...p}><path d="M9 18l6-6-6-6" /></Svg>;
export const IconSearch = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Svg>;
export const IconFunnel = (p: P) => <Svg strokeLinejoin="round" {...p}><path d="M22 3H2l8 9.46V19l4 2v-8.54z" /></Svg>;
export const IconClose = (p: P) => <Svg strokeWidth={2.2} {...p}><path d="M18 6L6 18M6 6l12 12" /></Svg>;
export const IconCamera = (p: P) => (
  <Svg {...p}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></Svg>
);
export const IconCheck = (p: P) => <Svg strokeWidth={2.2} {...p}><path d="M20 6L9 17l-5-5" /></Svg>;
export const IconClock = (p: P) => <Svg strokeWidth={2.2} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
export const IconAlert = (p: P) => (
  <Svg strokeWidth={2.2} {...p}><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></Svg>
);
export const IconDashed = (p: P) => <Svg strokeWidth={2.2} {...p}><circle cx="12" cy="12" r="9" strokeDasharray="3 3" /></Svg>;
export const IconInbox = (p: P) => (
  <Svg {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></Svg>
);
export const IconKey = (p: P) => (
  <Svg {...p}><circle cx="8" cy="15" r="4" /><path d="M10.85 12.15L19 4M18 5l3 3M15 8l2 2" /></Svg>
);
export const IconLogout = (p: P) => (
  <Svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Svg>
);
