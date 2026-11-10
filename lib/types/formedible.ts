/**
 * Formedible-specific TypeScript types
 */

import type { FieldConfig, FieldComponentProps } from "@/lib/formedible/types";
import type React from "react";

/**
 * Form state subscription callback type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FormStateSubscriptionCallback = (state: any) => void;

/**
 * Form store subscription return type
 */
export type FormStoreUnsubscribe = () => void;

/**
 * Field component type - accepts FieldComponentProps
 */
export type FieldComponent = React.ComponentType<FieldComponentProps>;

/**
 * Field type components registry
 */
export type FieldTypeComponentsRegistry = Record<string, FieldComponent>;

/**
 * Array field item configuration
 */
export interface ArrayFieldItemConfig extends FieldConfig {
  name: string;
  type: string;
  label?: string;
  placeholder?: string;
  component?: React.ComponentType<FieldComponentProps>;
  [key: string]: unknown;
}

/**
 * Object field subscription values state
 */
export interface ObjectFieldSubscribedValues<TFormValues = Record<string, unknown>> {
  values: TFormValues;
}

/**
 * Shared field renderer props with proper typing
 */
export interface SharedFieldRendererFieldConfig extends FieldConfig {
  crossFieldError?: string;
  asyncValidationState?: {
    isValidating?: boolean;
    error?: string;
    [key: string]: unknown;
  };
  wrapperClassName?: string;
  labelClassName?: string;
  disabled?: boolean;
}

/**
 * Form store state with values
 */
export interface FormStoreStateWithValues<TFormValues = Record<string, unknown>> {
  values: TFormValues;
  [key: string]: unknown;
}

