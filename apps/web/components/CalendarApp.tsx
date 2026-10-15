"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OAuthProvider } from "./auth/AuthLayout";
import { ForgotPasswordScreen } from "./auth/ForgotPasswordScreen";
import { LoginScreen } from "./auth/LoginScreen";
import { SignupScreen } from "./auth/SignupScreen";
import { Workspace } from "./calendar/Workspace";
import type { CalendarBackend } from "@/lib/calendar/backend";
import { createDemoBackend } from "@/lib/calendar/demoBackend";
import { createSupabaseBackend } from "@/lib/calendar/supabaseBackend";
import type { CalEvent } from "@/lib/calendar/types";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/** Without Supabase keys (or with NEXT_PUBLIC_DEMO_MODE=true) the app runs on sample data. */
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || !isSupabaseConfigured;

type Session = { userId: string; email: string | null };

/** Supabase passes the browser's raw network errors through ("Failed to fetch"). */
function authMessage(message: string): string {
  return /fetch|network/i.test(message) ? "Couldn't reach the server. Check your connection and try again." : message;
}

export function CalendarApp() {
  const supabase = useMemo(() => (DEMO_MODE ? null : getSupabaseBrowserClient()), []);

  const [authView, setAuthView] = useState<"login" | "signup" | "forgot">("login");
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(DEMO_MODE);
  const [authError, setAuthError] = useState("");
  const [isAuthWorking, setIsAuthWorking] = useState(false);
  // Verifying a reset code signs the user in; stay on the reset screen until
  // they've chosen a new password instead of dropping into the calendar.
  const [recovering, setRecovering] = useState(false);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);

  const backend = useMemo<CalendarBackend | null>(() => {
    if (DEMO_MODE) return createDemoBackend();
    return supabase && session ? createSupabaseBackend(supabase, session.userId) : null;
  }, [supabase, session?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 4000);
  }, []);

  const reload = useCallback(async () => {
    if (!backend) { setEvents([]); return; }
    try {
      setEvents(await backend.listEvents());
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not load events.");
    }
  }, [backend, showNotice]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (!supabase) return;
    const toSession = (s: { user: { id: string; email?: string | undefined } } | null): Session | null =>
      s ? { userId: s.user.id, email: s.user.email ?? null } : null;
    supabase.auth.getSession().then(({ data }) => {
      setSession(toSession(data.session));
      setAuthReady(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, s) => setSession(toSession(s)));
    return () => subscription.subscription.unsubscribe();
  }, [supabase]);

  async function handleSave(ev: CalEvent) {
    if (!backend) return;
    try {
      await backend.saveEvent(ev);
      await reload();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not save.");
    }
  }

  async function handleDelete(id: string) {
    if (!backend) return;
    try {
      await backend.deleteEvent(id);
      await reload();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not delete.");
    }
  }

  async function handleSignIn(email: string, password: string) {
    if (!supabase) return;
    setIsAuthWorking(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError(authMessage(error.message));
    } finally {
      setIsAuthWorking(false);
    }
  }

  async function handleOAuth(provider: OAuthProvider) {
    if (!supabase) return;
    setAuthError("");
    const redirectTo = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      ...(redirectTo ? { options: { redirectTo } } : {}),
    });
    if (error) setAuthError(authMessage(error.message));
  }

  async function handleSignUp({ name, email, password }: { name: string; email: string; password: string }):
    Promise<{ ok: boolean; needsConfirm: boolean; message?: string }> {
    if (!supabase) return { ok: false, needsConfirm: false, message: "Supabase not configured." };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      },
    });
    if (error) return { ok: false, needsConfirm: false, message: authMessage(error.message) };
    return { ok: true, needsConfirm: !data.session };
  }

  async function handleResetSendCode(email: string): Promise<{ ok: boolean; message?: string }> {
    if (!supabase) return { ok: false, message: "Supabase not configured." };
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) return { ok: false, message: authMessage(error.message) };
    return { ok: true };
  }

  async function handleResetVerifyCode(email: string, code: string): Promise<{ ok: boolean; message?: string }> {
    if (!supabase) return { ok: false, message: "Supabase not configured." };
    // Set before verifying: the session arrives via onAuthStateChange mid-await.
    setRecovering(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
    if (error) {
      setRecovering(false);
      return { ok: false, message: authMessage(error.message) };
    }
    return { ok: true };
  }

  async function handleResetUpdatePassword(newPassword: string): Promise<{ ok: boolean; message?: string }> {
    if (!supabase) return { ok: false, message: "Supabase not configured." };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, message: authMessage(error.message) };
    // Sign back out so the user re-authenticates with the new password.
    await supabase.auth.signOut();
    setRecovering(false);
    return { ok: true };
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  // Blank until we know whether there's a session, so the login screen doesn't flash.
  if (!authReady) return null;

  const backToLogin = () => {
    setAuthError("");
    setAuthView("login");
    // Abandoning a reset after the code was verified would leave a live session.
    if (recovering) {
      setRecovering(false);
      void supabase?.auth.signOut();
    }
  };

  if (!DEMO_MODE && (!session || recovering)) {
    if (authView === "login") {
      return (
        <LoginScreen
          onSignIn={handleSignIn}
          onOAuth={handleOAuth}
          onForgotPassword={() => { setAuthError(""); setAuthView("forgot"); }}
          onSignUp={() => { setAuthError(""); setAuthView("signup"); }}
          error={authError}
          isWorking={isAuthWorking}
        />
      );
    }
    if (authView === "signup") {
      return (
        <SignupScreen
          onSignUp={handleSignUp}
          onOAuth={handleOAuth}
          onBackToLogin={backToLogin}
        />
      );
    }
    return (
      <ForgotPasswordScreen
        onSendCode={handleResetSendCode}
        onVerifyCode={handleResetVerifyCode}
        onUpdatePassword={handleResetUpdatePassword}
        onBackToLogin={backToLogin}
      />
    );
  }

  return (
    <Workspace
      events={events}
      account={{ email: session?.email ?? null, demo: DEMO_MODE }}
      notice={notice}
      onSave={(ev) => void handleSave(ev)}
      onDelete={(id) => void handleDelete(id)}
      onSignOut={() => void handleSignOut()}
    />
  );
}
