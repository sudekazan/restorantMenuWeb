import { createContext, useContext } from 'react';

export const StaffContext = createContext(null);

/** Personel ekranının paylaşılan canlı durumu (siparişler, çağrılar, masalar, socket, yetkiler). */
export function useStaff() {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error('useStaff must be used within StaffApp');
  return ctx;
}

/** Kolon içi sürükle-bırak sırası: iki komşu kartın arasına düşen kanbanPosition. */
export function positionBetween(prev, next) {
  if (prev == null && next == null) return Date.now();
  if (prev == null) return next - 1024;
  if (next == null) return prev + 1024;
  return (prev + next) / 2;
}

export function sortByPosition(list) {
  return [...list].sort((a, b) => (a.kanbanPosition ?? 0) - (b.kanbanPosition ?? 0));
}
