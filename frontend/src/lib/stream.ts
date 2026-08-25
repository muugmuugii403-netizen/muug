/**
 * Realtime SSE клиент (Step 7).
 *
 * Server-Sent Events: server→client нэг чиглэлт. EventSource нь browser-т
 * төрөлхөөсөө auto-reconnect хийдэг тул холболт тасрахад автоматаар дахин
 * холбогдоно. `signal`/`alert`/`price`/`status`/`snapshot` event-үүдийг
 * typed callback-аар дамжуулна.
 *
 * Чухал: reconnect үед duplicate alert гаргахгүй — клиент нь alert-ийн `id`-г
 * хөтөлж, аль хэдийн харсан id-г дахин боловсруулахгүй.
 */
import { STREAM_EVENTS_URL } from "./api";
import type { QuoteResponse } from "./market";
import type { SignalResponse } from "./analysis";

export interface AlertEvent {
  id: number;
  symbol: string;
  signal: "BUY" | "SELL" | "WAIT";
  confidence: number;
  buy_score: number;
  sell_score: number;
  wait_score: number;
  entry: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  risk_reward: number | null;
  reasons: string[];
  created_at: string;
  telegram_notification_sent: boolean;
  /** Qwen тайлбар (signal өөрчлөгдөхөд л ирнэ; unavailable үед null) */
  explanation: import("./analysis").AiExplanation | null;
  ai_status: "ok" | "unavailable" | "disabled";
  ai_message: string;
}

export interface SignalEvent extends SignalResponse {
  changed: boolean;
}

export interface SnapshotEvent {
  monitoring: boolean;
  pairs: string[];
  signals: Record<string, SignalResponse>;
  alerts: AlertEvent[];
}

export interface StatusEvent {
  state: string;
  message: string;
  pairs: string[];
  subscribers: number;
}

export interface StreamHandlers {
  onSnapshot?: (s: SnapshotEvent) => void;
  onPrice?: (p: QuoteResponse) => void;
  onSignal?: (s: SignalEvent) => void;
  onAlert?: (a: AlertEvent) => void;
  onStatus?: (s: StatusEvent) => void;
  /** Холболтын төлөв өөрчлөгдөхөд */
  onState?: (connected: boolean) => void;
}

/** EventSource-ийг удирдах жижиг wrapper. */
export class ForexEventStream {
  private es: EventSource | null = null;
  private seenAlertIds = new Set<number>();
  private closed = false;

  constructor(private handlers: StreamHandlers) {}

  start(): void {
    if (this.es) return;
    this.closed = false;
    this.connect();
  }

  private connect(): void {
    const es = new EventSource(STREAM_EVENTS_URL);
    this.es = es;

    es.onopen = () => this.handlers.onState?.(true);
    es.onerror = () => {
      // EventSource өөрөө reconnect хийнэ; бид зөвхөн төлөвийг мэдэгдэнэ
      this.handlers.onState?.(false);
    };

    const parse = <T,>(e: MessageEvent): T | null => {
      try {
        return JSON.parse(e.data as string) as T;
      } catch {
        return null;
      }
    };

    es.addEventListener("snapshot", (e) => {
      const snap = parse<SnapshotEvent>(e as MessageEvent);
      if (snap) {
        // snapshot-ийн alert-үүдийг "харсан"-д тооцож, дараагийн event-үүдэд давтахгүй
        snap.alerts.forEach((a) => this.seenAlertIds.add(a.id));
        this.handlers.onSnapshot?.(snap);
      }
    });
    es.addEventListener("price", (e) => {
      const p = parse<QuoteResponse>(e as MessageEvent);
      if (p) this.handlers.onPrice?.(p);
    });
    es.addEventListener("signal", (e) => {
      const s = parse<SignalEvent>(e as MessageEvent);
      if (s) this.handlers.onSignal?.(s);
    });
    es.addEventListener("alert", (e) => {
      const a = parse<AlertEvent>(e as MessageEvent);
      if (!a) return;
      if (this.seenAlertIds.has(a.id)) return; // duplicate (reconnect) хамгаалалт
      this.seenAlertIds.add(a.id);
      this.handlers.onAlert?.(a);
    });
    es.addEventListener("status", (e) => {
      const s = parse<StatusEvent>(e as MessageEvent);
      if (s) this.handlers.onStatus?.(s);
    });
  }

  stop(): void {
    this.closed = true;
    this.es?.close();
    this.es = null;
  }
}
