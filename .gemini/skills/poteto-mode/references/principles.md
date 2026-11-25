# Engineering principles

Apply only the principles that fit the task. When a principle changes a decision, cite it and state the exact choice it changed.

## Core

- **Laziness Protocol.** Bias toward deletion and the smallest change that solves the problem. Consolidate repeated decisions behind one source of truth instead of threading flags or adding wrapper layers.
- **Foundational Thinking.** Before writing logic, define the core types, data structures, scaffold-versus-feature sequence, and what concurrent actors share.
- **Redesign from First Principles.** When a new requirement fights the existing design, redesign as if that requirement had been foundational from day one rather than bolting on special cases.
- **Attack the Premise.** When two or more fixes sharing one premise fail the same check, write the premise down and test it directly before writing another fix that assumes it.
- **Subtract Before You Add.** Before an addition, refactor, or rewrite, delete dead code, collapse single-caller wrappers, and remove unused state so you build on a simpler base.
- **Minimize Reader Load.** Count indirection layers and hidden state. Collapse one-caller wrappers, shrink mutable scope, and keep control flow local and obvious.
- **Outcome-Oriented Execution.** In planned rewrites or migrations with explicit phases, converge directly on the target architecture instead of preserving throwaway compatibility states.
- **Experience First.** On product, UX, or feature-scope tradeoffs, choose user clarity and delight over implementation convenience.
- **Exhaust the Design Space.** For a novel interaction or architectural fork with no precedent, build 2 to 3 competing throwaway prototypes and compare them before committing.
- **Build the Lever.** For repetitive or non-trivial transformations, build the script, codemod, or check that executes and proves the change rather than doing it by hand.

## Architecture

- **Model the Domain.** When code branches heavily or repeats shape assumptions across files, encode the domain in a structure (state machine, tagged union, table or registry, typed model) instead of scattered conditionals.
- **Boundary Discipline.** Validate and parse untrusted input at system boundaries. Trust internal types inside the boundary and keep core business logic pure.
- **Type System Discipline.** Make illegal states unrepresentable. Brand primitives where mixups hurt, and parse external data into typed structures at the edge.
- **Make Operations Idempotent.** Design commands, lifecycle steps, and retryable loops so running them twice converges to the same end state.
- **Migrate Callers Then Delete Legacy APIs.** When replacing an internal API, migrate every caller and delete the old API in one wave. Do not leave compatibility shims behind.
- **Separate Before Serializing Shared State.** When concurrent actors write the same file, branch, key, or object, eliminate the sharing first. Add locking or serialization only for true invariants.

## Verification

- **Prove It Works.** Verify against the real artifact before declaring done. Passing a typecheck or unit test on a mock is not proof that the real behavior works.
- **Fix Root Causes.** Trace each symptom back to the first place the system went wrong and fix it there. A defensive guard is only a real fix when the state it handles is legitimate.
- **Sequence Work into Verifiable Units.** Break multi-step work into small units that each end in a check. Verify each unit before starting the next, and order commits so the sequence proves itself (for example, failing repro test before fix).
- **Test Behavior, Not Implementation.** Assert what callers and users observe so tests fail when behavior breaks and keep passing when internals change.
- **Explain the Number.** Before trusting or reporting a benchmark, latency, throughput, or eval number, identify what limits it and rule out measurement artifacts.

## Delegation and meta

- **Guard the Context Window.** Route bulky file reads, broad searches, and fan-out work to subagents. Keep concise summaries and decisions in the main thread.
- **Never Block on the Human.** Do not stop to ask permission on reversible choices. Proceed, state what you chose and why, and let the user course-correct.
- **Encode Lessons in Structure.** When you repeat the same instruction a second time, encode it as a lint rule, type constraint, test, or script instead of more prose.
