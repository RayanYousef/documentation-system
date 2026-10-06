/**
 * Decides when the page counts as changed. The baseline is the export of the freshly loaded page, so
 * loading and normalising never count: only an edit that changes the written Markdown does.
 */
export interface ChangeTracker { isChanged(current: string): boolean }

export function createChangeTracker(baseline: string): ChangeTracker {
  return { isChanged: (current) => current !== baseline };
}
