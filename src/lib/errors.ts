/**
 * Pulls a readable message out of whatever was thrown. Supabase errors come
 * in several shapes (Error subclasses, plain { message } objects), and a bare
 * `err instanceof Error` check silently drops the message for some of them.
 */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.') {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}
