import { parseCurrencyEUR } from "../shared/formatCurrency";

export type RegistrarVentaFormValues = {
  description: string;
  amount: string;
};

export type RegistrarVentaFormErrors = {
  description?: string;
  amount?: string;
};

const DESCRIPTION_MAX_LENGTH = 300;
const AMOUNT_MIN_CENTS = 1;
const AMOUNT_MAX_CENTS = 999_999_999;

/**
 * Validación instantánea en cliente — mismo criterio y mismos mensajes que
 * convex/model/sales.ts (createSale), reusando parseCurrencyEUR para no
 * duplicar la gramática del importe.
 */
export function validateRegistrarVentaForm(values: RegistrarVentaFormValues): RegistrarVentaFormErrors {
  const errors: RegistrarVentaFormErrors = {};

  const description = values.description.trim();
  if (!description) {
    errors.description = "Describe qué se ha vendido.";
  } else if (description.length > DESCRIPTION_MAX_LENGTH) {
    errors.description = "La descripción es demasiado larga.";
  }

  const amountCents = parseCurrencyEUR(values.amount);
  if (amountCents === null || amountCents < AMOUNT_MIN_CENTS || amountCents > AMOUNT_MAX_CENTS) {
    errors.amount = "Introduce un importe válido.";
  }

  return errors;
}

export function hasFormErrors(errors: RegistrarVentaFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
