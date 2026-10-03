/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as adapters_providers from "../adapters/providers.js";
import type * as admin from "../admin.js";
import type * as assessments from "../assessments.js";
import type * as care from "../care.js";
import type * as crons from "../crons.js";
import type * as workflows_delivery from "../workflows/delivery.js";
import type * as workflows_prepare from "../workflows/prepare.js";
import type * as workflows_process from "../workflows/process.js";
import type * as workflows_schedule from "../workflows/schedule.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  "adapters/providers": typeof adapters_providers;
  admin: typeof admin;
  assessments: typeof assessments;
  care: typeof care;
  crons: typeof crons;
  "workflows/delivery": typeof workflows_delivery;
  "workflows/prepare": typeof workflows_prepare;
  "workflows/process": typeof workflows_process;
  "workflows/schedule": typeof workflows_schedule;
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
