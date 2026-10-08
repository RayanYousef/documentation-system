---
title: Change Log
sidebar_position: 99
---

Newest first. Each entry names the page that changed and who changed it.

## 2026-10-05

* **Update**: [Contracts](/platform/contracts.md) - added the MINI_BUNDLE and MINI_CODE_REPOS fixtures, the @platform/contracts/testing import path with its vitest peer dependency, and the ComponentProp shape. (by Rayan Yousef)
* **Update**: [OKF Core package](/platform/okf-core.md) - fixed the validator rule list (new missing-index rule, root okf_version under index-frontmatter) and noted that code maps are not written while problems remain. (by Rayan Yousef)
* **Update**: [Auth service](/platform/auth.md) - said the editor, not the content service, sets the noreply commit email, and corrected the test coverage description. (by Rayan Yousef)
* **Update**: [Add an auth provider](/platform/extending/add-auth-provider.md) - replaced the non-existent authKind switch with the real ternary in createPlatform.ts and noted that LoginGate hardcodes the known kinds. (by Rayan Yousef)
* **Update**: [Content service](/platform/content.md) - search now builds and caches its own in-memory index, and uploadAsset and listAssets are described as they really behave. (by Rayan Yousef)
* **Update**: [Site](/platform/site.md) - fixed the search-index note, clarified that broken markdown links only warn, and added a section on MDXComponents.js, custom.css and site/static. (by Rayan Yousef)
* **Update**: [Platform decisions](/platform/decisions.md) - decision 13 now says ContentBackend.search builds its own index and the prebuilt search-index file is not read yet. (by Rayan Yousef)
* **Update**: [Add a content backend](/platform/extending/add-content-backend.md) - changed the operation count to twelve, rewrote the search step and corrected the uploadAsset and ASSET_DIRS wording. (by Rayan Yousef)
* **Update**: [Editor service](/platform/editor.md) - added a Theme section and corrected the Tests section to two Playwright specs. (by Rayan Yousef)
* **Update**: [Viewers package](/platform/viewers.md) - fixed what the toolbar buttons do and noted the extra exports and the 480 default height. (by Rayan Yousef)
* **Update**: [Add a site plugin or viewer component](/platform/extending/add-site-plugin-or-viewer.md) - corrected the features.viewers row and clarified that a new preview value needs an entry in the editor previews registry. (by Rayan Yousef)
* **Update**: [Add a deploy target](/platform/extending/add-deploy-target.md) - fixed the boundary-rule row and clarified that the checks run after the package build and before site:build. (by Rayan Yousef)
* **Update**: [Workflows and scripts](/platform/workflows.md) - added a per-project Vitest table and a Repository hygiene section. (by Rayan Yousef)
* **Update**: [Agent skill](/platform/agent-skill.md) - changed the entry-point wording, added the Phase 1 content service note to step 4 and added a section on other agent tooling in the repo. (by Rayan Yousef)
* **Update**: [Architecture](/platform/architecture.md) - changed the agent skill row to say it is the only platform agent skill. (by Rayan Yousef)
* **Update**: [Getting Started](/getting-started.md) - noted that Skyforge is a fictional sample that cannot be opened in Unity, removed the Git LFS requirement and fixed the clone URL. (by Rayan Yousef)
* **Update**: [Forge Props](/assets/forge-props.md) - noted that only a placeholder Chest.fbx ships and softened the prop count and chest lid wording. (by Rayan Yousef)
* **Update**: [Airship Model](/assets/airship-model.md) - noted that Airship.fbx in the repo is a placeholder cube and the details describe the intended model. (by Rayan Yousef)
* **Update**: [Systems](/systems/index.md) - added a short note that the sample C# files are stubs and the system pages describe the intended design. (by Rayan Yousef)
* **Update**: [Inventory](/systems/inventory.md) - replaced the missing Assets/Data/Items path with a note that item definitions are not part of the sample project. (by Rayan Yousef)

## 2026-09-07

* **Add**: [Architecture](/platform/architecture.md) - service map, composition, dependency rules and the login, save, publish and asset-fetch flows. (by Rayan Yousef)
* **Add**: [Contracts](/platform/contracts.md) - every interface, error code and contract suite in @platform/contracts. (by Rayan Yousef)
* **Add**: [OKF Core package](/platform/okf-core.md) - generator outputs, validator rules and the CLI entry. (by Rayan Yousef)
* **Add**: [Auth service](/platform/auth.md) - GitHub token provider, mock provider and session storage. (by Rayan Yousef)
* **Add**: [Content service](/platform/content.md) - backends, write and publish pipelines, asset fetch and search. (by Rayan Yousef)
* **Add**: [Editor service](/platform/editor.md) - composition, screens, build and known minor issues. (by Rayan Yousef)
* **Add**: [Viewers package](/platform/viewers.md) - rendering cores and the site wrappers. (by Rayan Yousef)
* **Add**: [Site](/platform/site.md) - Docusaurus configuration, prebuild artifacts, composition root and versioning. (by Rayan Yousef)
* **Add**: [Agent skill](/platform/agent-skill.md) - registry, navigation walk and rules of the docs-platform skill. (by Rayan Yousef)
* **Add**: [Workflows and scripts](/platform/workflows.md) - CI workflows and root npm scripts. (by Rayan Yousef)
* **Add**: [Add an auth provider](/platform/extending/add-auth-provider.md) - extension recipe for a new AuthProvider. (by Rayan Yousef)
* **Add**: [Add a content backend](/platform/extending/add-content-backend.md) - extension recipe for a new ContentBackend. (by Rayan Yousef)
* **Add**: [Add a new service module](/platform/extending/add-service-module.md) - extension recipe for a new workspace and lint element. (by Rayan Yousef)
* **Add**: [Add a site plugin or viewer component](/platform/extending/add-site-plugin-or-viewer.md) - extension recipe for MDX components and Docusaurus plugins. (by Rayan Yousef)
* **Add**: [Add a deploy target](/platform/extending/add-deploy-target.md) - extension recipe for a new hosting workflow. (by Rayan Yousef)
* **Add**: [Roadmap](/platform/roadmap.md) - Phase 2 items and the editor's known minor issues. (by Rayan Yousef)
* **Add**: [Platform decisions](/platform/decisions.md) - summary of spec section 7 plus two documentation decisions. (by Rayan Yousef)

## 2026-09-04

* **Update**: [Lag Compensation](/systems/networking/lag-compensation.md) - documented the 250 ms rewind cap introduced in build 0.9.3. (by Mira Okonkwo)
* **Add**: [Save Format: JSON over Binary](/decisions/2026-09-save-format-json.md) - recorded the decision to keep saves as gzipped JSON. (by Tomas Lindqvist)
* **Update**: [Save System](/systems/save-system.md) - added the migration section and the slot layout table. (by Tomas Lindqvist)

## 2026-08-21

* **Add**: [ECS vs MonoBehaviour](/decisions/2026-08-ecs-vs-monobehaviour.md) - captured why the gameplay layer stays on MonoBehaviour for 1.0. (by Mira Okonkwo)
* **Update**: [Combat](/systems/combat.md) - rewrote the damage pipeline section after the crit rework. (by Devi Raman)

## 2026-08-02

* **Add**: [Airship Model](/assets/airship-model.md) - first pass at the airship asset page, including LOD budgets. (by Priya Halvorsen)
* **Add**: [Inventory](/systems/inventory.md) - initial page covering stacks, slots and the service API. (by Devi Raman)
