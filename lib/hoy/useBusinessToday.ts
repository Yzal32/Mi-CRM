"use client";

import { useEffect, useState } from "react";
import { businessDayKey } from "@/lib/shared/businessDay";

// Recálculo periódico en vez de programar el instante exacto de la próxima
// medianoche de Madrid (frágil con setTimeout: dependería de la zona del
// dispositivo, no de Europe/Madrid). Retraso máximo tras un cruce real de
// medianoche: 60s — aceptable para este caso de uso.
const RECHECK_INTERVAL_MS = 60_000;

export function useBusinessToday(): string {
  const [today, setToday] = useState(() => businessDayKey());

  useEffect(() => {
    const interval = setInterval(() => {
      const current = businessDayKey();
      setToday((previous) => (previous === current ? previous : current));
    }, RECHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return today;
}
