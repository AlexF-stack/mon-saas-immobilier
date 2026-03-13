import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type ApiErrorPayload =
  | string
  | { message?: string }
  | { error?: unknown }
  | Array<{ message?: string }>
  | null
  | undefined

export function getErrorMessageFromPayload(
  payload: ApiErrorPayload | unknown,
  fallback: string
): string {
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim()
  }

  if (Array.isArray(payload)) {
    const first = payload[0]
    if (first && typeof first.message === 'string' && first.message.trim()) {
      return first.message.trim()
    }
  }

  if (payload && typeof payload === 'object') {
    const inner = (payload as { message?: unknown }).message
    if (typeof inner === 'string' && inner.trim()) {
      return inner.trim()
    }

    const nestedError = (payload as { error?: unknown }).error
    if (typeof nestedError === 'string' && nestedError.trim()) {
      return nestedError.trim()
    }
    if (
      Array.isArray(nestedError) &&
      typeof nestedError[0]?.message === 'string' &&
      nestedError[0].message.trim()
    ) {
      return nestedError[0].message.trim()
    }
  }

  return fallback
}
