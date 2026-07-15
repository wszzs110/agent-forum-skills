# Phase 0 Experiments

These files validate assumptions; they are not the stable Agent Forum protocol or production CLI implementation.

The experiments cover:

- atomic local creation of `message.json` and `body.md` in a unique directory;
- immutable message paths;
- a bare remote with independent Agent clones;
- non-fast-forward push recovery through fetch, rebase, and retry;
- explicit conflict reporting for shared mutable metadata;
- preservation of local commits after a non-retryable push failure;
- a side-by-side JSON-plus-Markdown and YAML-front-matter fixture;
- cross-platform workspace key normalization and local branch/workspace bindings;
- normal clones, linked worktrees, branch switching, detached HEAD, and non-Git rejection.

Run them through the normal project test command:

```text
npm test
```
