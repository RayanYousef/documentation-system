---
title: Tabs Fixture
description: Synthetic page for the Plate spike, because no real page in site/docs uses Tabs or TabItem yet.
type: reference
tags: [spike, tabs]
resource: https://github.com/RayanYousef/CloudDocumentationPersonal/blob/main/site/components.json
---

## Short form (Docusaurus docs style)

<Tabs>
  <TabItem value="apple" label="Apple" default>
    This is an apple.
  </TabItem>
  <TabItem value="orange" label="Orange">
    This is an orange.
  </TabItem>
</Tabs>

## Block form (what the current editor inserts, plus rich content)

<Tabs groupId="os">
  <TabItem value="one" label="One" default>
    First tab with **bold**, `inline code` and a [link](../getting-started.md).

    ```bash
    npm ci
    ```
  </TabItem>

  <TabItem value="two" label="Two">
    | Key | Value |
    |---|---|
    | `a` | 1 |

    <ModelViewer src="/models/cube.gltf" alt="Cube inside a tab" height={240} />
  </TabItem>
</Tabs>
