import type { ReactNode } from "react";
import { Button } from "@/components/ui/controls";
import { Logo } from "@/components/ui/Logo";
import { AppleIcon, GitHubIcon, GoogleIcon, MicrosoftIcon } from "./ProviderIcons";
import styles from "./auth.module.css";

export { styles as authStyles };

export type OAuthProvider = "google" | "apple" | "azure" | "github";

const PROVIDERS: Record<OAuthProvider, { label: string; icon: ReactNode }> = {
  google: { label: "Google",    icon: <GoogleIcon /> },
  apple:  { label: "Apple",     icon: <AppleIcon /> },
  azure:  { label: "Microsoft", icon: <MicrosoftIcon /> },
  github: { label: "GitHub",    icon: <GitHubIcon /> },
};

/**
 * Only providers switched on in Supabase should show a button, otherwise the
 * click lands on Supabase's raw JSON error page. List them comma-separated in
 * NEXT_PUBLIC_AUTH_PROVIDERS, e.g. "google,github".
 */
const ENABLED_PROVIDERS = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? "")
  .split(",")
  .map((p) => p.trim())
  .filter((p): p is OAuthProvider => p in PROVIDERS);

type AuthLayoutProps = {
  /** Replaces the logo, e.g. a check mark on a success step. */
  icon?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
};

export function AuthLayout({ icon, title, subtitle, footer, children }: AuthLayoutProps) {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.head}>
          {icon ?? <Logo size={40} />}
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {children}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </main>
  );
}

/** Continue-with buttons plus an "or" divider; renders nothing when no provider is enabled. */
export function OAuthButtons({ onOAuth }: { onOAuth: (provider: OAuthProvider) => void }) {
  if (ENABLED_PROVIDERS.length === 0) return null;
  return (
    <>
      <div className={styles.providers}>
        {ENABLED_PROVIDERS.map((p) => (
          <Button key={p} className={styles.provider} onClick={() => onOAuth(p)}>
            {PROVIDERS[p].icon} Continue with {PROVIDERS[p].label}
          </Button>
        ))}
      </div>
      <div className={styles.divider}>or</div>
    </>
  );
}

type FieldProps = {
  label: string;
  /** Right-aligned next to the label, e.g. a "Forgot password?" link. */
  aside?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
};

export function Field({ label, aside, hint, error, children }: FieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.labelRow}>
        <span className={styles.label}>{label}</span>
        {aside}
      </span>
      {children}
      {error ? <span className={styles.error} role="alert">{error}</span> : hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}
