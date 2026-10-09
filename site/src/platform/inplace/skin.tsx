// The site's own components for blocks the editor shows in the page look (injected, so the editor never
// imports the theme): an admonition being edited is the same Admonition readers see.
import React from 'react';
import Admonition from '@theme/Admonition';
import type { RichTextSkin } from '@platform/editor/inplace';

export const siteSkin: RichTextSkin = {
  Admonition: ({ type, title, children }) => <Admonition type={type} title={title}>{children}</Admonition>,
};
