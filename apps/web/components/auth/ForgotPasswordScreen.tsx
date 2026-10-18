"use client";

import { CircleCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/controls";
import { AuthLayout, Field, authStyles as styles } from "./AuthLayout";
import { MIN_PASSWORD_LENGTH } from "./SignupScreen";

type Result = { ok: boolean; message?: string };

type ForgotPasswordScreenProps = {
  onSendCode: (email: string) => Promise<Result>;
  onVerifyCode: (email: string, code: string) => Promise<Result>;
  onUpdatePassword: (newPassword: string) => Promise<Result>;
  onBackToLogin: () => void;
};

type Step = "email" | "code" | "password" | "done";

export function ForgotPasswordScreen({ onSendCode, onVerifyCode, onUpdatePassword, onBackToLogin }: ForgotPasswordScreenProps) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);

  /** Runs one step's request, showing its error or moving on. */
  const run = async (request: () => Promise<Result>, next: Step, fallback: string) => {
    setError("");
    setWorking(true);
    try {
      const res = await request();
      if (res.ok) setStep(next);
      else setError(res.message ?? fallback);
    } finally {
      setWorking(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (step === "email") void run(() => onSendCode(email.trim()), "code", "Could not send a code.");
    if (step === "code") void run(() => onVerifyCode(email.trim(), code), "password", "That code didn't work.");
    if (step === "password") void run(() => onUpdatePassword(password), "done", "Could not update your password.");
  };

  const resend = async () => {
    setError("");
    const res = await onSendCode(email.trim());
    if (res.ok) setResent(true);
    else setError(res.message ?? "Could not resend the code.");
  };

  const backLink = <button type="button" className={styles.link} onClick={onBackToLogin}>Back to log in</button>;

  if (step === "done") {
    return (
      <AuthLayout icon={<div className={styles.badge}><CircleCheck size={20} strokeWidth={1.75} /></div>}
        title="Password updated" subtitle="Log in with your new password.">
        <Button variant="accent" className={styles.submit} onClick={onBackToLogin}>Log in</Button>
      </AuthLayout>
    );
  }

  const copy = {
    email:    { title: "Reset your password", subtitle: "We'll email you a code to reset it.", button: "Send code" },
    code:     { title: "Check your email", subtitle: <>Enter the code we sent to <strong>{email}</strong>.</>, button: "Verify code" },
    password: { title: "Choose a new password", subtitle: undefined, button: "Update password" },
  }[step];

  return (
    <AuthLayout title={copy.title} subtitle={copy.subtitle} footer={backLink}>
      <form className={styles.form} onSubmit={submit}>
        {step === "email" && (
          <Field label="Email">
            <input className={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" autoComplete="email" required autoFocus />
          </Field>
        )}
        {step === "code" && (
          <Field label="Code"
            aside={<button type="button" className={styles.link} onClick={() => void resend()} disabled={resent}>
              {resent ? "Sent" : "Resend"}
            </button>}>
            <input className={`${styles.input} ${styles.code}`} value={code} required autoFocus
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
              inputMode="numeric" autoComplete="one-time-code" pattern="\d{6,8}" title="The 6-digit code from the email"
              aria-invalid={Boolean(error) || undefined} />
          </Field>
        )}
        {step === "password" && (
          <Field label="New password" hint={`At least ${MIN_PASSWORD_LENGTH} characters`}>
            <input className={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} autoFocus />
          </Field>
        )}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <Button variant="accent" type="submit" className={styles.submit} disabled={working}>
          {working ? "One moment…" : copy.button}
        </Button>
      </form>
    </AuthLayout>
  );
}
