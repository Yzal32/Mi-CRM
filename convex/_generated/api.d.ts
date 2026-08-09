/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as clients from "../clients.js";
import type * as followUps from "../followUps.js";
import type * as model_actor from "../model/actor.js";
import type * as model_clients from "../model/clients.js";
import type * as model_errors from "../model/errors.js";
import type * as model_followUps from "../model/followUps.js";
import type * as model_notes from "../model/notes.js";
import type * as model_sales from "../model/sales.js";
import type * as notes from "../notes.js";
import type * as sales from "../sales.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  clients: typeof clients;
  followUps: typeof followUps;
  "model/actor": typeof model_actor;
  "model/clients": typeof model_clients;
  "model/errors": typeof model_errors;
  "model/followUps": typeof model_followUps;
  "model/notes": typeof model_notes;
  "model/sales": typeof model_sales;
  notes: typeof notes;
  sales: typeof sales;
  seed: typeof seed;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
