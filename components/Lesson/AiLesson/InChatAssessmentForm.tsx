"use client"

import { useState } from "react"
import { useFormedible } from "@/hooks/use-formedible"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import type { FieldConfig } from "@/lib/formedible/types"

interface FormedibleField extends FieldConfig {
  name: string
  type: "text" | "textarea" | "select" | "radio" | "multiselect" | "number" | "checkbox"
  label: string
  placeholder?: string
  options?: Array<{ value: string; label: string }>
  textareaConfig?: { rows: number }
  numberConfig?: { min?: number; max?: number; step?: number }
  multiSelectConfig?: { maxSelections: number; searchable?: boolean }
}

interface SchemaMetadata {
  type: string
  required?: boolean
  min?: number
  message?: string
}

interface InChatAssessmentFormProps {
  inChatAssessmentData: {
    type: "inChatAssessment"
    topic: string
    nodeTitle?: string
    difficulty: "beginner" | "intermediate" | "advanced"
    fields: FormedibleField[]
    schema: Record<string, SchemaMetadata>
    zodSchema?: z.ZodObject<Record<string, z.ZodTypeAny>>
    correctAnswers: Record<string, string | number | boolean | string[]>
  }
  assessmentId?: string
  conversationId?: string
  classId?: string
  lessonId?: string
  userId?: string
  onSubmitSuccess?: (feedback: string) => void
}

export function InChatAssessmentForm({
  inChatAssessmentData,
  assessmentId,
  conversationId,
  classId,
  lessonId,
  userId,
  onSubmitSuccess,
}: InChatAssessmentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  // Convert schema from JSON format to Zod schema
  const buildZodSchema = (schemaDef: Record<string, SchemaMetadata>): z.ZodObject<Record<string, z.ZodTypeAny>> => {
    const shape: Record<string, z.ZodTypeAny> = {}

    // Process each field to build Zod schema
    inChatAssessmentData.fields.forEach((field) => {
      const fieldName = field.name
      const fieldSchema = schemaDef[fieldName]

      if (!fieldSchema) {
        // Default schema based on field type
        switch (field.type) {
          case "text":
          case "textarea":
            shape[fieldName] = z.string().min(1, `${field.label || fieldName} is required`)
            break
          case "number":
            shape[fieldName] = z.number()
            break
          case "select":
          case "radio":
            shape[fieldName] = z.string().min(1, `${field.label || fieldName} is required`)
            break
          case "multiselect":
            shape[fieldName] = z.array(z.string()).min(1, `Please select at least one option for ${field.label || fieldName}`)
            break
          case "checkbox":
            shape[fieldName] = z.boolean()
            break
          default:
            shape[fieldName] = z.string()
        }
      } else {
        // Use provided schema definition
        let zodType: z.ZodTypeAny

        if (fieldSchema.type === "string") {
          zodType = z.string()
          if (fieldSchema.min !== undefined) {
            zodType = (zodType as z.ZodString).min(
              fieldSchema.min,
              fieldSchema.message || `Must be at least ${fieldSchema.min} characters`
            )
          }
        } else if (fieldSchema.type === "number") {
          zodType = z.number()
        } else {
          zodType = z.string()
        }

        shape[fieldName] = zodType
      }
    })

    return z.object(shape)
  }

  // Use zodSchema if available, otherwise build from schema metadata
  const schema = inChatAssessmentData.zodSchema || buildZodSchema(inChatAssessmentData.schema)

  // Build default values
  const defaultValues: Record<string, unknown> = {}
  inChatAssessmentData.fields.forEach((field) => {
    switch (field.type) {
      case "text":
      case "textarea":
      case "select":
      case "radio":
        defaultValues[field.name] = ""
        break
      case "multiselect":
        defaultValues[field.name] = []
        break
      case "number":
        defaultValues[field.name] = 0
        break
      case "checkbox":
        defaultValues[field.name] = false
        break
      default:
        defaultValues[field.name] = ""
    }
  })

  const { Form } = useFormedible({
    schema,
    fields: inChatAssessmentData.fields,
    formOptions: {
      defaultValues,
      onSubmit: async ({ value }) => {
        setIsSubmitting(true)
        setFeedback(null)

        try {
          const response = await fetch("/api/in-chat-assessment/submit", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assessmentId,
              inChatAssessmentData,
              responses: value,
              conversationId,
              classId,
              lessonId,
              userId,
            }),
          })

          if (!response.ok) {
            throw new Error("Failed to submit assessment")
          }

          const data = await response.json()
          setFeedback(data.feedback || "Thank you for completing the assessment!")
          
          if (onSubmitSuccess) {
            onSubmitSuccess(data.feedback || "Thank you for completing the assessment!")
          }
        } catch (error) {
          console.error("Error submitting assessment:", error)
          setFeedback("An error occurred while submitting your assessment. Please try again.")
        } finally {
          setIsSubmitting(false)
        }
      },
    },
  })

  if (feedback) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 my-4">
        <h3 className="font-semibold text-green-900 mb-2">Pulse Check Complete!</h3>
        <div className="text-green-800 whitespace-pre-wrap">{feedback}</div>
      </div>
    )
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-4">
      <div className="mb-4">
        <h3 className="font-semibold text-blue-900 mb-1">
          In-Chat Pulse Check: {inChatAssessmentData.topic}
        </h3>
        {inChatAssessmentData.nodeTitle && (
          <p className="text-sm text-blue-700">Topic: {inChatAssessmentData.nodeTitle}</p>
        )}
        <p className="text-xs text-blue-600 mt-1">
          Difficulty: {inChatAssessmentData.difficulty}
        </p>
      </div>
      
      <Form />
      
      {isSubmitting && (
        <div className="mt-4 flex items-center gap-2 text-blue-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Submitting your answers...</span>
        </div>
      )}
    </div>
  )
}

