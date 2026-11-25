# Feature

You own the design, review, and verification. Keep the diff small and well-shaped.

1. **Trace the affected subsystem.** Use a `research` subagent if the search spans many files.
2. **Name the data shape first.** Choose the organizing structure (state machine, tagged union, table/registry, typed model) before writing logic (Foundational Thinking, Model the Domain).
3. **Write a quick decomposition check.** State:
   - Blocking first steps that must finish before parallel work.
   - Independent workstreams (disjoint files) vs. shared mutable state (which must serialize or be split first).
   - Why one writer is best if no fan-out is warranted.
4. **Implement with review separation.** For non-trivial work, delegate coding to a `self` subagent with exact file paths, the chosen data shape, and the verification bar. Keep parallel writers strictly on disjoint files. Review the diff yourself.
5. **Verify on the matching surface.** Run the real build, tests, CLI, or UI flow. Do not settle for "it compiles".
6. **Order commits cleanly.** Split into small, verifiable commits (Sequence Work into Verifiable Units).
7. **Follow `playbooks/opening-a-pr.md`** when opening a PR.

**Reply:** what changed for the user, what you chose and why, how you verified it, and any open decisions.
