/**
 * Helpdesk mascot: a smiling face wearing a support headset.
 * Pure SVG, no external file. The same drawing is the favicon (frontend/index.html).
 */
export function Logo({ size = 40, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <rect width="48" height="48" rx="14" fill="#2456a6" />
      {/* headset band + ear cups */}
      <path d="M12.5 25a11.5 11.5 0 0 1 23 0" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <rect x="9" y="22.5" width="6" height="10" rx="3" fill="#fff" />
      <rect x="33" y="22.5" width="6" height="10" rx="3" fill="#fff" />
      {/* face */}
      <circle cx="24" cy="27" r="8.5" fill="#fff" />
      <circle cx="21" cy="26" r="1.4" fill="#14284b" />
      <circle cx="27" cy="26" r="1.4" fill="#14284b" />
      <circle cx="18.6" cy="29" r="1.3" fill="#f4a7b6" />
      <circle cx="29.4" cy="29" r="1.3" fill="#f4a7b6" />
      <path d="M21.2 29.4q2.8 2.6 5.6 0" fill="none" stroke="#14284b" strokeWidth="1.5" strokeLinecap="round" />
      {/* microphone */}
      <path d="M36 32.5q0 5.5-6.5 5.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="29" cy="38" r="1.8" fill="#fff" />
    </svg>
  );
}
