"use client";

import { useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import { useConvexAccessToken } from "@/components/providers/ConvexAccessTokenProvider";

type WithoutToken<Args> = Omit<Args, "token">;

/**
 * Envoltorio de `useQuery` para las 14 funciones públicas de negocio
 * protegidas por PRO-59 (todas exigen `token` como primer argumento — ver
 * convex/model/auth.ts): inyecta el accessToken vigente automáticamente, así
 * ningún componente lo lee ni lo pasa a mano.
 *
 * Un `"skip"` explícito del consumidor SIEMPRE se respeta, con o sin token
 * disponible — nunca se intenta construir `{ ...("skip"), token }`.
 * Mientras no hay token (todavía no emitido, o se acaba de perder tras un
 * error de autenticación), la query subyacente también recibe "skip": nunca
 * se llama con argumentos a medias, sin `token`.
 */
export function useAuthedQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: WithoutToken<FunctionArgs<Query>> | "skip",
): FunctionReturnType<Query> | undefined {
  const token = useConvexAccessToken();
  const effectiveArgs = args === "skip" || token === undefined ? "skip" : ({ ...args, token } as FunctionArgs<Query>);
  return useQuery(query, effectiveArgs as never);
}

/**
 * Envoltorio de `useMutation` para las mismas funciones: memoiza la función
 * devuelta con `useCallback([token, mutate])`, así que un componente que la
 * pase como prop o dependencia de efecto no la ve cambiar en cada render.
 * Sin token disponible, rechaza sin invocar la mutation real — nunca llega
 * a llamar a Convex con un `token` vacío o `undefined`.
 */
export function useAuthedMutation<Mutation extends FunctionReference<"mutation">>(
  mutation: Mutation,
): (args: WithoutToken<FunctionArgs<Mutation>>) => Promise<FunctionReturnType<Mutation>> {
  const token = useConvexAccessToken();
  const mutate = useMutation(mutation);
  return useCallback(
    (args: WithoutToken<FunctionArgs<Mutation>>) => {
      if (token === undefined) {
        return Promise.reject(new Error("No hay una sesión verificada todavía."));
      }
      return mutate({ ...args, token } as FunctionArgs<Mutation>);
    },
    [token, mutate],
  );
}
