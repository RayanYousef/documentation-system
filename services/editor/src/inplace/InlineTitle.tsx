// The page title (frontmatter `title`) edited where the page shows it: an input styled as the page's h1.
export function InlineTitle({ value, readOnly, onChange }: { value: string; readOnly: boolean; onChange(next: string): void }) {
  return (
    <header className="ped-title">
      <input aria-label="Page title" className="ped-title-input" value={value} readOnly={readOnly} placeholder="Page title" spellCheck
        onChange={(e) => onChange(e.target.value)} />
    </header>
  );
}
