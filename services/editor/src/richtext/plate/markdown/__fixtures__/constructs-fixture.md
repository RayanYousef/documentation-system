---
title: Constructs Fixture
description: Synthetic page for the Plate spike. It holds Markdown constructs that no real page uses yet.
type: reference
tags: [spike]
resource: https://github.com/RayanYousef/documentation-system/blob/main/site/components.json
---

## Marks

Text with **bold**, *italic*, ~~strike~~, `code` and a [link](../getting-started.md).

## Lists

* Top item
  * Nested item
  * Second nested item
* Second top item

1. First
2. Second

* [ ] Open task
* [x] Done task

## Quote and rule

> A quoted line with **bold**.

---

## Image

![Sample cube](/img/cube.png)

## Admonitions

:::tip
A tip.
:::

:::caution[Watch out]
A caution with a title.
:::

## Code with meta

```ts title="example.ts"
const x: number = 1;
```

## Table with alignment

| Left | Right |
|:---|---:|
| a | 1 |

<!-- a plain comment -->

Done.

## Code that looks like HTML

Inline: `<ModelViewer repo="owner/repo" path="a.glb" />` and `<img src=x>` and `<!-- not a comment -->`.

```html
<div class=box><img src=a.png></div>
<!-- a comment inside a fence -->
```

Text with an inline <!-- hidden note --> comment.
