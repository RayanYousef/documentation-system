export interface CodeRepoRef {
  owner: string;
  repo: string;
  defaultRef: string;
  label: string;
  /** Sub-folder of the repo that holds the project (when several projects share one repo). */
  pathPrefix?: string;
}

export interface PlatformConfig {
  siteUrl: string;
  baseUrl: string;
  organizationName: string;
  projectName: string;
  deployBranch: string;
  sitePath: string;
  title: string;
  tagline: string;
  navbarTitle: string;
  footerCopyright: string;
  /** editor: show the in-place Edit button on Latest doc pages. viewers: 3D viewer UI. search: Orama search. */
  features: { editor: boolean; viewers: boolean; search: boolean };
  auth: { provider: 'github-token' | 'mock' };
  content: { backend: 'github-browser' | 'http'; url?: string };
  codeRepos: CodeRepoRef[];
}

export const repoKey = (r: Pick<CodeRepoRef, 'owner' | 'repo'>): string => `${r.owner}/${r.repo}`;
