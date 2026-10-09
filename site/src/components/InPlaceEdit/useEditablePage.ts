// Whether the current doc can be edited in place (Latest docs, not generated files, editing enabled).
import { useDoc } from '@docusaurus/plugin-content-docs/client';
import { usePluginData } from '@docusaurus/useGlobalData';
import { toEditablePage, type EditablePage } from '@site/src/platform/inplace/pagePath';

export interface EditableState {
  /** The page to edit, or null. */
  page: EditablePage | null;
  /** A page of a frozen version (never editable; no edit link at all). */
  frozen: boolean;
}

export function useEditablePage(): EditableState {
  const { metadata } = useDoc();
  const data = usePluginData('platform-inplace-edit') as { enabled?: boolean } | undefined;
  const frozen = metadata.version !== 'current';
  const page = data?.enabled ? toEditablePage({ source: metadata.source, version: metadata.version, title: metadata.title }) : null;
  return { page, frozen };
}
