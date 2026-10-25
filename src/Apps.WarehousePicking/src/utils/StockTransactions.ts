/** Returns the server-provided message without a JavaScript Error prefix. */
export function errorText(error: unknown): string {
  return String(error).replace(/^Error:\s*/, "");
}