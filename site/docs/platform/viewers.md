---
title: Viewers package
description: Explains the two React 3D rendering cores (glTF/GLB through model-viewer, FBX through three.js), why they live in their own package, and how the site wraps them with BrowserOnly and asset resolution; open it when a model does not render or when adding a new viewer.
type: system
tags: [platform, viewers, 3d, three, model-viewer, react]
resource: https://github.com/RayanYousef/documentation-system/blob/main/packages/viewers
sources:
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/packages/viewers/src/ModelViewerCore.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/packages/viewers/src/FbxViewerCore.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/site/src/components/ModelViewer/index.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/site/src/components/FbxViewer/index.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/site/src/platform/useAssetUrl.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/site/src/theme/MDXComponents.js
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/site/components.json
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/plate/nodes/ViewerElement.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/viewerUrl.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/plate/page/PageViewerElement.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/localAssets.ts
sidebar_position: 7
---

`@platform/viewers` exports two React components with no platform dependencies: `ModelViewerCore` (glTF/GLB on `@google/model-viewer`) and `FbxViewerCore` (FBX on raw `three`). Both take an already-resolved `src` URL plus `height` (and `alt` for the model viewer). Besides the two components, the package exports their prop types (`ModelViewerCoreProps`, `FbxViewerCoreProps`) and the `viewerBoxStyle` constant, and both cores default `height` to 480. `FbxViewerCore` has no `alt` and always auto-rotates with fixed lights. They know nothing about repositories, refs or sessions; that is the point of the package (decision 1 in [Decisions](decisions.md)): the site and the editor both need the rendering code, and the editor may not import site code.

## How the site uses them

`site/src/components/ModelViewer/index.tsx` exports `makeViewer(kind)`; `ModelViewer` and `FbxViewer` are `makeViewer('model')` and `makeViewer('fbx')`. Each renders inside `BrowserOnly` (WebGL never reaches the SSR bundle) and accepts either:

- `src`: a site-static path resolved with `useBaseUrl`, or
- `repo` + `path` (+ optional `ref`): resolved through `useAssetUrl`, which calls `ContentBackend.getAsset` on the site's composition-root backend. The ref defaults to the repository's `defaultRef` from `platform.config.js`; on a frozen version the publish pipeline has rewritten it to a commit sha.

While loading, the wrapper shows a placeholder; on failure it shows the error and reminds the reader that private code repositories need a signed-in session (click Edit on any page to sign in; the site reads the editor's stored session for the token). Code-repo files are read from `raw.githubusercontent.com`, and from `media.githubusercontent.com` only for Git LFS pointers. `site/src/theme/MDXComponents.js` registers `ModelViewer`, `FbxViewer`, `Tabs` and `TabItem` globally, so pages use them without import lines.

## How the editor uses them

While a page is edited in place, its viewer block (`services/editor/src/richtext/plate/page/PageViewerElement.tsx`, page look) renders the real viewer with `ModelViewerCore` or `FbxViewerCore` directly at the page's height, with the props behind a settings button, loaded lazily so three.js is only fetched when a page shows a viewer; the preview uses height 480 when the block has none, and that default is never written to the page. The block resolves its URL in `services/editor/src/richtext/viewerUrl.ts`: a `src` starting with `/` is served under the site's base URL, otherwise `repo` + `path` (+ `ref`, else the repo's `defaultRef`) is read through `ContentBackend.getAsset`. The toolbar can upload a `.glb` or `.gltf` into the site's static `models/` folder or an `.fbx` into `models/fbx/` (`InsertModelButton`; the new viewer renders at once from the browser's copy of the file until the deployed site serves it, see `localAssets.ts`), or insert a model or image already committed to the site (`InsertFromRepoButton`, which lists the site's assets). `InsertModelButton` always inserts a viewer with `src` set; `InsertFromRepoButton` inserts a viewer with `src` set for a model and a plain image for an image asset. The Insert component menu and the "/" menu add an empty viewer whose props are then filled in. To point a viewer at a code repository, fill in `repo`, `ref` and `path` in the block's settings. The prop list the editor offers comes from `site/components.json` (`ComponentsManifest`), which lists `src`, `repo`, `ref`, `path`, `alt` and `height` for both viewers. See [Editor service](editor.md).

## Adding a viewer

A new format means a new core in this package, a site wrapper via `makeViewer` (or a sibling), a global registration in `MDXComponents.js`, a `components.json` entry so the editor can insert it, and an editor block that maps the new `preview` value. The full checklist is in [Add a site plugin or viewer component](extending/add-site-plugin-or-viewer.md).
