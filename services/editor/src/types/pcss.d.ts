// The editor stylesheet entry (`*.pcss`) is compiled by the site's bundler to a CSS string.
declare module '*.pcss' {
  const css: string;
  export default css;
}
