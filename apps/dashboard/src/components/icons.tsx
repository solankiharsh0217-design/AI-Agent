import type { SVGProps } from 'react';

/** Lightweight inline icon set (stroke-based, currentColor) so we avoid a runtime dependency. */
function Base({ children, ...props }: SVGProps<SVGSVGElement> & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9 21v-6h6v6" /></Base>
);
export const AgentsIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><rect x="4" y="8" width="16" height="11" rx="2" /><path d="M12 8V4" /><circle cx="12" cy="3" r="1" /><path d="M9 13h.01M15 13h.01" /><path d="M2 13v3M22 13v3" /></Base>
);
export const KnowledgeIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19a2 2 0 0 0 2 2h13" /></Base>
);
export const ConversationsIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" /></Base>
);
export const WidgetsIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></Base>
);
export const AnalyticsIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M3 3v18h18" /><path d="M7 14l3-3 3 3 5-6" /></Base>
);
export const PhoneIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></Base>
);
export const BillingIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></Base>
);
export const SettingsIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 6.3 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H2a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 5 6.3l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.6V2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.6 1H22a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Base>
);
export const PlusIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M12 5v14M5 12h14" /></Base>
);
export const ArrowRightIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M5 12h14M13 5l7 7-7 7" /></Base>
);
export const MenuIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M3 6h18M3 12h18M3 18h18" /></Base>
);
export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M6 6l12 12M18 6 6 18" /></Base>
);
