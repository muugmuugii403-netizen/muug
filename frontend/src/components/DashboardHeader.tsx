/**
 * Dashboard-ийн толгой хэсэг.
 * - Зах зээлийн статус: Forex 24/5 — Даваа 00:00 UTC ~ Баасан 22:00 UTC нээлттэй.
 * - Сүүлийн шинэчлэлтийн цаг (backend quote/analysis timestamp).
 */
import { useEffect, useState, type ReactNode } from "react";
import { IcRefresh, IcSettings } from "./icons";

/** UTC одоогийн цагаар FX зах зээл нээлттэй эсэхийг тооцоолно. */
function isMarketOpen(now: Date): boolean {
  const day = now.getUTCDay(); // 0=Ням, 5=Баасан
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (day === 0) return false; // Ням бүхэлдээ хаалттай
  if (day === 6) return false; // Бямба хаалттай
  if (day === 5) return minutes < 22 * 60; // Баасан 22:00 UTC хүртэл
  if (day === 1) return minutes >= 0; // Даваа 00:00-с
  return true; // Мя–Пү 24ц
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

interface Props {
  lastUpdate: Date | null;
  onRefresh: () => void;
  refreshing: boolean;
}

export function DashboardHeader({ lastUpdate, onRefresh, refreshing }: Props): ReactNode {
  const [now, setNow] = useState(() => new Date());
  const open = isMarketOpen(now);

  // Минут тутам статусыг шинэчилнэ (зах зээл нээгдэх/хаагдах мөчид)
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 sm:px-8">
        {/* App нэр */}
        <div className="flex items-baseline gap-2.5">
          <span className="font-mono text-[15px] font-bold tracking-tight text-mist">
            FOREX<span className="text-cy">·AI</span>
          </span>
          <span className="rounded-sm border border-line px-1.5 py-px font-mono text-[9.5px] uppercase tracking-widest text-dim">
            Analyzer
          </span>
        </div>

        {/* Зах зээлийн статус */}
        <div className="flex items-center gap-2 rounded-sm border border-line bg-panel/60 px-2.5 py-1">
          <span className={`led h-1.5 w-1.5 rounded-full ${open ? "bg-buy" : "bg-sell"}`} />
          <span className={`font-mono text-[11px] ${open ? "text-buy" : "text-sell"}`}>
            {open ? "ЗАХ ЗЭЭЛ НЭЭЛТТЭЙ" : "ЗАХ ЗЭЭЛ ХААЛТТАЙ"}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Сүүлийн шинэчлэлт */}
          <div className="text-right">
            <p className="font-mono text-[9.5px] uppercase tracking-widest text-dim">Сүүлийн шинэчлэлт</p>
            <p className="font-mono text-[12.5px] text-fog">
              {lastUpdate ? formatTime(lastUpdate) : "--:--:--"}
            </p>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            aria-label="Шинэчлэх"
            title="Шинэчлэх"
            className="rounded-sm border border-line bg-panel/60 p-2 text-fog transition-colors hover:border-edge hover:text-cy"
          >
            <IcRefresh className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            aria-label="Тохиргоо"
            title="Тохиргоо (удирдах самбар)"
            className="rounded-sm border border-line bg-panel/60 p-2 text-fog transition-colors hover:border-edge hover:text-cy"
          >
            <IcSettings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
