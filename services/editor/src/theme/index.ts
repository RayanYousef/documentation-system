/**
 * The editor's visual theme, as one module: Tailwind and the shadcn variables (mapped onto the palette),
 * the palette tokens and the app chrome. Import once from the entry point.
 * tailwind.css comes first: its `@layer` statement must be the first one in the bundle, or the layer order
 * (theme, base, chrome, components, utilities) changes.
 * Swapping the look means adding a sibling module and importing that instead; nothing else changes.
 */
import './tailwind.css';
import './tokens.css';
import './arcade.css';
