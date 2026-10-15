"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/controls";
import { AuthLayout, Field, OAuthButtons, authStyles as styles, type OAuthProvider } from "./AuthLayout";

type LoginScreenProps = {
  onSignIn: (email: string, password: string) => void | Promise<void>;
  onOAuth: (provider: OAuthProvider) => void | Promise<void>;
  onForgotPassword: () => void;
  onSignUp: () => void;
  error: string;
  isWorking: boolean;
};

export function LoginScreen({ onSignIn, onOAuth, onForgotPassword, onSignUp, error, isWorking }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void onSignIn(email.trim(), password);
  };

  return (
    <AuthLayout title="Log in to Remindly"
      footer={<>No account yet? <button type="button" className={styles.link} onClick={onSignUp}>Sign up</button></>}>
      <OAuthButtons onOAuth={(p) => void onOAuth(p)} />
      <form className={styles.form} onSubmit={handleSubmit}>
        <Field label="Email">
          <input className={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com" autoComplete="email" required autoFocus />
        </Field>
        <Field label="Password"
          aside={<button type="button" className={styles.link} onClick={onForgotPassword}>Forgot password?</button>}>
          <input className={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password" required aria-invalid={Boolean(error) || undefined} />
        </Field>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <Button variant="primary" type="submit" className={styles.submit} disabled={isWorking}>
          {isWorking ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </AuthLayout>
  );
}
