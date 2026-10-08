---
title: Forge Props
description: Lists the forge and workshop prop models (anvils, chests, crucibles) with their budgets and which ones are interactable containers.
type: asset
tags: [art, model, props, forge]
resource: https://github.com/RayanYousef/documentation-system/blob/main/examples/unity-project/Assets/Models
sources:
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/examples/unity-project/Assets/Models/Chest.fbx
sidebar_position: 2
---

## Set overview

:::note
This page is a design example. Only `Chest.fbx` ships in the sample repository, and it is a generated placeholder test mesh (a simple pyramid), not a finished chest. The other props, counts and budgets below are illustrative.
:::

The planned forge set is eleven props sharing one 2048 trim-sheet atlas so a full workshop scene costs a single draw call per material. Each prop is a standalone FBX under `Assets/Models` and is under 2k triangles; the crucible is the exception at 3.2k because of its pouring lip.

## Interactable props

Three props are containers and therefore get an `InventoryContainer` component at prefab level, backed by the [Inventory](../systems/inventory.md) service:

| Prop | Slots | Notes |
|---|---|---|
| `Chest.fbx` | 24 | Generic storage; in the intended design the lid is a separate mesh with an open/close animation (the placeholder mesh has no lid). |
| `Crucible.fbx` | 3 | Forge input tray; slots accept ore only. |
| `Anvil.fbx` | 1 | Output slot; locked while a recipe is in progress. |

The rest are decoration and use a static-batched prefab.

## Authoring rules

Pivot at the floor contact point, forward along +Z, unit scale. Collision is a hand-made convex mesh named `<Prop>_Col` inside the same FBX; do not rely on auto-generated colliders because the props are placed by the [Airship Model](airship-model.md) hold socket at runtime and must stack cleanly.

## Preview

<FbxViewer repo="RayanYousef/documentation-system" ref="main" path="examples/unity-project/Assets/Models/Chest.fbx" alt="Chest" height={360} />
