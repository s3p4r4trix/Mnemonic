# Investigation

Investigation requests are read-only. They produce a cited explanation or a recommendation, not a code change.

1. **Trace the relevant code.** Route broad multi-file exploration to a `research` subagent so the main context stays clean.
2. **Ground every claim.** Cite exact file paths, symbols, line numbers, or command outputs. Label anything not directly observed as inferred or guess.
3. **Structure the answer.**
   - For explanations: Overview, Key Concepts, How It Works, Where Things Live, Gotchas.
   - For decisions: Clear recommendation up front, followed by a concise tradeoffs table.
4. **Apply the `unslop` skill** to the reply.
5. **Push back when warranted.** If the question rests on a false premise, state that plainly.

Do not edit files or open a PR during an investigation. If the user decides to act on the findings, switch to `playbooks/bug-fix.md` or `playbooks/feature.md`.
