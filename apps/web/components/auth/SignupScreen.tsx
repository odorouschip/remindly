"use client";

import { MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/controls";
import { AuthLayout, Field, OAuthButtons, authStyles as styles, type OAuthProvider } from "./AuthLayout";

export const MIN_PASSWORD_LENGTH = 8;

type SignupScreenProps = {
  onSignUp: (args: { name: string; email: string; password: string }) =>
    Promise<{ ok: boolean; needsConfirm: boolean; message?: string }>;
  onOAuth: (provider: OAuthProvider) => void | Promise<void>;
  onBackToLogin: () => void;
};

export function SignupScreen({ onSignUp, onOAuth, onBackToLogin }: SignupScreenProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setWorking(true);
    try {
      const res = await onSignUp({ name: name.trim(), email: email.trim(), password });
      if (!res.ok) { setError(res.message ?? "Could not create your account."); return; }
      // Without email confirmation Supabase signs the user straight in and the app takes over.
      if (res.needsConfirm) setSentTo(email.trim());
    } finally {
      setWorking(false);
    }
  };

  if (sentTo) {
    return (
      <AuthLayout icon={<div className={styles.badge}><MailCheck size={20} strokeWidth={1.75} /></div>}
        title="Check your email"
        subtitle={<>We sent a confirmation link to <strong>{sentTo}</strong>. Open it to finish setting up your account.</>}
        footer={<button type="button" className={styles.link} onClick={onBackToLogin}>Back to log in</button>} />
    );
  }

  return (
    <AuthLayout title="Create your account" subtitle="One calendar for events and tasks, with countdowns that keep you on time."
      footer={<>Already have an account? <button type="button" className={styles.link} onClick={onBackToLogin}>Log in</button></>}>
      <OAuthButtons onOAuth={(p) => void onOAuth(p)} />
      <form className={styles.form} onSubmit={handleSubmit}>
        <Field label="Name">
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)}
            autoComplete="name" required autoFocus />
        </Field>
        <Field label="Email">
          <input className={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com" autoComplete="email" required />
        </Field>
        <Field label="Password" hint={`At least ${MIN_PASSWORD_LENGTH} characters`}>
          <input className={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} />
        </Field>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <Button variant="accent" type="submit" className={styles.submit} disabled={working}>
          {working ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
