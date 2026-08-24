/**
 * Alert тохиргооны цонх (Step 7).
 *  • Server-side: BUY/SELL/WAIT alert болон Telegram (POST /api/alerts/settings)
 *  • Client-side: Browser notification (localStorage + Notification API)
 * Telegram bot token нь server .env-д хадгалагдах тул энд зөвхөн асаах/унтраах
 * товч байна — token ХЭЗЭЭ Ч frontend-д ирэхгүй.
 */
import { useEffect, useState, type ReactNode } from "react";
import {
  loadClientSettings,
  saveClientSettings,
  updateServerSettings,
  type ClientAlertSettings,
  type ServerAlertSettings,
} from "@/lib/alerts";
import { currentPermission, requestPermission, type PermissionState } from "@/lib/notifications";
import { IcClose } from "@/components/icons";

interface Props {
  open: boolean;
  onClose: () => void;
  serverSettings: ServerAlertSettings | null;
  onServerChange: (s: ServerAlertSettings) => void;
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }): ReactNode {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between rounded-sm border border-line bg-panel/60 px-3 py-2.5 text-left transition-colors hover:border-edge"
    >
      <span>
        <span className="block text-[13px] font-medium text-mist">{label}</span>
        {hint ? <span className="block text-[11px] text-dim">{hint}</span> : null}
      </span>
      <span className={`relative inline-flex h-5 w-10 shrink-0 items-center rounded-full border transition-colors ${on ? "border-buy/60 bg-buy/30" : "border-line bg-panel2"}`}>
        <span className={`absolute h-3.5 w-3.5 rounded-full transition-transform ${on ? "translate-x-5 bg-buy" : "translate-x-1 bg-dim"}`} />
      </span>
    </button>
  );
}

export function SettingsModal({ open, onClose, serverSettings, onServerChange }: Props): ReactNode {
  const [client, setClient] = useState<ClientAlertSettings>(() => loadClientSettings());
  const [perm, setPerm] = useState<PermissionState>(() => currentPermission());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setPerm(currentPermission());
  }, [open]);

  if (!open) return null;

  const setClientAndSave = (patch: Partial<ClientAlertSettings>): void => {
    setClient((prev) => {
      const next = { ...prev, ...patch };
      saveClientSettings(next);
      return next;
    });
  };

  const setServer = async (patch: Partial<ServerAlertSettings>): Promise<void> => {
    if (!serverSettings) return;
    setSaving(true);
    try {
      const next = await updateServerSettings({ ...serverSettings, ...patch });
      onServerChange(next);
    } finally {
      setSaving(false);
    }
  };

  const enableBrowser = async (): Promise<void> => {
    const p = await requestPermission();
    setPerm(p);
    if (p === "granted") setClientAndSave({ browser_enabled: true });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Хаах" onClick={onClose} className="absolute inset-0 bg-ink/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-md border border-edge bg-panel p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[13px] font-semibold uppercase tracking-widest text-mist">Alert тохиргоо</h2>
          <button type="button" onClick={onClose} aria-label="Хаах" className="rounded-sm border border-line p-1.5 text-fog transition-colors hover:border-edge hover:text-mist">
            <IcClose className="h-4 w-4" />
          </button>
        </div>

        {/* Server-side: ямар чиглэлийн alert үүсгэх вэ */}
        <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-dim">Signal чиглэл</p>
        <div className="mt-2 space-y-2">
          <Toggle on={serverSettings?.buy_enabled ?? true} onChange={(v) => void setServer({ buy_enabled: v })} label="🟢 BUY alert" hint="BUY signal үүсэхэд мэдэгдэнэ" />
          <Toggle on={serverSettings?.sell_enabled ?? true} onChange={(v) => void setServer({ sell_enabled: v })} label="🔴 SELL alert" hint="SELL signal үүсэхэд мэдэгдэнэ" />
          <Toggle on={serverSettings?.wait_enabled ?? true} onChange={(v) => void setServer({ wait_enabled: v })} label="🟡 WAIT alert" hint="WAIT руу шилжихэд мэдэгдэнэ" />
        </div>

        {/* Telegram (server-side) */}
        <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-dim">Суваг</p>
        <div className="mt-2 space-y-2">
          <Toggle
            on={serverSettings?.telegram_enabled ?? true}
            onChange={(v) => void setServer({ telegram_enabled: v })}
            label="Telegram мэдэгдэл"
            hint="Bot token server .env-д хадгалагдана"
          />
          <Toggle
            on={client.browser_enabled}
            onChange={(v) => setClientAndSave({ browser_enabled: v })}
            label="Browser мэдэгдэл"
            hint={perm === "granted" ? "Зөвшөөрөл өгөгдсөн" : perm === "denied" ? "Browser дээр хориглосон" : "Зөвшөөрөл шаардлагатай"}
          />
        </div>

        {/* Browser permission */}
        {perm === "default" && (
          <button
            type="button"
            onClick={() => void enableBrowser()}
            className="mt-3 w-full rounded-sm border border-cy/50 bg-cy/10 px-3 py-2 text-[13px] font-medium text-cy transition-colors hover:bg-cy/20"
          >
            Browser мэдэгдлийн зөвшөөрөл өгөх
          </button>
        )}
        {perm === "denied" && (
          <p className="mt-3 rounded-sm border border-sell/40 bg-sell/[0.06] px-3 py-2 text-[12px] text-sell">
            Browser мэдэгдэл хориглосон байна. Browser-ийн сайтын тохиргооноос зөвшөөрнө үү.
          </p>
        )}

        {/* Browser чиглэл шүүлт */}
        <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-dim">Browser-д харуулах</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Toggle on={client.browser_buy} onChange={(v) => setClientAndSave({ browser_buy: v })} label="BUY" />
          <Toggle on={client.browser_sell} onChange={(v) => setClientAndSave({ browser_sell: v })} label="SELL" />
          <Toggle on={client.browser_wait} onChange={(v) => setClientAndSave({ browser_wait: v })} label="WAIT" />
        </div>

        {saving && <p className="mt-3 text-center font-mono text-[11px] text-dim">Хадгалж байна…</p>}
      </div>
    </div>
  );
}
