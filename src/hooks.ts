import { useEffect, useRef, useState, type RefObject } from "react";

/** prefers-reduced-motion */
export function usePRM(): boolean {
  const [prm, setPrm] = useState<boolean>(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrm(mq.matches);
    const onChange = (e: MediaQueryListEvent): void => setPrm(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return prm;
}

/** Scroll дээр нэг удаа харагдах (reveal) */
export function useReveal<T extends HTMLElement>(): {
  ref: RefObject<T>;
  on: boolean;
} {
  const ref = useRef<T>(null);
  const [on, setOn] = useState<boolean>(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOn(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, on };
}

const GLYPHS = "█▓▒░<>/\\|=+*#FX¥€$01";

/** Scramble-decode title effect */
export function useScramble(text: string, start: boolean, speed = 26): string {
  const [out, setOut] = useState<string>(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? text
      : text.replace(/[^\s]/g, "▒"),
  );
  useEffect(() => {
    if (!start) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOut(text);
      return;
    }
    let frame = 0;
    const id = window.setInterval(() => {
      frame += 1;
      const locked = Math.floor(frame / 2);
      if (locked >= text.length) {
        setOut(text);
        window.clearInterval(id);
        return;
      }
      let s = "";
      for (let i = 0; i < text.length; i++) {
        s += i < locked ? text[i] : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      setOut(s);
    }, speed);
    return () => window.clearInterval(id);
  }, [text, start, speed]);
  return out;
}

/** Идэвхтэй section (scrollspy) */
export function useScrollSpy(ids: string[]): string {
  const [active, setActive] = useState<string>(ids[0] ?? "");
  const key = ids.join(",");
  useEffect(() => {
    const list = key.split(",").filter(Boolean);
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: "-25% 0px -65% 0px", threshold: 0 },
    );
    for (const id of list) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [key]);
  return active;
}
