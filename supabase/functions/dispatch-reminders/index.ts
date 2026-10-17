import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Runs every minute (Supabase cron). The database decides what's due:
// claim_due_reminders() hands out each reminder occurrence once, plus recent
// failures to retry, and moves reminders on to their next occurrence. This
// function only delivers them to Apple and records how it went.

/** One row from public.claim_due_reminders(). */
type DueReminder = {
  delivery_id: string;
  reminder_id: string;
  user_id: string;
  event_id: string;
  title: string;
  kind: "event" | "task";
  channel: "live_activity" | "notification";
  offset_minutes: number;
  occurrence_date: string;
  occurrence_start: string;
  occurrence_end: string;
};

type DeviceRow = {
  id: string;
  apns_token: string | null;
  push_to_start_token: string | null;
};

type SendResult = { device: string; kind: "live_activity" | "notification"; status: number; ok: boolean; reason?: string };

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const bundleId = Deno.env.get("APNS_BUNDLE_ID") ?? "";
const apnsTeamId = Deno.env.get("APNS_TEAM_ID") ?? "";
const apnsKeyId = Deno.env.get("APNS_KEY_ID") ?? "";
const apnsPrivateKey = Deno.env.get("APNS_PRIVATE_KEY") ?? "";
const apnsEnv = Deno.env.get("APNS_ENV") ?? "development";

// APNs reasons meaning the token will never work again.
const DEAD_TOKEN_REASONS = new Set(["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"]);

const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  const missingEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "APNS_BUNDLE_ID", "APNS_TEAM_ID", "APNS_KEY_ID", "APNS_PRIVATE_KEY"]
    .filter((key) => !Deno.env.get(key));
  if (missingEnv.length > 0) {
    return json({ error: "Missing environment variables", missingEnv }, 500);
  }

  const { data, error } = await supabase.rpc("claim_due_reminders", { max_count: 100 });
  if (error) {
    return json({ error: error.message }, 500);
  }
  const due = (data ?? []) as DueReminder[];
  if (due.length === 0) {
    return json({ processed: 0 });
  }

  // One token per run; Apple accepts it for up to an hour.
  const apnsJwt = await createApnsJwt();
  const now = new Date();
  const results = [];
  for (const reminder of due) {
    results.push(await dispatchReminder(reminder, apnsJwt, now));
  }

  return json({ processed: results.length, results });
});

async function dispatchReminder(reminder: DueReminder, jwt: string, now: Date) {
  const { data: devices, error } = await supabase
    .from("devices")
    .select("id,apns_token,push_to_start_token")
    .eq("user_id", reminder.user_id)
    .is("disabled_at", null);

  if (error) {
    await recordDelivery(reminder, false, error.message);
    return { deliveryId: reminder.delivery_id, ok: false, error: error.message };
  }

  const sends: SendResult[] = [];
  for (const device of (devices ?? []) as DeviceRow[]) {
    // Live Activities count down to events; tasks just get a notification.
    if (reminder.channel === "live_activity" && reminder.kind === "event" && device.push_to_start_token) {
      sends.push(await sendLiveActivityStart(device, reminder, jwt, now));
    }
    if (device.apns_token) {
      sends.push(await sendAlertNotification(device, reminder, jwt));
    }
  }

  const dead = [...new Set(sends.filter((s) => s.reason && DEAD_TOKEN_REASONS.has(s.reason)).map((s) => s.device))];
  if (dead.length > 0) {
    await supabase.from("devices").update({ disabled_at: now.toISOString() }).in("id", dead);
  }

  // Only a send that actually reached Apple counts; otherwise the database retries it.
  const ok = sends.some((s) => s.ok);
  const failure = sends.length === 0 ? "No devices to send to" : sends.map((s) => `${s.kind} ${s.status} ${s.reason ?? ""}`.trim()).join("; ");
  await recordDelivery(reminder, ok, ok ? null : failure);

  return { deliveryId: reminder.delivery_id, ok, sends };
}

async function recordDelivery(reminder: DueReminder, ok: boolean, lastError: string | null) {
  await supabase
    .from("reminder_deliveries")
    .update(ok ? { status: "sent", sent_at: new Date().toISOString(), last_error: null } : { status: "failed", last_error: lastError })
    .eq("id", reminder.delivery_id);
}

function alertBody(reminder: DueReminder): string {
  const minutes = reminder.offset_minutes;
  // Task reminders count from midnight of the due date.
  if (reminder.kind === "task") {
    if (minutes <= 0) return "Due today";
    if (minutes <= 1440) return "Due tomorrow";
    return `Due in ${Math.ceil(minutes / 1440)} days`;
  }
  if (minutes <= 0) return "Starting now";
  if (minutes < 60) return `Starts in ${minutes} minutes`;
  if (minutes % 1440 === 0) return minutes === 1440 ? "Tomorrow" : `In ${minutes / 1440} days`;
  if (minutes % 60 === 0) return minutes === 60 ? "Starts in 1 hour" : `Starts in ${minutes / 60} hours`;
  return `Starts in ${minutes} minutes`;
}

async function sendLiveActivityStart(device: DeviceRow, reminder: DueReminder, jwt: string, now: Date): Promise<SendResult> {
  const payload = {
    aps: {
      timestamp: Math.floor(now.getTime() / 1000),
      event: "start",
      // Must match the ActivityAttributes type name in the iOS app.
      "attributes-type": "CalenderActivityAttributes",
      attributes: {
        eventId: reminder.event_id,
        title: reminder.title,
      },
      "content-state": {
        eventId: reminder.event_id,
        title: reminder.title,
        startsAt: reminder.occurrence_start,
        endsAt: reminder.occurrence_end,
        phase: phaseFor(now, reminder.occurrence_start, reminder.occurrence_end),
        urgency: urgencyFor(now, reminder.occurrence_start),
        deepLinkUrl: `calender://events/${reminder.event_id}`,
      },
      alert: {
        title: reminder.title,
        body: alertBody(reminder),
        sound: "default",
      },
    },
  };

  const response = await fetch(apnsUrl(`/3/device/${device.push_to_start_token}`), {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": `${bundleId}.push-type.liveactivity`,
      "apns-push-type": "liveactivity",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    // One run per device per occurrence, however many reminders fire for it.
    await supabase.from("live_activity_runs").upsert({
      event_id: reminder.event_id,
      user_id: reminder.user_id,
      device_id: device.id,
      occurrence_date: reminder.occurrence_date,
      phase: payload.aps["content-state"].phase,
    }, { onConflict: "device_id,event_id,occurrence_date" });
  }

  return { device: device.id, kind: "live_activity", status: response.status, ok: response.ok, ...(await failureReason(response)) };
}

async function sendAlertNotification(device: DeviceRow, reminder: DueReminder, jwt: string): Promise<SendResult> {
  const response = await fetch(apnsUrl(`/3/device/${device.apns_token}`), {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: {
        alert: {
          title: reminder.title,
          body: alertBody(reminder),
        },
        sound: "default",
        "thread-id": reminder.event_id,
      },
      eventId: reminder.event_id,
      deepLinkUrl: `calender://events/${reminder.event_id}`,
    }),
  });

  return { device: device.id, kind: "notification", status: response.status, ok: response.ok, ...(await failureReason(response)) };
}

/** APNs explains failures as {"reason": "..."} in the body. */
async function failureReason(response: Response): Promise<{ reason?: string }> {
  if (response.ok) return {};
  try {
    const body = await response.json();
    return typeof body?.reason === "string" ? { reason: body.reason } : {};
  } catch {
    return {};
  }
}

async function createApnsJwt() {
  const header = base64UrlJson({ alg: "ES256", kid: apnsKeyId });
  const claims = base64UrlJson({ iss: apnsTeamId, iat: Math.floor(Date.now() / 1000) });
  const signingInput = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(apnsPrivateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

function phaseFor(now: Date, startsAt: string, endsAt: string) {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const current = now.getTime();
  if (current >= end) return "ended";
  if (current >= start) return "in_progress";
  if (start - current <= 60_000) return "starting";
  return "upcoming";
}

function urgencyFor(now: Date, startsAt: string) {
  const minutes = (new Date(startsAt).getTime() - now.getTime()) / 60_000;
  if (minutes <= 1) return "now";
  if (minutes <= 10) return "soon";
  return "calm";
}

function apnsUrl(path: string) {
  const host = apnsEnv === "production" ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com";
  return `${host}${path}`;
}

function pemToArrayBuffer(pem: string) {
  const normalized = pem
    .replaceAll("\\n", "\n")
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function base64UrlJson(value: unknown) {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
