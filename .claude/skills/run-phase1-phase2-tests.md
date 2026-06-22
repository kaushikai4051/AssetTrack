---
name: run-phase1-phase2-tests
description: >
  Orchestrates the full Phase 1 & Phase 2 test cycle for the asset-management app.
  Runs the test-writer agent first (writes all test files and installs dependencies),
  then runs the test-runner agent (executes suites and reports results).
  Invoke this skill to go from zero tests to a complete pass/fail report in one command.
---

# Skill: run-phase1-phase2-tests

Runs the two-agent test pipeline for Phase 1 and Phase 2 of the asset-management app.

## What this skill does
1. **Stage 1 — Write**: Spawns `asset-mgmt-test-writer-phase1-phase2` to read all source files, install test dependencies, and generate test suites for backend and frontend.
2. **Stage 2 — Run**: Spawns `asset-mgmt-test-runner-phase1-phase2` to execute the generated tests and produce a structured pass/fail report.

## Execution Steps

### Stage 1 — Test Writer

Invoke the sub-agent defined at:
`.claude/sub-agents/asset-mgmt-test-writer-phase1-phase2.md`

Brief the agent as follows:
> You are the asset-mgmt-test-writer-phase1-phase2 agent. The project is at `F:\Tech2025\Claude-AI\projects\asset-management`. Follow your full instructions to:
> 1. Read all Phase 1 and Phase 2 source files (controllers, routes, finance utils, frontend pages, utilities)
> 2. Install Jest + supertest in server/ and Vitest + React Testing Library in client/
> 3. Add test scripts to both package.json files
> 4. Write all backend test files under server/__tests__/
> 5. Write all frontend test files under client/src/__tests__/
> 6. Print a summary table of all files created and test counts
>
> Do NOT modify any production source file. Only create test files and update devDependencies.

**Wait for Stage 1 to complete before proceeding to Stage 2.**

Check Stage 1 output for:
- Confirmation that test files were created
- Any files skipped (source not found)
- Any dependency install errors

If Stage 1 reports a fatal error (e.g., cannot read source files, cannot install packages), STOP and report the blocker to the user. Do not proceed to Stage 2.

---

### Stage 2 — Test Runner

Invoke the sub-agent defined at:
`.claude/sub-agents/asset-mgmt-test-runner-phase1-phase2.md`

Brief the agent as follows:
> You are the asset-mgmt-test-runner-phase1-phase2 agent. The project is at `F:\Tech2025\Claude-AI\projects\asset-management`. The test-writer agent has already created test files. Follow your full instructions to:
> 1. Verify test files exist (pre-flight check)
> 2. Verify test dependencies are installed; run npm install if needed
> 3. Run backend Jest tests and capture all output
> 4. Run frontend Vitest tests and capture all output
> 5. Parse results and print the full structured report
>
> Do NOT edit any files. Report failures — do not attempt to fix them.

**Wait for Stage 2 to complete.**

---

### Final Output

After both agents complete, print this to the user:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1 & 2 TEST PIPELINE COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Stage 1 — Test Writer  : ✅ Complete  |  ⚠️ Partial  |  ❌ Failed
Stage 2 — Test Runner  : ✅ All Pass  |  ❌ <N> Failures

See the test runner report above for full details.

Next steps:
  • If all tests pass  → Ready to proceed to Phase 3
  • If tests fail      → Review action items in the runner report
  • To re-run tests    → Invoke run-phase1-phase2-tests again (skips writer if tests already exist)
  • To regenerate tests → Delete server/__tests__/ and client/src/__tests__/ then re-run
```

---

## Arguments (optional)

This skill accepts an optional argument:

| Argument | Effect |
|----------|--------|
| `--writer-only` | Run Stage 1 only (write tests, do not run them) |
| `--runner-only` | Run Stage 2 only (assumes tests already written) |
| `--backend-only` | Both stages, but only backend tests |
| `--frontend-only` | Both stages, but only frontend tests |
| (none) | Full pipeline: writer + runner, all tests |

Pass the argument to the relevant sub-agent instruction when briefing it.

---

## Agent Definitions
- Test Writer: `.claude/sub-agents/asset-mgmt-test-writer-phase1-phase2.md`
- Test Runner: `.claude/sub-agents/asset-mgmt-test-runner-phase1-phase2.md`

## Scope
Covers Phase 1 (Auth, Bank Accounts FD/RD/Savings, Dashboard) and Phase 2 (Mutual Funds, Stocks, Gold, Government Schemes, Market Data, Finance Utilities).
Phase 3 tests (Loans, Insurance, Real Estate) are out of scope for this skill.
