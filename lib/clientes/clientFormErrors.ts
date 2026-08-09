import type { NuevoClienteFormErrors } from "./validateNuevoClienteForm";

const GENERIC_SAVE_ERROR = "No se pudo guardar el cliente. Inténtalo de nuevo.";

/**
 * Mapea el código de error del servidor (createClient/updateClient en
 * convex/model/clients.ts, mismos códigos en ambos) a los mismos mensajes
 * por campo que ya usa la validación instantánea de cliente
 * (validateNuevoClienteForm) — deliberadamente duplicada respecto a la
 * función equivalente de components/clientes/NuevoClienteScreen.tsx: esa
 * pantalla pertenece a otra tarea de Linear (PRO-9/PRO-20, todavía en
 * curso), así que no se toca ni se reutiliza desde ahí.
 */
export function clientFormErrorsFromConvexCode(code: string | undefined): NuevoClienteFormErrors {
  switch (code) {
    case "DUPLICATE_PHONE":
      return { phone: "Ya existe un cliente con este teléfono." };
    case "INVALID_PHONE":
      return { phone: "Ese teléfono no es válido." };
    case "INVALID_EMAIL":
      return { email: "Ese email no es válido." };
    case "NAME_REQUIRED":
      return { name: "Introduce el nombre del cliente." };
    case "NAME_TOO_LONG":
      return { name: "El nombre es demasiado largo." };
    case "CONTACT_REQUIRED":
      return { form: "Necesitas al menos un teléfono o un email para guardar el cliente." };
    default:
      return { form: GENERIC_SAVE_ERROR };
  }
}
