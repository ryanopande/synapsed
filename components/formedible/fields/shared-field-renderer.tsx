"use client";
import type { AnyFieldApi, AnyFormApi } from "@tanstack/react-form";
import React from "react";
import type { FieldComponentProps, FieldConfig } from "@/lib/formedible/types";
import type { SharedFieldRendererFieldConfig } from "@/lib/types/formedible";
import { resolveDynamicText } from "@/lib/formedible/template-interpolation";
import { TextField } from "./text-field";
import { TextareaField } from "./textarea-field";
import { SelectField } from "./select-field";
import { CheckboxField } from "./checkbox-field";
import { NumberField } from "./number-field";
import { RadioField } from "./radio-field";
import { MultiSelectField } from "./multi-select-field";
import type { FieldTypeComponentsRegistry } from "@/lib/types/formedible";

export const FIELD_TYPE_COMPONENTS: FieldTypeComponentsRegistry = {
  text: TextField,
  email: TextField,
  password: TextField,
  url: TextField,
  tel: TextField,
  textarea: TextareaField,
  select: SelectField,
  checkbox: CheckboxField,
  number: NumberField,
  radio: RadioField,
  multiSelect: MultiSelectField,
};

export const NestedFieldRenderer = <
  TFormValues extends Record<string, unknown>
>({
  fieldConfig,
  fieldApi,
  form,
  currentValues,
  resolveOptions,
}: SharedFieldRendererProps<TFormValues>) => {
  const formState = form?.state;
  const safeValues: TFormValues = (currentValues ??
    formState?.values ??
    {}) as TFormValues;

  const [subscribedValues, setSubscribedValues] =
    React.useState<TFormValues>(safeValues);

  React.useEffect(() => {
    if (!form) return;
    const unsubscribe = form.store.subscribe((state) => {
      // Access values directly from the state
      const values = (state as { values?: TFormValues }).values;
      if (values) {
        setSubscribedValues(values);
      }
    });
    return unsubscribe;
  }, [form]);

  const {
    type,
    label: rawLabel,
    placeholder: rawPlaceholder,
    description: rawDescription,
    options,
    component: CustomComponent,
    conditional,
    datalist,
    multiSelectConfig,
    numberConfig,
    textareaConfig,
    passwordConfig,
    emailConfig,
    min,
    max,
    step,
    accept,
    multiple,
  } = fieldConfig;

  const resolvedLabel = rawLabel
    ? resolveDynamicText(rawLabel, subscribedValues)
    : undefined;
  const resolvedPlaceholder = rawPlaceholder
    ? resolveDynamicText(rawPlaceholder, subscribedValues)
    : undefined;
  const resolvedDescription = rawDescription
    ? resolveDynamicText(rawDescription, subscribedValues)
    : undefined;

  if (conditional && !conditional(currentValues || subscribedValues)) {
    return null;
  }

  function renderActualField() {
    const FieldComponent =
      CustomComponent || FIELD_TYPE_COMPONENTS[type] || TextField;

    const resolvedOptionsList =
      options && resolveOptions
        ? resolveOptions(options, subscribedValues)
        : Array.isArray(options)
        ? options.map((opt) =>
            typeof opt === "string" ? { value: opt, label: opt } : opt
          )
        : [];

    const baseProps: FieldComponentProps = {
      fieldApi,
      label: resolvedLabel,
      placeholder: resolvedPlaceholder,
      description: resolvedDescription,
      min,
      max,
      step,
      accept,
      multiple,
    };

    const props: FieldComponentProps = { ...baseProps };

    if (type === "select" || type === "radio" || type === "multiSelect") {
      props.options = resolvedOptionsList;
    }

    if (["text", "email", "password", "url", "tel"].includes(type)) {
      props.type = type as "text" | "email" | "password" | "url" | "tel";
      if (datalist) {
        props.datalist = typeof datalist === "object" && "options" in datalist 
          ? datalist 
          : { options: datalist as string[] };
      }
    }

    if (type === "multiSelect") props.multiSelectConfig = multiSelectConfig;
    if (type === "number") props.numberConfig = numberConfig;
    if (type === "textarea") props.textareaConfig = textareaConfig;
    if (type === "password") props.passwordConfig = passwordConfig;
    if (type === "email") props.emailConfig = emailConfig;

    return <FieldComponent {...props} />;
  }

  return renderActualField();
};

export interface SharedFieldRendererProps<
  TFormValues extends Record<string, unknown>
> {
  fieldConfig: SharedFieldRendererFieldConfig;
  fieldApi: AnyFieldApi;
  form?: AnyFormApi;
  currentValues?: TFormValues;
  resolveOptions?: (
    options: FieldConfig["options"],
    currentValues: TFormValues
  ) => { value: string; label: string }[];
}

export const SharedFieldRenderer = <
  TFormValues extends Record<string, unknown>
>({
  fieldConfig,
  fieldApi,
  form,
  currentValues,
  resolveOptions,
}: SharedFieldRendererProps<TFormValues>) => {
  const formState = form?.state;
  const safeValues: TFormValues = (currentValues ??
    formState?.values ??
    {}) as TFormValues;

  const [subscribedValues, setSubscribedValues] =
    React.useState<TFormValues>(safeValues);

  React.useEffect(() => {
    if (!form) return;
    const unsubscribe = form.store.subscribe((state) => {
      // Access values directly from the state
      const values = (state as { values?: TFormValues }).values;
      if (values) {
        setSubscribedValues(values);
      }
    });
    return unsubscribe;
  }, [form]);

  const {
    type,
    label: rawLabel,
    placeholder: rawPlaceholder,
    description: rawDescription,
    options,
    component: CustomComponent,
    conditional,
    datalist,
    multiSelectConfig,
    numberConfig,
    textareaConfig,
    passwordConfig,
    emailConfig,
    min,
    max,
    step,
    accept,
    multiple,
  } = fieldConfig;

  const resolvedLabel = rawLabel
    ? resolveDynamicText(rawLabel, subscribedValues)
    : undefined;
  const resolvedPlaceholder = rawPlaceholder
    ? resolveDynamicText(rawPlaceholder, subscribedValues)
    : undefined;
  const resolvedDescription = rawDescription
    ? resolveDynamicText(rawDescription, subscribedValues)
    : undefined;

  if (conditional && !conditional(currentValues || subscribedValues)) {
    return null;
  }

  const FieldComponent =
    CustomComponent || FIELD_TYPE_COMPONENTS[type] || TextField;

  const resolvedOptionsList =
    options && resolveOptions
      ? resolveOptions(options, subscribedValues)
      : Array.isArray(options)
      ? options.map((opt) =>
          typeof opt === "string" ? { value: opt, label: opt } : opt
        )
      : [];

  const baseProps: FieldComponentProps = {
    fieldApi,
    label: resolvedLabel,
    placeholder: resolvedPlaceholder,
    description: resolvedDescription,
    min,
    max,
    step,
    accept,
    multiple,
  };

  const props: FieldComponentProps = { ...baseProps };

  if (type === "select" || type === "radio" || type === "multiSelect") {
    props.options = resolvedOptionsList;
  }

  if (["text", "email", "password", "url", "tel"].includes(type)) {
    props.type = type as "text" | "email" | "password" | "url" | "tel";
    if (datalist) {
      props.datalist = typeof datalist === "object" && "options" in datalist 
        ? datalist 
        : { options: datalist as string[] };
    }
  }

  if (type === "multiSelect") props.multiSelectConfig = multiSelectConfig;
  if (type === "number") props.numberConfig = numberConfig;
  if (type === "textarea") props.textareaConfig = textareaConfig;
  if (type === "password") props.passwordConfig = passwordConfig;
  if (type === "email") props.emailConfig = emailConfig;

  return <FieldComponent {...props} />;
};
