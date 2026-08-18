/** User-facing input or validation failure. Maps to HTTP 400. */
export class UserInputError extends Error {
  override readonly name = 'UserInputError'
}

export interface RouteErrorBody {
  readonly error: string
  readonly message?: string
}

/** Map a thrown error to an HTTP status and JSON body for route handlers. */
export function mapRouteError(error: unknown, fallbackCode: string): { readonly status: number; readonly body: RouteErrorBody } {
  if (error instanceof UserInputError) {
    return { status: 400, body: { error: fallbackCode, message: error.message } }
  }
  return { status: 400, body: { error: fallbackCode, message: error instanceof Error ? error.message : String(error) } }
}
