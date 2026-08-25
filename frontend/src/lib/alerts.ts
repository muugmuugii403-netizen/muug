/**
 * Alert API + тохиргооны хадгалалт (Step 7).
 *
 * Хоёр давхарга:
 *  • Server-side тохиргоо (buy/sell/wait/telegram) — POST /api/alerts/settings.
 *    Эдгээр нь сервер талд alert үүсгэх эсэх, Telegram илгээх эсэхийг шийднэ.
 *  • Client-side тохиргоо (browser notification) — localStorage. Browser
 *    notification-ийг клиент өөрөө үүсгэдэг тул энэ нь зөвхөн энд хадгалагдана.
 *
 * Telegram bot token нь ХЭЗЭЭ Ч frontend-д ирдэггүй — зөвхөн server .env-д.
 */
import { apiFetch, API_ROOT_URL } from "./api";
import type { AlertEvent } from "./stream";

export interface ServerAlertSettings {
  buy_enabled: boolean;
  sell_enabled: boolean;
  wait_enabled: boolean;
  telegram_enabled: boolean;
}

export interface ClientAlertSettings {
  /** Browser notification асаалттай эсэх (permission өгсөн үед л үйлчилнэ) */
  browser_enabled: boolean;
  /** Browser notification-д аль чиглэлийг харуулах вэ */
  browser_buy: boolean;
  browser_sell: boolean;
  browser_wait: boolean;
}

const CLIENT_KEY = "forex-analyzer:alert-settings";

export const DEFAULT_CLIENT_SETTINGS: ClientAlertSettings = {
  browser_enabled: true,
  browser_buy: true,
  browser_sell: true,
  browser_wait: false,
};

export function getAlertHistory(limit = 50): Promise<AlertEvent[]> {
  return apiFetch<AlertEvent[]>(`/alerts/history?limit=${limit}`, { base: API_ROOT_URL, retries: 1 });
}

export function getServerSettings(): Promise<ServerAlertSettings> {
  return apiFetch<ServerAlertSettings>("/alerts/settings", { base: API_ROOT_URL, retries: 1 });
}

export function updateServerSettings(s: ServerAlertSettings): Promise<ServerAlertSettings> {
  return apiFetch<ServerAlertSettings>("/alerts/settings", {
    base: API_ROOT_URL,
    method: "POST",
    body: s,
    retries: 1,
  });
}

/* ---------- client-side (localStorage) ---------- */

export function loadClientSettings(): ClientAlertSettings {
  if (typeof window === "undefined") return DEFAULT_CLIENT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(CLIENT_KEY);
    if (!raw) return DEFAULT_CLIENT_SETTINGS;
    return { ...DEFAULT_CLIENT_SETTINGS, ...(JSON.parse(raw) as Partial<ClientAlertSettings>) };
  } catch {
    return DEFAULT_CLIENT_SETTINGS;
  }
}

export function saveClientSettings(s: ClientAlertSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLIENT_KEY, JSON.stringify(s));
  } catch {
    /* private mode гэх мэт — чимээгүй алгасна */
  }
}
