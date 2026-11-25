# Bug fix

Reproduce first, trace to the root cause, fix, and prove the fix on the same surface.

1. **Reproduce the failure.** Run a concrete repro (test, CLI command, or script) and capture the failing output before touching production code.
2. **Trace to the root cause.** Apply Fix Root Causes. Trace the symptom back to the first place the system went wrong. If two fixes sharing one premise fail the same check, apply Attack the Premise and test the assumption directly.
3. **Plan the smallest real fix.** Name the data shape or invariant involved. For non-trivial changes, delegate implementation to a `self` subagent with a strict file scope and verification bar, then review the diff yourself.
4. **Verify on the same surface.** Re-run the exact original repro and confirm it passes. An inconclusive or proxy-only check is not a pass.
5. **Sequence commits cleanly.** When a cheap local test path exists, land the failing repro test before the fix commit (Sequence Work into Verifiable Units).
6. **Follow `playbooks/opening-a-pr.md`** when opening a PR.

**Reply:** what was broken, root cause, fix, and verbatim failing-then-passing verification output.
