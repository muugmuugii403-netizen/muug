/**
 * Alert түүхийн самбар (Step 7).
 * Backend-ийн /api/alerts/history + SSE `alert` event-үүдээр дүүргэгдэнэ.
 * BUY/SELL/WAIT-ийг өнгөт badge-аар ялгаж, Entry/SL/TP-г харуулна.
 */
import type { ReactNode } from "react";
import { SIGNAL_META, formatPrice, type SignalDirection } from "@/lib/analysis";
import type { AlertEvent } from "@/lib/stream";
import { IcBell, IcClose, IcTelegram } from "@/components/icons";

interface Props {
  open: boolean;
  onClose: () => void;
  alerts: AlertEvent[];
  decimalsFor: (symbol: string) => number;
  loading: boolean;
}

function timeOf(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

function Badge({ dir }: { dir: SignalDirection }): ReactNode {
  const meta = SIGNAL_META[dir];
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold ${meta.border} ${meta.cls}`}>
      {meta.emoji} {dir}
    </span>
  );
}

export function AlertsDrawer({ open, onClose, alerts, decimalsFor, loading }: Props): ReactNode {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Хаах" onClick={onClose} className="absolute inset-0 bg-ink/60 backdrop-blur-sm" />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-line bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 font-mono text-[13px] font-semibold uppercase tracking-widest text-mist">
            <IcBell className="h-4 w-4 text-cy" /> Alert түүх
            <span className="rounded-sm border border-line px-1.5 py-px text-[10px] text-dim">{alerts.length}</span>
          </h2>
          <button type="button" onClick={onClose} aria-label="Хаах" className="rounded-sm border border-line p-1.5 text-fog transition-colors hover:border-edge hover:text-mist">
            <IcClose className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-md bg-panel2" />
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <div className="mt-16 text-center">
              <IcBell className="mx-auto h-8 w-8 text-dim" />
              <p className="mt-3 text-[13px] text-fog">Одоогоор alert байхгүй байна.</p>
              <p className="mt-1 text-[12px] text-dim">Signal чиглэл өөрчлөгдөхөд энд бүртгэгдэнэ.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {alerts.map((a) => {
                const dec = decimalsFor(a.symbol);
                return (
                  <li key={a.id} className="rounded-md border border-line bg-panel2/60 p-3.5 transition-colors hover:border-edge">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge dir={a.signal} />
                        <span className="font-mono text-[12.5px] font-semibold text-mist">{a.symbol}</span>
                      </div>
                      <span className="font-mono text-[11px] text-dim">{timeOf(a.created_at)}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-2 font-mono text-[11px]">
                      <div>
                        <p className="text-[9px] uppercase text-dim">Conf</p>
                        <p className="text-mist">{a.confidence}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase text-dim">Entry</p>
                        <p className="text-mist">{formatPrice(a.entry, dec)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase text-dim">SL</p>
                        <p className="text-sell">{formatPrice(a.stop_loss, dec)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase text-dim">TP</p>
                        <p className="text-buy">{formatPrice(a.take_profit, dec)}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="font-mono text-[10px] text-dim">
                        B {a.buy_score} · S {a.sell_score} · W {a.wait_score}
                      </span>
                      {a.telegram_notification_sent && (
                        <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-cy">
                          <IcTelegram className="h-3 w-3" /> илгээсэн
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
