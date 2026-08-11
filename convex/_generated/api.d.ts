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
import type * as migrations from "../migrations.js";
import type * as model_actor from "../model/actor.js";
import type * as model_auth from "../model/auth.js";
import type * as model_clients from "../model/clients.js";
import type * as model_errors from "../model/errors.js";
import type * as model_followUps from "../model/followUps.js";
import type * as model_inputLimits from "../model/inputLimits.js";
import type * as model_notes from "../model/notes.js";
import type * as model_sales from "../model/sales.js";
import type * as model_sessions from "../model/sessions.js";
import type * as model_users from "../model/users.js";
import type * as notes from "../notes.js";
import type * as sales from "../sales.js";
import type * as seed from "../seed.js";
import type * as sessions from "../sessions.js";
import type * as testHelpers from "../testHelpers.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  clients: typeof clients;
  followUps: typeof followUps;
  migrations: typeof migrations;
  "model/actor": typeof model_actor;
  "model/auth": typeof model_auth;
  "model/clients": typeof model_clients;
  "model/errors": typeof model_errors;
  "model/followUps": typeof model_followUps;
  "model/inputLimits": typeof model_inputLimits;
  "model/notes": typeof model_notes;
  "model/sales": typeof model_sales;
  "model/sessions": typeof model_sessions;
  "model/users": typeof model_users;
  notes: typeof notes;
  sales: typeof sales;
  seed: typeof seed;
  sessions: typeof sessions;
  testHelpers: typeof testHelpers;
  users: typeof users;
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
