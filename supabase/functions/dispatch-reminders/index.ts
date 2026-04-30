import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type ReminderRow = {
  id: string;
  user_id: string;
  offset_minutes: number;
  due_at: string;
  delivered_at: string | null;
  events: {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    timezone: string;
  };
};

type DeviceRow = {
  id: string;
  user_id: string;
  apns_device_token: string | null;
  activity_push_to_start_token: string | null;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const bundleId = Deno.env.get("APNS_BUNDLE_ID") ?? "";
const apnsTeamId = Deno.env.get("APNS_TEAM_ID") ?? "";
const apnsKeyId = Deno.env.get("APNS_KEY_ID") ?? "";
const apnsPrivateKey = Deno.env.get("APNS_PRIVATE_KEY") ?? "";
const apnsEnv = Deno.env.get("APNS_ENV") ?? "development";

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

  const now = new Date();
  const { data: reminders, error } = await supabase
    .from("reminders")
    .select("id,user_id,offset_minutes,due_at,delivered_at,events!inner(id,title,starts_at,ends_at,timezone)")
    .is("delivered_at", null)
    .lte("due_at", now.toISOString())
    .limit(100);

  if (error) {
    return json({ error: error.message }, 500);
  }

  const results = [];
  for (const reminder of (reminders ?? []) as ReminderRow[]) {
    results.push(await dispatchReminder(reminder, now));
  }

  return json({ processed: results.length, results });
});

async function dispatchReminder(reminder: ReminderRow, now: Date) {
  const { data: devices, error } = await supabase
    .from("devices")
    .select("id,user_id,apns_device_token,activity_push_to_start_token")
    .eq("user_id", reminder.user_id)
    .eq("platform", "ios");

  if (error) {
    return { reminderId: reminder.id, ok: false, error: error.message };
  }

  const apnsJwt = await createApnsJwt();
  const sendResults = [];

  for (const device of (devices ?? []) as DeviceRow[]) {
    if (device.activity_push_to_start_token) {
      sendResults.push(await sendLiveActivityStart(device, reminder, apnsJwt, now));
    }

    if (device.apns_device_token) {
      sendResults.push(await sendAlertNotification(device, reminder, apnsJwt));
    }
  }

  await supabase
    .from("reminders")
    .update({ delivered_at: now.toISOString() })
    .eq("id", reminder.id);

  return { reminderId: reminder.id, ok: true, devices: devices?.length ?? 0, sends: sendResults };
}

async function sendLiveActivityStart(device: DeviceRow, reminder: ReminderRow, jwt: string, now: Date) {
  const url = apnsUrl(`/3/device/${device.activity_push_to_start_token}`);
  const event = reminder.events;
  const payload = {
    aps: {
      timestamp: Math.floor(now.getTime() / 1000),
      event: "start",
      "attributes-type": "CalenderActivityAttributes",
      attributes: {
        eventId: event.id,
        title: event.title,
      },
      "content-state": {
        eventId: event.id,
        title: event.title,
        startsAt: event.starts_at,
        endsAt: event.ends_at,
        phase: phaseFor(now, event.starts_at, event.ends_at),
        urgency: urgencyFor(now, event.starts_at),
        deepLinkUrl: `calender://events/${event.id}`,
      },
      alert: {
        title: event.title,
        body: reminder.offset_minutes === 0 ? "Starting now" : `Starts in ${reminder.offset_minutes} minutes`,
        sound: "default",
      },
    },
  };

  const response = await fetch(url, {
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
    await supabase.from("live_activity_runs").insert({
      event_id: event.id,
      reminder_id: reminder.id,
      user_id: reminder.user_id,
      device_id: device.id,
      phase: payload.aps["content-state"].phase,
    });
  }

  return { kind: "live_activity", status: response.status, ok: response.ok };
}

async function sendAlertNotification(device: DeviceRow, reminder: ReminderRow, jwt: string) {
  const event = reminder.events;
  const response = await fetch(apnsUrl(`/3/device/${device.apns_device_token}`), {
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
          title: event.title,
          body: reminder.offset_minutes === 0 ? "Starting now" : `Starts in ${reminder.offset_minutes} minutes`,
        },
        sound: "default",
        "thread-id": event.id,
      },
      eventId: event.id,
      deepLinkUrl: `calender://events/${event.id}`,
    }),
  });

  return { kind: "notification", status: response.status, ok: response.ok };
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
