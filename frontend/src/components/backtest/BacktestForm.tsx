"use client";

/**
 * Backtest тохиргооны форм (Step 6).
 * Түүхэн дата муж, эхний баланс, эрсдэл, spread/slippage-г тохируулна.
 * Бүх утга backend рүү явна — frontend ямар ч тооцоо хийхгүй.
 */
import { useState, type ReactNode } from "react";
import { FOREX_PAIRS } from "@/lib/market";
import type { BacktestRequest } from "@/lib/backtest";

interface Props {
  running: boolean;
  onRun: (req: BacktestRequest) => void;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function BacktestForm({ running, onRun }: Props): ReactNode {
  const [symbol, setSymbol] = useState("EUR/USD");
  const [startDate, setStartDate] = useState(() => isoDaysAgo(14));
  const [endDate, setEndDate] = useState(() => isoDaysAgo(1));
  const [balance, setBalance] = useState(10000);
  const [risk, setRisk] = useState(1);
  const [slippage, setSlippage] = useState(0);
  const [useTypicalSpread, setUseTypicalSpread] = useState(true);
  const [spreadPips, setSpreadPips] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const submit = (): void => {
    if (!startDate || !endDate) {
      setError("Огноо сонгоно уу");
      return;
    }
    if (startDate >= endDate) {
      setError("Эхлэх огноо дуусах огнооноос өмнө байх ёстой");
      return;
    }
    if (balance <= 0 || risk <= 0 || risk > 10) {
      setError("Баланс эерэг, эрсдэл 0–10% хооронд байна");
      return;
    }
    setError(null);
    onRun({
      symbol,
      start_date: startDate,
      end_date: endDate,
      initial_balance: balance,
      risk_per_trade: risk,
      slippage_pips: slippage,
      spread_pips: useTypicalSpread ? null : spreadPips,
    });
  };

  return (
    <section className="rounded-md border border-line bg-panel/60 p-5">
      <h2 className="font-display text-[15px] font-semibold text-mist">Backtest тохиргоо</h2>
      <p className="mt-1 text-[12.5px] text-dim">
        Production signal engine-ийг түүхэн өгөгдөл дээр шалгана. AI оролцохгүй.
      </p>

      {/* Pair */}
      <p className="mt-4 font-mono text-[10.5px] uppercase tracking-wider text-dim">Currency pair</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {FOREX_PAIRS.map((p) => (
          <button
            key={p.symbol}
            type="button"
            onClick={() => setSymbol(p.symbol)}
            className={`rounded-sm border px-2.5 py-1.5 font-mono text-[12px] transition-colors ${
              p.symbol === symbol
                ? "border-cy/60 bg-cy/10 text-mist"
                : "border-line text-fog hover:border-edge hover:text-mist"
            }`}
          >
            {p.symbol}
          </button>
        ))}
      </div>

      {/* Огноо */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-dim">Эхлэх</span>
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1.5 w-full rounded-sm border border-line bg-panel px-2.5 py-2 font-mono text-[12.5px] text-mist outline-none focus:border-cy/60"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-dim">Дуусах</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1.5 w-full rounded-sm border border-line bg-panel px-2.5 py-2 font-mono text-[12.5px] text-mist outline-none focus:border-cy/60"
          />
        </label>
      </div>

      {/* Баланс / эрсдэл */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-dim">Эхний баланс ($)</span>
          <input
            type="number"
            value={balance}
            min={1}
            onChange={(e) => setBalance(Number(e.target.value))}
            className="mt-1.5 w-full rounded-sm border border-line bg-panel px-2.5 py-2 font-mono text-[12.5px] text-mist outline-none focus:border-cy/60"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-dim">Эрсдэл / trade (%)</span>
          <input
            type="number"
            value={risk}
            min={0.1}
            max={10}
            step={0.1}
            onChange={(e) => setRisk(Number(e.target.value))}
            className="mt-1.5 w-full rounded-sm border border-line bg-panel px-2.5 py-2 font-mono text-[12.5px] text-mist outline-none focus:border-cy/60"
          />
        </label>
      </div>

      {/* Spread / slippage */}
      <div className="mt-4 grid grid-cols-2 items-end gap-3">
        <div>
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-dim">Spread</span>
          <label className="mt-1.5 flex items-center gap-2 text-[12.5px] text-fog">
            <input
              type="checkbox"
              checked={useTypicalSpread}
              onChange={(e) => setUseTypicalSpread(e.target.checked)}
              className="accent-[#45d6e4]"
            />
            Typical spread ашиглах
          </label>
          {!useTypicalSpread && (
            <input
              type="number"
              value={spreadPips}
              min={0}
              step={0.1}
              onChange={(e) => setSpreadPips(Number(e.target.value))}
              className="mt-1.5 w-full rounded-sm border border-line bg-panel px-2.5 py-1.5 font-mono text-[12.5px] text-mist outline-none focus:border-cy/60"
            />
          )}
        </div>
        <label className="block">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-dim">Slippage (pips)</span>
          <input
            type="number"
            value={slippage}
            min={0}
            step={0.1}
            onChange={(e) => setSlippage(Number(e.target.value))}
            className="mt-1.5 w-full rounded-sm border border-line bg-panel px-2.5 py-2 font-mono text-[12.5px] text-mist outline-none focus:border-cy/60"
          />
        </label>
      </div>

      {error && (
        <p className="mt-3 rounded-sm border border-sell/40 bg-sell/10 px-3 py-2 text-[12.5px] text-sell">{error}</p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={running}
        className="mt-4 w-full rounded-sm border border-buy/50 bg-buy/15 px-4 py-2.5 font-semibold text-buy transition-colors hover:bg-buy/25 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {running ? "Backtest ажиллаж байна…" : "RUN BACKTEST"}
      </button>
    </section>
  );
}
