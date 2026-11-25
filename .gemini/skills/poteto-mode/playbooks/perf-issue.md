# Performance issue

Measure first, explain the bottleneck, fix the root cause, and prove the delta on the same workload.

1. **Establish a reproducible baseline.** Record the exact command, environment, sample count, warmup behavior, and raw baseline numbers.
2. **Explain the number.** Apply Explain the Number. Identify what limits the metric (CPU, I/O, lock contention, allocations, serialization) and verify the benchmark measures the real workload rather than harness overhead.
3. **Apply targeted changes one verifiable unit at a time.** Verify each change against the same benchmark before attempting the next.
4. **Compare artifacts.** Report baseline, post-fix, and delta with variance or sample size. An inconclusive or noisy run is not a pass.
5. **Include the measurement command and results in the PR.** Follow `playbooks/opening-a-pr.md`.

**Reply:** baseline number, post-fix number, delta, measurement method, and what bottleneck was removed.
