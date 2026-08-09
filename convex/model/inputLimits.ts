// Cotas de tamaño (protección DoS), no política de contraseñas — se aplican
// a cualquier valor que vaya a tocar bcrypt (compareSync/truncates) antes de
// hacerlo. Viven en su propio módulo neutral para que convex/model/users.ts
// y convex/model/sessions.ts puedan importarlas sin depender uno del otro
// para esto (users.ts ya importa funciones de sessions.ts para
// changePassword; un ciclo de imports entre ambos rompería el build).
export const EMAIL_MAX_LENGTH = 200;
export const MAX_PASSWORD_INPUT_LENGTH = 1000;
