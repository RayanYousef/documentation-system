---
title: Viewers package
description: Explains the two React 3D rendering cores (glTF/GLB through model-viewer, FBX through three.js), why they live in their own package, and how the site wraps them with BrowserOnly and asset resolution; open it when a model does not render or when adding a new viewer.
type: system
tags: [platform, viewers, 3d, three, model-viewer, react]
resource: https://github.com/RayanYousef/CloudDocumentationPersonal/blob/main/packages/viewers
sources:
  - resource: https://github.com/RayanYousef/CloudDocumentationPersonal/blob/main/packages/viewers/src/ModelViewerCore.tsx
  - resource: https://github.com/RayanYousef/CloudDocumentationPersonal/blob/main/packages/viewers/src/FbxViewerCore.tsx
  - resource: https://github.com/RayanYousef/CloudDocumentationPersonal/blob/main/site/src/components/ModelViewer/index.tsx
  - resource: https://github.com/RayanYousef/CloudDocumentationPersonal/blob/main/site/src/components/FbxViewer/index.tsx
  - resource: https://github.com/RayanYousef/CloudDocumentationPersonal/blob/main/site/src/platform/useAssetUrl.ts
  - resource: https://github.com/RayanYousef/CloudDocumentationPersonal/blob/main/site/src/theme/MDXComponents.js
  - resource: https://github.com/RayanYousef/CloudDocumentationPersonal/blob/main/site/components.json
sidebar_position: 7
---

`@platform/viewers` exports two React components with no platform dependencies: `ModelViewerCore` (glTF/GLB on `@google/model-viewer`) and `FbxViewerCore` (FBX on raw `three`). Both take an already-resolved `src` URL plus `height` (and `alt` for the model viewer). Besides the two components, the package exports their prop types (`ModelViewerCoreProps`, `FbxViewerCoreProps`) and the `viewerBoxStyle` constant, and both cores default `height` to 480. `FbxViewerCore` has no `alt` and always auto-rotates with fixed lights. They know nothing about repositories, refs or sessions; that is the point of the package (decision 1 in [Decisions](decisions.md)): the site and the editor both need the rendering code, and the editor may not import site code.

## How the site uses them

`site/src/components/ModelViewer/index.tsx` exports `makeViewer(kind)`; `ModelViewer` and `FbxViewer` are `makeViewer('model')` and `makeViewer('fbx')`. Each renders inside `BrowserOnly` (WebGL never reaches the SSR bundle) and accepts either:

- `src`: a site-static path resolved with `useBaseUrl`, or
- `repo` + `path` (+ optional `ref`): resolved through `useAssetUrl`, which calls `ContentBackend.getAsset` on the site's composition-root backend. The ref defaults to the repository's `defaultRef` from `platform.config.js`; on a frozen version the publish pipeline has rewritten it to a commit sha.

While loading, the wrapper shows a placeholder; on failure it shows the error and reminds the reader that private code repositories need an editor session (the site reads the editor's stored session for the token). `site/src/theme/MDXComponents.js` registers `ModelViewer`, `FbxViewer`, `Tabs` and `TabItem` globally, so pages use them without import lines.

## How the editor uses them

The editor's JSX descriptors (`services/editor/src/mdx/descriptors.tsx`) render live previews with `ModelViewerCore` and `FbxViewerCore` directly, and its toolbar can upload a `.glb`, `.gltf` or `.fbx` into the site's static `models/` folder (`InsertModelButton`) or insert a model or image already committed to the site (`InsertFromRepoButton`, which lists the site's assets). `InsertModelButton` always inserts a viewer with `src` set; `InsertFromRepoButton` inserts a viewer with `src` set for a model and a plain image for an image asset. To point a viewer at a code repository, fill in `repo`, `ref` and `path` in the preview's property fields. The prop list the editor offers comes from `site/components.json` (`ComponentsManifest`), which lists `src`, `repo`, `ref`, `path`, `alt` and `height` for both viewers.

## Adding a viewer

A new format means a new core in this package, a site wrapper via `makeViewer` (or a sibling), a global registration in `MDXComponents.js`, a `components.json` entry so the editor can insert it, and an editor preview mapping. The full checklist is in [Add a site plugin or viewer component](extending/add-site-plugin-or-viewer.md).
