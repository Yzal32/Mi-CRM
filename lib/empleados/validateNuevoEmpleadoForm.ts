import { isValidEmail } from "../shared/isValidEmail";

export type NuevoEmpleadoFormValues = {
  name: string;
  email: string;
  password: string;
};

export type NuevoEmpleadoFormErrors = {
  name?: string;
  email?: string;
  password?: string;
  form?: string;
};

const NAME_MAX_LENGTH = 200;
const EMAIL_MAX_LENGTH = 200;
const PASSWORD_MIN_LENGTH = 8;
// Duplica MAX_PASSWORD_INPUT_LENGTH de convex/model/inputLimits.ts (mismo
// criterio que el resto de este archivo, que ya duplica límites del
// backend en vez de importar convex/model/* desde lib/). Solo cubre la
// longitud: el límite real de 72 bytes UTF-8 que aplica bcrypt (truncates())
// no se replica aquí — exigiría empaquetar bcryptjs en el cliente solo para
// un mensaje de feedback temprano, y el servidor ya lo rechaza igualmente.
const PASSWORD_MAX_LENGTH = 1000;

/**
 * Validación instantánea en cliente — mismo criterio y mismos mensajes que
 * convex/model/users.ts (createUser), reusando isValidEmail (misma función
 * pura que validateNuevoClienteForm).
 */
export function validateNuevoEmpleadoForm(values: NuevoEmpleadoFormValues): NuevoEmpleadoFormErrors {
  const errors: NuevoEmpleadoFormErrors = {};

  const name = values.name.trim();
  if (!name) {
    errors.name = "Introduce el nombre del empleado.";
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = "El nombre es demasiado largo.";
  }

  const email = values.email.trim();
  if (!email) {
    errors.email = "Introduce el email del empleado.";
  } else if (email.length > EMAIL_MAX_LENGTH || !isValidEmail(email)) {
    errors.email = "Ese email no es válido.";
  }

  if (!values.password) {
    errors.password = "Introduce una contraseña.";
  } else if (values.password.length > PASSWORD_MAX_LENGTH) {
    errors.password = "La contraseña es demasiado larga.";
  } else if (values.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }

  return errors;
}

export function hasFormErrors(errors: NuevoEmpleadoFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
