# Opening a PR

Run at the end of a code playbook when the user asks to ship or open a PR.

1. **Clean the branch.** Work from a feature branch off the default branch with unrelated changes excluded. Rebase or arrange into small, landable commits.
2. **Audit the diff.** Review `git diff` for dead code, debug leftovers, unnecessary comments, and AI slop. Apply `unslop` and `technical-writing` to the PR title, body, and commit messages.
3. **Format the PR title:** `type(scope): subject`, naming the concrete symbol or subsystem when one carries the change.
4. **Format the PR body:** Keep it under 40 lines so a reviewer can read it in under a minute. Use these `##` headings in order, dropping empty ones:
   - `## Why`
   - `## What changed`
   - `## Scope`
   - `## Tradeoffs` (only rejected alternatives a reviewer would ask about)
   - `## Blast Radius`
   - `## Verification`
5. **Keep long evidence out of the body.** Put verbose logs or large tables in a PR comment or artifact and link to them.
6. **Create the PR ready for review** (not `--draft`, unless requested) using `gh pr create` via the `github` skill. Report the resulting PR URL.
