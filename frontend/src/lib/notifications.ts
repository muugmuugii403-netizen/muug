/**
 * Browser Notification wrapper (Step 7).
 *
 * Хэрэглэгч ЗААВАЛ зөвшөөрөл өгсний дараа л мэдэгдэл үүснэ (Notification API).
 * Зөвшөөрөлгүй эсвэл browser дэмжихгүй үед чимээгүй алгасна — dashboard
 * хэвийн ажиллаж үргэлжилнэ.
 */
import type { AlertEvent } from "./stream";
import { formatPrice } from "./analysis";

export type PermissionState = "granted" | "denied" | "default" | "unsupported";

export function notificationSupport(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function currentPermission(): PermissionState {
  if (!notificationSupport()) return "unsupported";
  return Notification.permission;
}

/** Хэрэглэгчийн зөвшөөрлийг гуйна (user gesture дотор дуудах ёстой). */
export async function requestPermission(): Promise<PermissionState> {
  if (!notificationSupport()) return "unsupported";
  try {
    await Notification.requestPermission();
  } catch {
    /* зарим browser exception өгдөг */
  }
  return Notification.permission;
}

/** Alert-ээс browser мэдэгдэл үүсгэнэ. Амжилтгүй бол чимээгүй алгасна. */
export function showBrowserNotification(alert: AlertEvent, decimals: number): void {
  if (!notificationSupport() || Notification.permission !== "granted") return;
  const emoji = alert.signal === "BUY" ? "🟢" : alert.signal === "SELL" ? "🔴" : "🟡";
  const lines = [
    `${emoji} ${alert.symbol} ${alert.signal} signal`,
    `Confidence: ${alert.confidence}/100`,
  ];
  if (alert.entry !== null) lines.push(`Entry: ${formatPrice(alert.entry, decimals)}`);
  if (alert.stop_loss !== null) lines.push(`SL: ${formatPrice(alert.stop_loss, decimals)}`);
  if (alert.take_profit !== null) lines.push(`TP: ${formatPrice(alert.take_profit, decimals)}`);

  try {
    new Notification(`${alert.symbol} ${alert.signal}`, {
      body: lines.join("\n"),
      tag: `forex-alert-${alert.id}`, // ижил tag давтагдахгүй
    });
  } catch {
    /* Notification constructor зарим орчинд exception — алгасна */
  }
}
