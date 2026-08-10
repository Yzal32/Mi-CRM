"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/Icon";

const AUTO_DISMISS_MS = 2600; // mismo tiempo que el mockup (Pantalla Mi Cuenta.dc.html)

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  // Ref, no dependencia directa: si el padre re-renderiza con una nueva
  // identidad de onDismiss (habitual con una arrow function inline), el
  // efecto no debe reiniciar el temporizador cada vez. Se actualiza en su
  // propio efecto (nunca durante el render, ver regla react-hooks/refs).
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    const timer = setTimeout(() => onDismissRef.current(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-20 z-40 flex items-center gap-2 rounded-full bg-primary-soft px-4 py-3 font-body-medium text-primary-soft-text shadow-md"
    >
      <Icon name="check" size={18} />
      <span>{message}</span>
    </div>
  );
}
