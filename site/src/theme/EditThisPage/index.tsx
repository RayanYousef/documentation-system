// Wraps the doc footer's "Edit this page" link (swizzle --wrap):
// - an editable Latest page: a button that opens the in-place editor at the top of the page
// - a frozen version: nothing (frozen pages are never edited)
// - anything else (generated pages such as the change log): the original link to the file on GitHub
import React from 'react';
import clsx from 'clsx';
import EditThisPage from '@theme-original/EditThisPage';
import type EditThisPageType from '@theme/EditThisPage';
import type { WrapperProps } from '@docusaurus/types';
import { ThemeClassNames } from '@docusaurus/theme-common';
import IconEdit from '@theme/Icon/Edit';
import { requestEdit } from '@site/src/components/InPlaceEdit/editRequest';
import { useEditablePage } from '@site/src/components/InPlaceEdit/useEditablePage';
import styles from '@site/src/components/InPlaceEdit/styles.module.css';

type Props = WrapperProps<typeof EditThisPageType>;

export default function EditThisPageWrapper(props: Props) {
  const { page, frozen } = useEditablePage();
  if (frozen) return null;
  if (!page) return <EditThisPage {...props} />;
  return (
    <button type="button" className={clsx(ThemeClassNames.common.editThisPage, styles.footerEdit)}
      onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); requestEdit(); }}>
      <IconEdit /> Edit this page
    </button>
  );
}
