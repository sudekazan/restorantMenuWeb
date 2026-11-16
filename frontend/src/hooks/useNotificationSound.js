import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'qr_staff_sound';

// Her olay türü için kısa ton dizisi: [frekans (Hz), süre (sn)]
const PATTERNS = {
  order: [
    [660, 0.12],
    [880, 0.18],
  ],
  call: [
    [988, 0.09],
    [988, 0.09],
    [1319, 0.16],
  ],
  payment: [
    [523, 0.1],
    [784, 0.16],
  ],
};

function readEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

/**
 * Web Audio API ile dosyasız kısa bildirim sesleri üretir.
 * Tarayıcılar sesi ilk kullanıcı etkileşiminden sonra açtığı için
 * AudioContext ilk tıklama/dokunuşta hazırlanır.
 */
export function useNotificationSound() {
  const [enabled, setEnabled] = useState(readEnabled);
  const ctxRef = useRef(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const ensureContext = useCallback(() => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!ctxRef.current) ctxRef.current = new AudioCtx();
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume().catch(() => {});
    return ctxRef.current;
  }, []);

  useEffect(() => {
    const unlock = () => ensureContext();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, [ensureContext]);

  const play = useCallback(
    (kind = 'order') => {
      if (!enabledRef.current) return;
      const ctx = ensureContext();
      if (!ctx) return;

      let t = ctx.currentTime + 0.02;
      for (const [freq, duration] of PATTERNS[kind] || PATTERNS.order) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.25, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + duration + 0.02);
        t += duration + 0.05;
      }
    },
    [ensureContext]
  );

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
      } catch {
        // depolama kapalı olabilir; ayar yalnızca bu oturumda geçerli kalır
      }
      if (next) ensureContext();
      return next;
    });
  }, [ensureContext]);

  return { enabled, toggle, play };
}
