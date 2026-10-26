# Project Guidelines

## Development

- Keep it simple. No speculative abstractions, fallbacks, or handling of cases the site does not produce.
- Every check must have a concrete reason: an observed site behavior, an external input boundary, or a type constraint. Not "just in case".
- Comments only in exceptional cases, e.g. non-obvious behavior of the site. Code that needs comments to be understood should be rewritten.
- Use pnpm for package operations and project scripts.

## Code Style

- TypeScript with strict types, tabs, single quotes, semicolons.
- Never mix declarations of functions, variables and types. File order: imports -> types -> global variables -> functions.
- Do not overuse `as const`, prefer explicit types.

## Tests

- Tests are e2e against the live patches.kibab.com, no mocks.
- Every test must have a reason: it catches a plausible bug in our code or a site behavior nothing else would notice. More tests are not better.
- Tests must leave the test patch unchanged: restore fields, never change the update date. Irreversible or publicly visible actions go to separately enabled groups.
