/** Short, collision-safe-enough id for locally-generated records. No dependency needed. */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
