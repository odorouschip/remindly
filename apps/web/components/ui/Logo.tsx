export function Logo({ size = 22 }: { size?: number }) {
  return (
    <div aria-hidden style={{
      width: size, height: size, borderRadius: Math.round(size * 0.27), flexShrink: 0,
      display: "grid", placeItems: "center", background: "var(--text)", color: "var(--bg)",
    }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 14 14" fill="none">
        <rect x="1" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M1 6h12M4 1v3M10 1v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}
