/**
 * Additional types for Formedible field components
 */

import type { FieldConfig } from "@/lib/formedible/types";

/**
 * Sub-field configuration for object fields
 */
export interface SubFieldConfig extends FieldConfig {
  name: string;
  [key: string]: unknown;
}

/**
 * Duration value type
 */
export interface DurationValue {
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Date field value type
 */
export type DateFieldValue = string | Date | null | undefined;

