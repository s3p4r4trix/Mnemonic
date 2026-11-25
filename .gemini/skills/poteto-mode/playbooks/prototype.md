# Prototype

You own the design decision, not shippable code. The prototype is a throwaway instrument; the real implementation follows `playbooks/feature.md`.

Here, speed over polish applies. Skip abstractions and production tests; optimize for learning cheaply.

1. **Name the decision.** State the exact visual, interaction, or empirical question the prototype settles. If there is no open decision, route to `playbooks/feature.md`.
2. **Build in an isolated scratch directory.** Keep throwaway files out of production source trees. For UI forks, build a self-contained HTML artifact or minimal sandbox; for behavioral or timing forks, write the smallest script that exercises the question.
3. **Compare 2 to 3 variants side by side.** Put competing options behind a simple switcher or run them under the same harness (Exhaust the Design Space).
4. **Observe on the real surface.** Log timings, capture output, or render the variants directly. Observation is the verification here.
5. **Present the decision.** Share the variants explored, observed evidence, tradeoffs, your recommendation, and the scratch path. State plainly that the prototype is throwaway.
