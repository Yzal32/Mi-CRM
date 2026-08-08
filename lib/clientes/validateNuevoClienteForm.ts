import { isValidEmail } from "../shared/isValidEmail";
import { normalizePhoneKey } from "../shared/normalizePhoneKey";

export type NuevoClienteFormValues = {
  name: string;
  phone: string;
  email: string;
};

export type NuevoClienteFormErrors = {
  name?: string;
  phone?: string;
  email?: string;
  form?: string;
};

const NAME_MAX_LENGTH = 200;

/**
 * Validación instantánea en cliente — mismo criterio y mismos mensajes que
 * convex/model/clients.ts (createClient), reusando las mismas funciones
 * puras compartidas (normalizePhoneKey, isValidEmail) para no duplicar el
 * cálculo. El duplicado de teléfono se queda fuera: solo puede resolverlo
 * el servidor.
 */
export function validateNuevoClienteForm(values: NuevoClienteFormValues): NuevoClienteFormErrors {
  const errors: NuevoClienteFormErrors = {};

  const name = values.name.trim();
  if (!name) {
    errors.name = "Introduce el nombre del cliente.";
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = "El nombre es demasiado largo.";
  }

  const phone = values.phone.trim();
  if (phone && !normalizePhoneKey(phone)) {
    errors.phone = "Ese teléfono no es válido.";
  }

  const email = values.email.trim();
  if (email && !isValidEmail(email)) {
    errors.email = "Ese email no es válido.";
  }

  if (!phone && !email) {
    errors.form = "Necesitas al menos un teléfono o un email para guardar el cliente.";
  }

  return errors;
}

export function hasFormErrors(errors: NuevoClienteFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
