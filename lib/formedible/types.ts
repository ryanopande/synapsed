import React from "react";
import type { AnyFieldApi } from "@tanstack/react-form";
import type {
  FormApi,
  ValidationError,
  FormState,
} from "@tanstack/form-core";
import { z } from "zod";

// Strict type definitions for better type safety
export interface StrictFieldApi<T = unknown> {
  name: string;
  value: T;
  errors: ValidationError[];
  touched: boolean;
  setValue: (value: T) => void;
  setTouched: (touched: boolean) => void;
  validate: () => Promise<ValidationError[]>;
}

export interface TypedFormState<TFormData = Record<string, unknown>> {
  values: TFormData;
  errors: Record<keyof TFormData, ValidationError[]>;
  touched: Record<keyof TFormData, boolean>;
  isSubmitting: boolean;
  isValidating: boolean;
  canSubmit: boolean;
}

export interface TypedFormSubscriptionSelector<
  TFormData = Record<string, unknown>,
  TSelected = unknown
> {
  (
    state: FormState<
      TFormData,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    >
  ): TSelected;
}

// Validation error types based on TanStack Form
export type FormedibleValidationError = ValidationError;

// Validation error that can be a string, Error object, or custom validation result
export type FieldValidationError = string | Error | ValidationError;

// Array of validation errors for a field
export type FieldValidationErrors = FieldValidationError[];

// Dynamic text types for template interpolation
export type DynamicText =
  | string
  | ((values: Record<string, unknown>) => string);
export type OptionalDynamicText = DynamicText | undefined;

// Type alias for our FormApi - use the core FormApi type which is what useForm actually returns
export type FormedibleFormApi<TFormData = Record<string, unknown>> = FormApi<
  TFormData,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  never
>;

// Option types for select, radio, and multi-select fields
export type FieldOption = {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
};

export type FieldOptions = string[] | FieldOption[];

// Normalize options to consistent format
export type NormalizedFieldOption = FieldOption;

// Props that all basic field components rendered by FormedibleRoot will receive
export interface BaseFieldProps {
  fieldApi: AnyFieldApi;
  label?: string;
  description?: string;
  placeholder?: string;
  inputClassName?: string; // For the <Input /> component itself
  labelClassName?: string; // For the <Label /> component
  wrapperClassName?: string; // For the div wrapping label and input
}

// Specific field component prop types
export interface SelectFieldProps extends BaseFieldProps {
  options: FieldOptions;
  placeholder?: string;
}

export interface RadioFieldProps extends BaseFieldProps {
  options: FieldOptions;
}

export interface MultiSelectFieldProps extends BaseFieldProps {
  options: FieldOptions;
  placeholder?: string;
  maxSelections?: number;
}



export interface TextFieldProps extends BaseFieldProps {
  type?: "text" | "email" | "password" | "url" | "tel";
  datalist?: string[];
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  autoComplete?: string;
}

export interface NumberFieldProps extends BaseFieldProps {
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
}


// Field-specific interfaces moved from field components for centralization
export interface TextFieldSpecificProps extends BaseFieldProps {
  type?: "text" | "email" | "password" | "url" | "tel" | "datetime-local";
  datalist?: {
    options?: string[];
    asyncOptions?: (query: string) => Promise<string[]>;
    debounceMs?: number;
    minChars?: number;
    maxResults?: number;
  };
}

export interface NumberFieldSpecificProps extends BaseFieldProps {
  min?: number;
  max?: number;
  step?: number;
}

export interface TextareaFieldSpecificProps extends BaseFieldProps {
  rows?: number;
}

export interface RadioFieldSpecificProps extends BaseFieldProps {
  options: Array<{ value: string; label: string }> | string[];
  direction?: "horizontal" | "vertical";
}

export interface MultiSelectFieldSpecificProps extends BaseFieldProps {
  options: Array<{ value: string; label: string }> | string[];
  multiSelectConfig?: {
    maxSelections?: number;
    searchable?: boolean;
    creatable?: boolean;
    placeholder?: string;
    noOptionsText?: string;
    loadingText?: string;
  };
}

// Layout component interfaces moved from layout components for centralization
export interface FormGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  gap?:
    | "0"
    | "1"
    | "2"
    | "3"
    | "4"
    | "5"
    | "6"
    | "7"
    | "8"
    | "9"
    | "10"
    | "11"
    | "12";
  responsive?: boolean;
  className?: string;
}

export interface FormTabsProps {
  children?: React.ReactNode;
  tabs: {
    id: string;
    label: string;
    content: React.ReactNode;
  }[];
  activeTab: string; // CONTROLLED - NO INTERNAL STATE
  className?: string;
  onTabChange: (tabId: string) => void; // REQUIRED - PARENT CONTROLS STATE
}


// Wrapper component interfaces moved from field components for centralization
export interface FieldWrapperProps extends BaseFieldProps {
  children: React.ReactNode;
  htmlFor?: string;
  showErrors?: boolean;
}

export interface InlineValidationWrapperProps {
  children: React.ReactNode;
  fieldApi: AnyFieldApi;
  inlineValidation?: {
    enabled?: boolean;
    debounceMs?: number;
    showSuccess?: boolean;
    asyncValidator?: (value: unknown) => Promise<string | null>;
  };
  className?: string;
}

// Union type for all possible field component props - using intersection for flexibility
export type FieldComponentProps = BaseFieldProps & {
  // Optional props that specific field types might need
  options?: FieldOptions;
  type?: TextFieldProps["type"];
  datalist?: DatalistConfig;
  // Legacy support for existing configurations
  multiSelectConfig?: {
    maxSelections?: number;
    searchable?: boolean;
    creatable?: boolean;
    placeholder?: string;
    noOptionsText?: string;
    loadingText?: string;
  };
  // Allow additional props for extensibility
  [key: string]: unknown;
};

// Cross-field validation configuration
export interface CrossFieldValidation<TFormValues = Record<string, unknown>> {
  fields: (keyof TFormValues)[];
  validator: (values: Partial<TFormValues>) => string | null;
  message: string;
}

// Async validation configuration
export interface AsyncValidation {
  validator: (value: unknown) => Promise<string | null>;
  debounceMs?: number;
  loadingMessage?: string;
}

// Enhanced form analytics and tracking configuration
export interface FormAnalytics {
  // Field-level analytics
  onFieldFocus?: (fieldName: string, timestamp: number) => void;
  onFieldBlur?: (fieldName: string, timeSpent: number) => void;
  onFieldChange?: (
    fieldName: string,
    value: unknown,
    timestamp: number
  ) => void;
  onFieldComplete?: (
    fieldName: string,
    isValid: boolean,
    timeSpent: number
  ) => void;
  onFieldError?: (
    fieldName: string,
    errors: string[],
    timestamp: number
  ) => void;

  // Form-level analytics
  onFormStart?: (timestamp: number) => void;
  onFormComplete?: (timeSpent: number, formData: unknown) => void;
  onFormAbandon?: (
    completionPercentage: number,
    context?: {
      currentPage?: number;
      currentTab?: string;
      lastActiveField?: string;
    }
  ) => void;
  onFormReset?: (timestamp: number, reason?: string) => void;

  // Page-level analytics (for multi-page forms)
  onPageChange?: (
    fromPage: number,
    toPage: number,
    timeSpent: number,
    pageValidationState?: { hasErrors: boolean; completionPercentage: number }
  ) => void;
  onPageComplete?: (
    pageNumber: number,
    timeSpent: number,
    fieldsCompleted: number,
    totalFields: number
  ) => void;
  onPageAbandon?: (
    pageNumber: number,
    completionPercentage: number,
    timeSpent: number
  ) => void;
  onPageValidationError?: (
    pageNumber: number,
    errors: Record<string, string[]>,
    timestamp: number
  ) => void;

  // Tab-level analytics (for tabbed forms)
  onTabChange?: (
    fromTab: string,
    toTab: string,
    timeSpent: number,
    tabCompletionState?: { completionPercentage: number; hasErrors: boolean }
  ) => void;
  onTabComplete?: (
    tabId: string,
    timeSpent: number,
    fieldsCompleted: number,
    totalFields: number
  ) => void;
  onTabAbandon?: (
    tabId: string,
    completionPercentage: number,
    timeSpent: number
  ) => void;
  onTabValidationError?: (
    tabId: string,
    errors: Record<string, string[]>,
    timestamp: number
  ) => void;
  onTabFirstVisit?: (tabId: string, timestamp: number) => void;

  // Performance analytics
  onRenderPerformance?: (
    componentName: string,
    renderTime: number,
    rerenderCount: number
  ) => void;
  onValidationPerformance?: (
    fieldName: string,
    validationType: "sync" | "async",
    duration: number
  ) => void;
  onSubmissionPerformance?: (
    submissionTime: number,
    validationTime: number,
    processingTime: number
  ) => void;
}

// Tab analytics state tracking
export interface TabAnalyticsState {
  tabId: string;
  startTime: number;
  visitCount: number;
  fieldsCompleted: number;
  totalFields: number;
  hasErrors: boolean;
  lastActiveField?: string;
  completionPercentage: number;
}

// Page analytics state tracking
export interface PageAnalyticsState {
  pageNumber: number;
  startTime: number;
  visitCount: number;
  fieldsCompleted: number;
  totalFields: number;
  hasErrors: boolean;
  lastActiveField?: string;
  completionPercentage: number;
  validationErrors: Record<string, string[]>;
}

// Performance tracking metrics
export interface PerformanceMetrics {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  validationDurations: Record<string, number[]>;
  submissionMetrics: {
    totalTime: number;
    validationTime: number;
    processingTime: number;
  };
}

// Analytics context for tracking form interaction patterns
export interface AnalyticsContext {
  sessionId: string;
  formId: string;
  userId?: string;
  currentPage?: number;
  currentTab?: string;
  startTime: number;
  pageStates: Record<number, PageAnalyticsState>;
  tabStates: Record<string, TabAnalyticsState>;
  performanceMetrics: PerformanceMetrics;
  fieldInteractions: Record<
    string,
    {
      focusCount: number;
      totalTimeSpent: number;
      changeCount: number;
      errorCount: number;
      isCompleted: boolean;
    }
  >;
}

// Layout configuration for forms
export interface LayoutConfig {
  type: "grid" | "flex" | "tabs" | "accordion" | "stepper";
  columns?: number;
  gap?: string;
  responsive?: boolean;
  className?: string;
}

// Conditional sections configuration
export interface ConditionalSection<TFormValues = Record<string, unknown>> {
  condition: (values: TFormValues) => boolean;
  fields: string[];
  layout?: LayoutConfig;
}


// Duration picker configuration
export interface DurationValue {
  hours?: number;
  minutes?: number;
  seconds?: number;
  totalSeconds?: number;
}

export interface DurationConfig {
  format?: "hms" | "hm" | "ms" | "hours" | "minutes" | "seconds";
  maxHours?: number;
  maxMinutes?: number;
  maxSeconds?: number;
  showLabels?: boolean;
  allowNegative?: boolean;
}

// Autocomplete configuration
export interface AutocompleteConfig {
  options?: string[] | { value: string; label: string }[];
  asyncOptions?: (
    query: string
  ) => Promise<string[] | { value: string; label: string }[]>;
  debounceMs?: number;
  minChars?: number;
  maxResults?: number;
  allowCustom?: boolean;
  placeholder?: string;
  noOptionsText?: string;
  loadingText?: string;
}

// Masked input configuration
export interface MaskedInputConfig {
  mask: string | ((value: string) => string);
  placeholder?: string;
  showMask?: boolean;
  guide?: boolean;
  keepCharPositions?: boolean;
  pipe?: (
    conformedValue: string,
    config: unknown
  ) => false | string | { value: string; indexesOfPipedChars: number[] };
}

// Field validation configuration
export interface FieldValidationConfig {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  custom?: string;
  includes?: string;
  startsWith?: string;
  endsWith?: string;
  email?: boolean;
  url?: boolean;
  uuid?: boolean;
  transform?: string;
  refine?: string;
  customMessages?: Record<string, string>;
}

// Help configuration for fields
export interface FieldHelpConfig {
  text?: string;
  tooltip?: string;
  position?: "top" | "bottom" | "left" | "right";
  link?: { url: string; text: string };
}

// Inline validation configuration
export interface InlineValidationConfig {
  enabled?: boolean;
  debounceMs?: number;
  showSuccess?: boolean;
  asyncValidator?: (value: unknown) => Promise<string | null>;
}

// Section configuration
export interface SectionConfig {
  title?: string;
  description?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

// Datalist configuration
export interface DatalistConfig {
  options?: string[];
  asyncOptions?: (query: string) => Promise<string[]>;
  debounceMs?: number;
  minChars?: number;
  maxResults?: number;
}

// Textarea configuration
export interface TextareaConfig {
  rows?: number;
  cols?: number;
  resize?: "none" | "vertical" | "horizontal" | "both";
  maxLength?: number;
  showWordCount?: boolean;
}

// Password configuration
export interface PasswordConfig {
  showToggle?: boolean;
  strengthMeter?: boolean;
  minStrength?: number;
  requirements?: {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSymbols?: boolean;
  };
}

// Email configuration
export interface EmailConfig {
  allowedDomains?: string | string[];
  blockedDomains?: string | string[];
  suggestions?: string | string[];
  validateMX?: boolean;
}

// Number configuration
export interface NumberConfig {
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  allowNegative?: boolean;
  showSpinButtons?: boolean;
}

// Multi-select configuration
export interface MultiSelectConfig {
  maxSelections?: number;
  searchable?: boolean;
  creatable?: boolean;
  placeholder?: string;
  noOptionsText?: string;
  loadingText?: string;
}

// Combobox configuration
export interface ComboboxConfig {
  searchable?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  noOptionsText?: string;
  allowClear?: boolean;
}

// Hook interfaces moved from use-formedible.tsx for centralization
export interface FormProps {
  className?: string;
  children?: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  // HTML form attributes
  action?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  encType?:
    | "application/x-www-form-urlencoded"
    | "multipart/form-data"
    | "text/plain";
  target?: "_blank" | "_self" | "_parent" | "_top" | string;
  autoComplete?: "on" | "off";
  noValidate?: boolean;
  acceptCharset?: string;
  // Event handlers
  onReset?: (e: React.FormEvent) => void;
  onInput?: (e: React.FormEvent) => void;
  onInvalid?: (e: React.FormEvent) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onKeyUp?: (e: React.KeyboardEvent) => void;
  onFocus?: (e: React.FocusEvent) => void;
  onBlur?: (e: React.FocusEvent) => void;
  // Accessibility
  role?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  tabIndex?: number;
}

export interface ConditionalFieldsSubscriptionProps<
  TFormValues extends Record<string, unknown> = Record<string, unknown>
> {
  form: FormedibleFormApi<TFormValues>;
  fields: FieldConfig[];
  conditionalSections: Array<{
    condition: (values: TFormValues) => boolean;
    fields: string[];
    layout?: {
      type: "grid" | "flex" | "tabs" | "accordion" | "stepper";
      columns?: number;
      gap?: string;
      responsive?: boolean;
      className?: string;
    };
  }>;
  children: (currentValues: Record<string, unknown>) => React.ReactNode;
}

export interface FieldConditionalRendererProps<TFormValues extends Record<string, unknown> = Record<string, unknown>> {
  form: FormedibleFormApi<TFormValues>;
  fieldConfig: FieldConfig;
  children: (shouldRender: boolean) => React.ReactNode;
}

export interface SectionRendererProps {
  sectionKey: string;
  sectionData: {
    section?: {
      title?: string;
      description?: string;
      collapsible?: boolean;
      defaultExpanded?: boolean;
    };
    groups: Record<string, FieldConfig[]>;
  };
  renderField: (field: FieldConfig) => React.ReactNode;
}

export interface UseFormedibleOptions<TFormValues> {
  fields?: FieldConfig[];
  schema?: z.ZodSchema<TFormValues>;
  title?: string;
  description?: string;
  submitLabel?: string;
  nextLabel?: string;
  previousLabel?: string;
  // Translation support for section buttons
  collapseLabel?: string;
  expandLabel?: string;
  formClassName?: string;
  fieldClassName?: string;
  labelClassName?: string;
  buttonClassName?: string;
  submitButtonClassName?: string;
  // Auto scroll configuration
  autoScroll?: boolean;
  submitButton?: React.ComponentType<
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
      children?: React.ReactNode;
    }
  >;
  pages?: PageConfig[];
  progress?: ProgressConfig;
  tabs?: {
    id: string;
    label: string;
    description?: string;
  }[];
  defaultComponents?: {
    [key: string]: React.ComponentType<FieldComponentProps>;
  };
  globalWrapper?: React.ComponentType<{
    children: React.ReactNode;
    field: FieldConfig;
  }>;
  formOptions?: Partial<{
    defaultValues: TFormValues;
    onSubmit: (props: {
      value: TFormValues;
      formApi: FormedibleFormApi<TFormValues>;
    }) => unknown | Promise<unknown>;
    onSubmitInvalid: (props: {
      value: TFormValues;
      formApi: FormedibleFormApi<TFormValues>;
    }) => void;
    onChange?: (props: {
      value: TFormValues;
      formApi: FormedibleFormApi<TFormValues>;
    }) => void;
    onBlur?: (props: {
      value: TFormValues;
      formApi: FormedibleFormApi<TFormValues>;
    }) => void;
    onFocus?: (props: {
      value: TFormValues;
      formApi: FormedibleFormApi<TFormValues>;
    }) => void;
    onReset?: (props: {
      value: TFormValues;
      formApi: FormedibleFormApi<TFormValues>;
    }) => void;
    asyncDebounceMs: number;
    canSubmitWhenInvalid: boolean;
  }>;
  onPageChange?: (page: number, direction: "next" | "previous") => void;
  autoSubmitOnChange?: boolean;
  autoSubmitDebounceMs?: number;
  disabled?: boolean;
  loading?: boolean;
  resetOnSubmitSuccess?: boolean;
  showSubmitButton?: boolean;
  // Form-level event handlers
  onFormReset?: (
    e: React.FormEvent,
    formApi: FormedibleFormApi<TFormValues>
  ) => void;
  onFormInput?: (
    e: React.FormEvent,
    formApi: FormedibleFormApi<TFormValues>
  ) => void;
  onFormInvalid?: (
    e: React.FormEvent,
    formApi: FormedibleFormApi<TFormValues>
  ) => void;
  onFormKeyDown?: (
    e: React.KeyboardEvent,
    formApi: FormedibleFormApi<TFormValues>
  ) => void;
  onFormKeyUp?: (
    e: React.KeyboardEvent,
    formApi: FormedibleFormApi<TFormValues>
  ) => void;
  onFormFocus?: (
    e: React.FocusEvent,
    formApi: FormedibleFormApi<TFormValues>
  ) => void;
  onFormBlur?: (
    e: React.FocusEvent,
    formApi: FormedibleFormApi<TFormValues>
  ) => void;
  // Advanced validation features
  crossFieldValidation?: {
    fields: (keyof TFormValues)[];
    validator: (values: Partial<TFormValues>) => string | null;
    message: string;
  }[];
  asyncValidation?: {
    [fieldName: string]: {
      validator: (value: unknown) => Promise<string | null>;
      debounceMs?: number;
      loadingMessage?: string;
    };
  };
  // Form analytics and tracking
  analytics?: FormAnalytics;
  // Layout configuration
  layout?: {
    type: "grid" | "flex" | "tabs" | "accordion" | "stepper";
    columns?: number;
    gap?: string;
    responsive?: boolean;
    className?: string;
  };
  // Conditional sections
  conditionalSections?: {
    condition: (values: TFormValues) => boolean;
    fields: string[];
    layout?: {
      type: "grid" | "flex" | "tabs" | "accordion" | "stepper";
      columns?: number;
      gap?: string;
      responsive?: boolean;
      className?: string;
    };
  }[];
  // Form persistence
  persistence?: {
    key: string;
    storage: "localStorage" | "sessionStorage";
    debounceMs?: number;
    exclude?: string[];
    restoreOnMount?: boolean;
  };
}

// Main FieldConfig interface - DRY version using existing types
export interface FieldConfig {
  name: string;
  type: string;
  label?: DynamicText;
  placeholder?: DynamicText;
  description?: DynamicText;
  required?: boolean;
  defaultValue?: unknown;
  options?:
    | string[]
    | { value: string; label: string }[]
    | ((
        values: Record<string, unknown>
      ) => string[] | { value: string; label: string }[]);
  min?: number;
  max?: number;
  step?: number;
  accept?: string;
  multiple?: boolean;
  component?: React.ComponentType<FieldComponentProps>;
  wrapper?: React.ComponentType<{
    children: React.ReactNode;
    field: FieldConfig;
  }>;
  page?: number;
  tab?: string;
  validation?: z.ZodSchema<unknown>;
  dependencies?: string[];
  conditional?: (values: Record<string, unknown>) => boolean;
  group?: string;

  // Grid positioning properties
  gridColumn?: number; // Specific column to place this field (1-based)
  gridRow?: number; // Specific row to place this field (1-based)
  gridColumnSpan?: number; // How many columns this field should span
  gridRowSpan?: number; // How many rows this field should span
  gridArea?: string; // CSS grid-area value for advanced positioning

  // Configuration objects using existing types
  multiSelectConfig?: MultiSelectConfig;
  numberConfig?: NumberConfig;
  textareaConfig?: TextareaConfig;
  passwordConfig?: PasswordConfig;
  emailConfig?: EmailConfig;

  // Additional configurations
  datalist?: DatalistConfig;
  help?: FieldHelpConfig;
  inlineValidation?: InlineValidationConfig;
  section?: SectionConfig;
  validationConfig?: FieldValidationConfig;

  // Allow additional unknown configurations for extensibility
  [key: string]: unknown;
}

// Page configuration for multi-page forms
export interface PageConfig {
  page: number;
  title?: string;
  description?: string;
  component?: React.ComponentType<{
    children: React.ReactNode;
    title?: string;
    description?: string;
    page: number;
    totalPages: number;
  }>;
  conditional?: (values: Record<string, unknown>) => boolean;
}

// Progress configuration for multi-page forms
export interface ProgressConfig {
  component?: React.ComponentType<{
    value: number;
    currentPage: number;
    totalPages: number;
    className?: string;
  }>;
  showSteps?: boolean;
  showPercentage?: boolean;
  className?: string;
}
