import api from "@/lib/api";

/**
 * Web Push client helpers.
 * - Registration is lazy and only after admin's explicit click.
 * - Falls back gracefully on unsupported browsers or denied permissions.
 * - PT-BR error messages surfaced to the caller (never English defaults).
 */

const SW_URL = "/sw.js";

export function isPushSupported() {
  return (
    typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window
  );
}

export function currentPermission() {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) output[i] = rawData.charCodeAt(i);
  return output;
}

async function ensureRegistration() {
  if (!isPushSupported()) throw new Error("Este navegador não suporta notificações push.");
  const existing = await navigator.serviceWorker.getRegistration(SW_URL);
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_URL);
}

export async function getStatus() {
  const { data } = await api.get("/admin/push/status");
  return data; // {configured, public_key, subscriptions}
}

/**
 * Prompts the browser for permission (only if not yet decided),
 * subscribes to the push service and registers the subscription
 * on the backend. Returns { ok: true, endpoint } on success.
 */
export async function enablePush() {
  if (!isPushSupported()) {
    return { ok: false, message: "Este navegador não suporta notificações push." };
  }
  const status = await getStatus();
  if (!status.configured || !status.public_key) {
    return { ok: false, message: "Notificações push ainda não configuradas no servidor." };
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    return { ok: false, message: "Permissão de notificação negada neste navegador." };
  }

  let registration;
  try {
    registration = await ensureRegistration();
    if (registration.installing) {
      await new Promise((resolve) => {
        registration.installing.addEventListener("statechange", (e) => {
          if (e.target.state === "activated") resolve();
        });
      });
    }
    await navigator.serviceWorker.ready;
  } catch (e) {
    return { ok: false, message: "Falha ao registrar o service worker neste navegador." };
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(status.public_key),
      });
    } catch (e) {
      return { ok: false, message: "Não foi possível assinar as notificações neste dispositivo." };
    }
  }

  try {
    const json = subscription.toJSON();
    await api.post("/admin/push/subscribe", {
      endpoint: json.endpoint,
      keys: json.keys || {},
    });
    return { ok: true, endpoint: json.endpoint };
  } catch (e) {
    return {
      ok: false,
      message: e?.response?.data?.detail || "Falha de rede ao registrar assinatura no servidor.",
    };
  }
}

export async function disablePush() {
  if (!isPushSupported()) return { ok: true };
  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_URL);
    if (!registration) return { ok: true };
    const sub = await registration.pushManager.getSubscription();
    if (sub) {
      try {
        await api.post("/admin/push/unsubscribe", { endpoint: sub.endpoint });
      } catch (_) {
        // Continue even if server call fails — we still unsub locally.
      }
      await sub.unsubscribe();
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, message: "Falha ao desativar notificações neste dispositivo." };
  }
}

export async function sendTest() {
  try {
    const { data } = await api.post("/admin/push/test");
    return { ok: true, ...data };
  } catch (e) {
    return {
      ok: false,
      message: e?.response?.data?.detail || "Falha ao enviar notificação de teste.",
    };
  }
}

export async function isEnabledOnThisDevice() {
  if (!isPushSupported()) return false;
  const registration = await navigator.serviceWorker.getRegistration(SW_URL);
  if (!registration) return false;
  const sub = await registration.pushManager.getSubscription();
  return !!sub && Notification.permission === "granted";
}
