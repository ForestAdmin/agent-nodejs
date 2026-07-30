Triage and fix open Dependabot vulnerability alerts in this repository, open a PR, then monitor CI and fix anything that breaks until CI is green or you hit the retry cap. Work through the phases below in order.

**0. Preflight.** Confirm you have what you need:

**Context & token rule:** this routine runs inside GitHub Actions on a checkout of the repository's default branch. `$GH_PAT` is provided by the workflow from the `SECURITY_GH_PAT` secret (a user fine-grained PAT) — use it for **every** `curl`/REST call to `api.github.com`. Git is already authenticated with the same PAT via the checkout step, so plain `git push` works and its pushes trigger CI. Never use the Actions-provided `$GITHUB_TOKEN` for REST calls or the label POST: events it creates do not trigger other workflows, so the Slack notification would never fire.

- `$GH_PAT` is set and non-empty (`[ -n "$GH_PAT" ]`) with `security_events:read` (Dependabot alerts), `contents:write`, `pull_requests:write`, `issues:write`, `actions:read` + `actions:write`, and `statuses:read` on this repo (`actions:write` is needed to re-run flaky jobs; `issues:write` is required for labeling PRs and for creating the `:lock: security` label if missing). Note: fine-grained PATs cannot carry the `Checks` permission (it is GitHub App-only), so CI monitoring below uses the Actions and Commit statuses APIs — never call the Checks API (`/check-runs`), it would 403. Probe with `curl -sS -o /tmp/preflight-body.json -w "%{http_code}" -H "Authorization: Bearer $GH_PAT" "https://api.github.com/repos/$(git remote get-url origin | sed -E 's|.*github\.com[:/]([^.]+)(\.git)?$|\1|')/dependabot/alerts?per_page=1"` — expect `200`. On any non-200, `cat /tmp/preflight-body.json` — the GitHub error body says why (missing fine-grained permission vs org restriction/pending approval vs expired token).
- Package manager is detected (presence of `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`).

If `$GH_PAT` is missing or the probe fails, stop and print exactly: `Preflight failed: GH_PAT must be set (from the SECURITY_GH_PAT repository/organization secret) with the required scopes (including issues:write for labeling) on <repo>. Probe returned <http_code>, GitHub said: <first 300 chars of /tmp/preflight-body.json>. Aborting — not falling back to npm audit (it ignores dismissals and the 7-day gate).` Do not proceed.

**1. Fetch alerts.** Derive `$REPO` as `owner/name` from `git remote get-url origin`. Then:
```
curl -sS \
  -H "Authorization: Bearer $GH_PAT" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/$REPO/dependabot/alerts?state=open&per_page=100"
```
Paginate by following the `rel="next"` URL in the `Link` header. For each alert capture: `number`, `security_advisory.severity`, `dependency.package.ecosystem`, `dependency.package.name`, `security_vulnerability.vulnerable_version_range`, `security_vulnerability.first_patched_version.identifier`, `created_at`, `security_advisory.summary`.

**2. Triage each alert as FIX or IGNORE.** Mark as IGNORE only when one of the following is concretely true — record which one applies:
- The package is dev/test/tooling only and the exploit requires untrusted input at runtime.
- The vulnerable code path is unreachable from our code (verify by grepping the repo for the affected API).
- The advisory is disputed or withdrawn upstream.
- No upstream patch exists yet (`first_patched_version` is null).
- It duplicates another open alert on the same root cause (reference which).
- The vulnerable package is only pulled in by `_example/` and is not shipped to production. `_example/` intentionally pins older versions to demonstrate backward compatibility, so bumping them defeats the purpose. To qualify: the alert's `dependency.manifest_path` must be under `_example/`, AND no manifest outside `_example/` pulls in the same package (verify with `grep -r "<pkg>" --include=package.json .` or a workspace-wide `npm ls <pkg>` / `yarn why <pkg>`). If the package appears in any non-`_example` manifest, this reason does not apply — treat as FIX.

Everything else is FIX.

**3. Skip alerts opened less than 7 days ago.** These are deferred to the next run — list them in the PR description but don't touch them.

**4. For each remaining FIX, prefer a parent bump.** Find the dependency chain with `npm ls <pkg> --all` (or `yarn why` / `pnpm why`). If direct, bump to `>= first_patched_version`. If transitive, bump the nearest ancestor in `package.json` to the lowest version whose resolved tree pulls in the patched sub-dep. Verify with a fresh install + `npm ls <pkg>`.

If no reasonable parent bump closes the alert — no ancestor pulls in the patched sub-dep, or the required bump is a breaking major touching APIs we use — add a `resolutions` (Yarn) / `overrides` (npm, pnpm) entry pinning the vulnerable package to `>= first_patched_version`. Do this without asking.

**Narrow the blast radius.** Prefer in this order:
1. **Workspace-level placement.** If only one workspace's dependency graph contains the vulnerable chain AND your package manager honors workspace-level resolutions/overrides, place the entry in that workspace's `package.json`, not the root. Verify it took effect after install with `npm ls <pkg>` from the root.
2. **Scoped root entry keyed by parent.** If workspace placement isn't honored (common for npm `overrides` and pnpm `pnpm.overrides`), use parent-scoped syntax at root so the pin only applies within the specific dependency chain: `"some-parent > vulnerable-pkg": "X"` (pnpm), `"some-parent/vulnerable-pkg": "X"` (Yarn), or `{"some-parent": {"vulnerable-pkg": "X"}}` (npm).
3. **Unconditional root entry.** Last resort only, when multiple unrelated dependency chains share the vulnerability.

Record each resolution in the PR under "Resolutions added" with: the parent chain tried, why the bump wasn't viable, which `package.json` it was placed in, and which form (workspace / scoped / unconditional) was used.

Always update lockfiles by running the install, never by hand. In a monorepo, apply each change in the correct workspace.

**5. Audit existing resolutions across all `package.json` files.** After applying the bumps above, sweep every `package.json` in the repo (root, workspaces, and `_example/`) and check each entry in `resolutions`, `overrides`, and `pnpm.overrides`:
- **Stale** — the pinned package no longer appears in the resolved dependency tree. Verify with `npm ls <pkg> --all` (or `yarn why` / `pnpm why`). Remove the entry.
- **Redundant** — removing the entry leaves the natural resolution at a version that still satisfies the original pin (parent packages have since been upgraded upstream to pull in the patched sub-dep on their own). Verify by removing the entry, running a fresh install, and confirming `npm ls <pkg>` still reports `>= pinned version`. If yes, commit the removal; if no, restore the entry.

Process one entry at a time, re-running the install between each to avoid compounding changes. Record every removal in a "Resolutions removed" section of the PR with: the file it was in, the pinned package + version, and why removal is safe (stale or redundant).

**6. Pre-push checks (cheap, local only).** Run only what's fast and doesn't need the full test dependency graph:
```
npx prettier --check .
npm run lint
```
Fix any prettier/lint issues the bumps introduced before pushing. **Do not run `npm test` locally** — CI is the source of truth for tests.

**7. Open the PR.** Create the branch with this exact shell command — do **not** use any built-in branch-creation tool that auto-generates names:
```
BRANCH="security/$(date -u +%Y-%m-%d)"
git checkout -b "$BRANCH"
```
**Same-day rerun:** if the remote branch already exists (`git ls-remote --exit-code --heads origin "$BRANCH"`), this run supersedes it — its content was recomputed from scratch off the default branch. The checkout only fetched the default branch, so first give the lease something to compare against: `git fetch origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"`. Then push with `git push --force-with-lease -u origin "$BRANCH"` instead of a plain push (the single sanctioned force-push; see Constraints). Then look for an already-**open** PR whose head is `$BRANCH` (`GET /repos/$REPO/pulls?head=<owner>:$BRANCH&state=open`): if one exists, skip PR creation, reuse its `number` as `$PR_NUMBER`, and update its description; if the only PRs on that branch are closed, create a new PR normally — the force-push has already discarded their stale history.
Before pushing, verify the branch name matches `^security/\d{4}-\d{2}-\d{2}$`:
```
git rev-parse --abbrev-ref HEAD | grep -Eq '^security/[0-9]{4}-[0-9]{2}-[0-9]{2}$' || { echo "Branch name does not match required pattern; aborting"; exit 1; }
```
If the check fails, stop. Do not rename after the fact by auto-generating a name elsewhere — investigate why the branch got a different name and fix it at the source.

Then commit as `chore(security): patch <N> Dependabot alerts`, push with `git push -u origin "$BRANCH"`, and open a PR against the default branch via `POST /repos/$REPO/pulls`. Capture `$PR_NUMBER` (from the creation response, or from the reused open PR on the same-day-rerun path) and set the monitoring commit explicitly on **every** path — create or reuse: `SHA=$(git rev-parse HEAD)`. After any later push, refresh it the same way.

**Label the PR `:lock: security`.** This triggers the Slack notification workflow that pings `@first_level_support` — do not skip. Call:
```
curl -sS -o /tmp/label-resp.json -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $GH_PAT" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/$REPO/issues/$PR_NUMBER/labels" \
  -d '{"labels":[":lock: security"]}'
```
If the status is `422` (label doesn't exist in the repo yet), create it once and retry:
```
curl -sS -X POST \
  -H "Authorization: Bearer $GH_PAT" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/$REPO/labels" \
  -d '{"name":":lock: security","color":"B60205","description":"Security fix — notifies first-level support"}'
```
Then rerun the label POST. If labeling still fails, stop and print the response body — do not silently continue, because a missing label means the Slack notification won't fire and the PR won't be picked up for review.

The PR description must include the sections listed below. Mark the **Validation** line as `⏳ Awaiting CI` — phase 8 updates it.

**Alert references in the body must be full Markdown links, never bare `#<number>`.** GitHub auto-links `#<number>` to issues/PRs in the same repo, which sends readers to the wrong page (`#214` would resolve to PR/issue 214, not Dependabot alert 214). Format every alert reference as `[#<number>](https://github.com/$REPO/security/dependabot/<number>)` — in the Fixed / Ignored / Deferred / Resolutions tables AND in any inline mentions ("duplicate of #X", "also closes #Y", etc.).

**Tables that require human action must start with a checkbox column** so first-level support can tick off each alert as they handle it. Use cell content `- [ ]` (GitHub renders it as an interactive checkbox in PR bodies, even inside table cells). Apply this to:
- **Fixed** table: add a leading `Done` column (ticked once the reviewer has verified the fix landed)
- **Ignored** table: add a leading `Dismissed` column (ticked once the reviewer has dismissed the alert in the repo's Security tab)

Deferred / Resolutions added / Resolutions removed are informational — no checkbox column.

The very first line of the PR description must be the following blockquote so first-level support knows how to review it:

```
> 👋 First-level support: see [Handling automated security PRs](https://forest.slite.com/app/docs/rmjdwFgmV2RzUp) for how to triage and merge this PR.
```

- **Summary**: N fixed, M ignored, K deferred, R resolutions added, S resolutions removed. Append `| label: :lock: security applied` once the label POST returns 200.
- **Fixed** table: alert number, package, ecosystem, from → to, severity, what was bumped (direct dep, or "bumped `<parent>` X → Y").
- **Ignored**: each alert with its specific reason (one of the six allowed reasons).
- **Deferred**: alert numbers skipped by the age gate.
- **Resolutions added** (if any): alert number, package + pinned range, parent chain tried, why the bump wasn't viable, which `package.json` received it, and which form (workspace / scoped / unconditional).
- **Resolutions removed** (if any): file, package + version that was pinned, reason (stale or redundant).
- **Risks**: per bump, from the upstream CHANGELOG — breaking changes touching APIs we use, peer-dep bumps affecting neighbors, tests likely to need updating. If no behavior change beyond the patched vuln, say so.
- **Manual testing**: only if automated CI doesn't cover the affected paths — give concrete reproduction steps. Otherwise write "Covered by CI."
- **Validation**: `⏳ Awaiting CI` for now.

**8. Monitor CI and fix failures.** Every 60 seconds, fetch the workflow runs and the combined commit status for the PR head SHA (Actions + Commit statuses APIs only — the Checks API is not accessible to fine-grained PATs):
```
curl -sS -H "Authorization: Bearer $GH_PAT" \
  "https://api.github.com/repos/$REPO/actions/runs?head_sha=$SHA"
curl -sS -H "Authorization: Bearer $GH_PAT" \
  "https://api.github.com/repos/$REPO/commits/$SHA/status"
```
Wait until every workflow run has a non-null `conclusion` and — **only if the combined status reports at least one status context (`total_count > 0`)** — its `state` is no longer `pending`. An empty `statuses` array (`total_count: 0`) always reports `state: pending` on GitHub's side and must be treated as *no status gate*, not as pending CI. **Startup guard:** do not evaluate completion until at least one workflow run other than this security-fixes workflow exists for `$SHA` — with zero runs the condition would be vacuously true. If no such run has appeared after 10 minutes, comment on the PR ("No CI run started for this commit after 10 minutes — please check branch filters.") and stop. Cap one polling cycle at 45 minutes. (Exclude this security-fixes workflow's own run from the wait condition.)

Outcomes:
- **All green** — every workflow run concluded `success` and, when `total_count > 0`, the combined status `state` is `success` → edit the PR description: replace `⏳ Awaiting CI` with `✅ CI green`. Stop.
- **Any failure** — a workflow run concludes non-`success`, or a status context reports `failure`/`error` → for each failing workflow run, fetch the logs (`GET /repos/$REPO/actions/runs/<id>/logs`) and the per-job breakdown (`GET /repos/$REPO/actions/runs/<id>/jobs`); a failing **status context** has no Actions logs — record its `context` name and `target_url` in the PR instead. Identify the root cause. Apply a fix, commit as `fix(security): address CI failure — <short reason>`, push to the same branch, refresh the head SHA (`SHA=$(git rev-parse HEAD)`) so the polling calls inspect the new commit, and resume polling.
- **Still pending after 45 minutes** → comment on the PR: "CI still pending after 45 minutes; stopping automated monitoring. Please review." Stop.

**Retry cap: 3 fix-and-push cycles.** After the third failing cycle, stop. Comment on the PR with: the failure signatures seen each cycle, what fixes were attempted, and which alerts in the diff are most likely responsible. Update Validation to `❌ CI failing — needs human review`. Do not close the PR.

**Failures the routine must not try to fix — flag and stop instead:**
- Infrastructure failures (runner startup errors, missing CI secrets, GitHub Actions outage). Detect via runner-level error messages or zero-step runs.
- Flaky tests unrelated to the bumped packages (the failing test file doesn't import anything that changed, and the failure is timing/network-shaped). Re-run the failed check **once** via `POST /repos/$REPO/actions/runs/<id>/rerun-failed-jobs`; if it flakes again, comment and stop.
- Any fix that would require editing source code beyond minor test adjustments tied to a specific bump. In that case, revert just the offending bump (and any resolution added for it), regenerate the lockfile, re-push, and move the alert to "Could not auto-fix" in the PR description with the observed failure.

**Constraints:**
- Only modify `package.json`, lockfiles, and test files that genuinely need to change. Don't touch source code to make a bump work — revert the bump instead.
- Never silence failures with `--no-verify`, `eslint-disable`, `.only`, `.skip`, coverage threshold changes, or by marking a workflow required-status as optional.
- Don't close, dismiss, or comment on Dependabot alerts from the API — merging the PR closes them.
- Don't force-push during CI fix cycles — only add commits to the security branch. Single exception: the same-day-rerun supersede in phase 7 uses `--force-with-lease` once, before the PR is (re)used or created.
- Branch name must match `^security/\d{4}-\d{2}-\d{2}$` — no exceptions, no default-named branches (`claude/*`, `dependabot/*`, etc.). Create the branch via `git checkout -b` in a shell, not via any built-in branch-creation helper that auto-names.
- The PR must carry the `:lock: security` label before phase 7 exits. A missing label means `@first_level_support` never gets pinged and the PR sits unreviewed — treat a labeling failure as hard-stop, not a warning.
- The PR creation and label calls must go through `$GH_PAT` (a user PAT), never a GitHub App installation token or the in-Actions `GITHUB_TOKEN` — GitHub suppresses workflow-triggered events (like `labeled`) from those tokens, so the Slack notification workflow would never fire. `$GH_PAT` satisfies this, same as the `REPO_TOKEN` the central security workflow uses.
- If every alert ends up IGNORED or DEFERRED (no fixes, no new resolutions) AND no stale or redundant resolutions were removed, skip the PR entirely and print the triage summary as the run output. If stale resolutions were removed, ship the PR anyway — resolution hygiene is worth shipping on its own.
