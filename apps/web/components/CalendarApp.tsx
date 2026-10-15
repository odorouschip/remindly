"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoginScreen } from "./LoginScreen";
import { SignupScreen, type SignupPrefs } from "./SignupScreen";
import { ForgotPasswordScreen } from "./ForgotPasswordScreen";
import { Workspace } from "./calendar/Workspace";
import type { CalendarBackend } from "@/lib/calendar/backend";
import { createDemoBackend } from "@/lib/calendar/demoBackend";
import { createSupabaseBackend } from "@/lib/calendar/supabaseBackend";
import type { CalEvent } from "@/lib/calendar/types";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type OAuthProvider = "google" | "apple" | "azure" | "github";

const PREFS_STORAGE_KEY = "remindly:prefs";

/** Without Supabase keys (or with NEXT_PUBLIC_DEMO_MODE=true) the app runs on sample data. */
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || !isSupabaseConfigured;

type Session = { userId: string; email: string | null };

export function CalendarApp() {
  const supabase = useMemo(() => (DEMO_MODE ? null : getSupabaseBrowserClient()), []);

  const [authView, setAuthView] = useState<"login" | "signup" | "forgot">("login");
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(DEMO_MODE);
  const [status, setStatus] = useState("");
  const [isAuthWorking, setIsAuthWorking] = useState(false);
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
    setStatus("Signing in…");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setStatus(error ? error.message : "Signed in.");
    } finally {
      setIsAuthWorking(false);
    }
  }

  async function handleOAuth(provider: OAuthProvider) {
    if (!supabase) return;
    setStatus(`Redirecting to ${provider}…`);
    const redirectTo = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      ...(redirectTo ? { options: { redirectTo } } : {}),
    });
    if (error) setStatus(error.message);
  }

  async function handleSignUp(args: {
    firstName: string; lastName: string; email: string; password: string; prefs: SignupPrefs;
  }): Promise<{ ok: boolean; needsConfirm: boolean; message?: string }> {
    if (!supabase) return { ok: false, needsConfirm: false, message: "Supabase not configured." };
    const { firstName, lastName, email, password, prefs } = args;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
          timezone: prefs.timezone,
        },
      },
    });
    if (error) return { ok: false, needsConfirm: false, message: error.message };

    if (typeof window !== "undefined") {
      window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    }
    return { ok: true, needsConfirm: !data.session };
  }

  async function handleResetSendCode(email: string): Promise<{ ok: boolean; message?: string }> {
    if (!supabase) return { ok: false, message: "Supabase not configured." };
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }

  async function handleResetVerifyCode(email: string, code: string): Promise<{ ok: boolean; message?: string }> {
    if (!supabase) return { ok: false, message: "Supabase not configured." };
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }

  async function handleResetUpdatePassword(newPassword: string): Promise<{ ok: boolean; message?: string }> {
    if (!supabase) return { ok: false, message: "Supabase not configured." };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, message: error.message };
    // Sign back out so the user re-authenticates with the new password.
    await supabase.auth.signOut();
    return { ok: true };
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  // Blank until we know whether there's a session, so the login screen doesn't flash.
  if (!authReady) return null;

  if (!DEMO_MODE && !session) {
    if (authView === "login") {
      return (
        <LoginScreen
          onSignIn={handleSignIn}
          onOAuth={handleOAuth}
          onForgotPassword={() => { setStatus(""); setAuthView("forgot"); }}
          onSignUp={() => { setStatus(""); setAuthView("signup"); }}
          status={status}
          isWorking={isAuthWorking}
        />
      );
    }
    if (authView === "signup") {
      return (
        <SignupScreen
          onSignUp={handleSignUp}
          onOAuth={handleOAuth}
          onBackToLogin={() => { setStatus(""); setAuthView("login"); }}
        />
      );
    }
    return (
      <ForgotPasswordScreen
        onSendCode={handleResetSendCode}
        onVerifyCode={handleResetVerifyCode}
        onUpdatePassword={handleResetUpdatePassword}
        onBackToLogin={() => { setStatus(""); setAuthView("login"); }}
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
