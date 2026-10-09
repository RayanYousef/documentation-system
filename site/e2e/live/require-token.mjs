// Guard for `npm run e2e:live`: stops with a short message when GITHUB_TOKEN is not set, before anything is built.
// It only checks that the variable is there; it never prints, logs or writes the value.
if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_TOKEN.trim()) {
  console.error([
    'e2e:live needs GITHUB_TOKEN in your terminal, and it was not found.',
    'Set it for this terminal only (never in a file), then run again. In PowerShell:',
    '  $env:GITHUB_TOKEN = "<your fine-grained token>"',
    '  npm run e2e:live -w @platform/site',
    'The token needs Repository permissions: Contents: Read and write on RayanYousef/documentation-system.',
    'This test makes real commits to main (a temporary test page is created, edited and deleted).',
  ].join('\n'));
  process.exit(1);
}
