# Refactoring

The structure changes. The behavior does not. If cleanup uncovers a bug or missing feature, split it out and ship the structural change first against the pinned contract.

1. **Pin current behavior first.** Write or run a characterization test, snapshot, or equivalence check before moving code. Typecheck and lint are not a behavior pin.
2. **Name the missing structure.** Apply Model the Domain. Leave boring local code alone unless the reshape deletes branches, indirection, or invalid states.
3. **Subtract before you add.** Delete dead code, collapse single-caller wrappers, and remove unused state first (Subtract Before You Add, Laziness Protocol). Revert speculative cleanup.
4. **Move in small behavior-preserving steps.** Keep the pin green at every step. For internal API reshapes, migrate every caller and delete the old API in one wave (Migrate Callers Then Delete Legacy APIs). Spot-check renames across strings, docs, and tests.
5. **Prove equivalence on the real artifact.** Run the pinned tests or diff old-versus-new outputs (Prove It Works).
6. **Check reader load.** If the diff does not lower reader load somewhere (Minimize Reader Load), revert it.
7. **Order commits.** Subtraction commit first, then reshape, then follow-on cleanup. Follow `playbooks/opening-a-pr.md` when opening a PR.

**Reply:** the structure that changed, the pin you held it against, the equivalence proof, the reader-load delta, and anything reverted.
