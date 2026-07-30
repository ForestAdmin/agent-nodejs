Triage and fix open Dependabot vulnerability alerts in this repository, open a PR, then monitor CI and fix anything that breaks until CI is green or you hit the retry cap. Work through the phases below in order.

**0. Preflight.** Confirm you have what you need:

**Context & token rule:** this routine runs inside GitHub Actions on a checkout of the repository's default branch. `$GH_PAT` is provided by the workflow from the `SECURITY_GH_PAT` secret (a user fine-grained PAT) — use it for **every** `curl`/REST call to `api.github.com`. Git is already authenticated with the same PAT via the checkout step, so plain `git push` works and its pushes trigger CI. Never use the Actions-provided `$GITHUB_TOKEN` for REST calls or the label POST: events it creates do not trigger other workflows, so the Slack notification would never fire.

- `$GH_PAT` is set and non-empty (`[ -n "$GH_PAT" ]`) with `security_events:read` (Dependabot alerts), `contents:write`, `workflows:write` (needed to push `uses:` bumps for `github-actions`-ecosystem alerts), `pull_requests:write`, `issues:write`, `actions:read` + `actions:write` (re-running flaky jobs), and `statuses:read` on this repo. Note: fine-grained PATs cannot carry the `Checks` permission (it is GitHub App-only), so CI monitoring below uses the Actions and Commit statuses APIs — never call the Checks API (`/check-runs`), it would 403. Probe with `curl -sS -o /tmp/preflight-body.json -w "%{http_code}" -H "Authorization: Bearer $GH_PAT" "https://api.github.com/repos/$(git remote get-url origin | sed -E 's|.*github\.com[:/]([^.]+)(\.git)?$|\1|')/dependabot/alerts?per_page=1"` — expect `200`. On any non-200, `cat /tmp/preflight-body.json` — the GitHub error body says why (missing fine-grained permission vs org restriction/pending approval vs expired token).
- Package manager is detected — this repo uses **Yarn 1** (`yarn.lock` at the root). Prefer `yarn` commands throughout (`yarn install --ignore-scripts`, `yarn why <pkg>`).

If `$GH_PAT` is missing, stop and print exactly: `Preflight failed: GH_PAT must be set (from the SECURITY_GH_PAT repository/organization secret). Probe not attempted. Aborting — not falling back to npm audit (it ignores dismissals and the 7-day gate).` If the probe fails, stop and print exactly: `Preflight failed: GH_PAT (SECURITY_GH_PAT secret) lacks the required scopes on <repo>. Probe returned <http_code>, GitHub said: <first 300 chars of /tmp/preflight-body.json>. Aborting — not falling back to npm audit (it ignores dismissals and the 7-day gate).` Do not proceed.

**1. Fetch alerts.** Derive `$REPO` as `owner/name` from `git remote get-url origin`. Then:
```
curl -sS -D /tmp/alerts-headers.txt \
  -H "Authorization: Bearer $GH_PAT" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/$REPO/dependabot/alerts?state=open&per_page=100"
```
Paginate by following the `rel="next"` URL from the `Link` response header captured in `/tmp/alerts-headers.txt` — the JSON body does not contain pagination links. For each alert capture: `number`, `security_advisory.severity`, `dependency.package.ecosystem`, `dependency.package.name`, `dependency.manifest_path`, `security_vulnerability.vulnerable_version_range`, `security_vulnerability.first_patched_version.identifier`, `created_at`, `security_advisory.summary`.

**2. Triage each alert as FIX or IGNORE.** Mark as IGNORE only when one of the following is concretely true — record which one applies:
- The package is dev/test/tooling only and the exploit requires untrusted input at runtime.
- The vulnerable code path is unreachable from our code. A negative repo grep alone is NOT sufficient evidence — a dependency can invoke the affected API internally without our code ever naming it. Require at least one of: the advisory targets an optional component/feature we demonstrably don't install or enable; the dependency chain shows the vulnerable call is only reachable through an entry point we never invoke (trace it); or the exploit requires a configuration we don't use. State the evidence in the PR; when in doubt, treat as FIX.
- The advisory is disputed or withdrawn upstream.
- No upstream patch exists yet (`first_patched_version` is null).
- It duplicates another open alert on the same root cause (reference which).
- The vulnerable package is only pulled in by `_example/` and is not shipped to production. `_example/` intentionally pins older versions to demonstrate backward compatibility, so bumping them defeats the purpose. To qualify: the alert's `dependency.manifest_path` must be under `_example/`, AND no workspace outside `_example/` resolves the same package **even transitively** — verify with a workspace-aware resolved-tree query from the repo root (`yarn why <pkg>` — this repo uses Yarn 1); a manifest grep only sees direct dependencies and is NOT sufficient evidence. If any non-`_example` workspace resolves the package, this reason does not apply — treat as FIX.

Everything else is FIX.

**3. Skip alerts opened less than 7 days ago.** These are deferred to the next run — list them in the PR description but don't touch them.

**4. For each remaining FIX, prefer a parent bump.**

For **npm-ecosystem** alerts: find the dependency chain with `yarn why <pkg>` (this repo uses Yarn 1). If direct, bump to the smallest patched version that stays within the currently used major (if the patch only exists in a later major, treat it as the breaking-major case below). If transitive, bump the nearest ancestor in `package.json` to the lowest version whose resolved tree pulls in the patched sub-dep. Verify with a fresh `yarn install --ignore-scripts` + `yarn why <pkg>` (`--ignore-scripts` skips native rebuilds — node-gyp compiles cost minutes on this repo and dependency resolution is identical without them).

If no reasonable parent bump closes the alert — no ancestor pulls in the patched sub-dep, or the required bump is a breaking major touching APIs we use — add a `resolutions` entry pinning the vulnerable package to the smallest patched version compatible with the major its parents expect — an exact version or a `^` range within that major, never an unbounded `>=`, which could silently resolve to a later breaking major. Do this without asking.

**Yarn 1 resolutions mechanics — narrow the blast radius.** Yarn 1 only honors the `resolutions` field in the **root** `package.json` of the workspace tree (workspace-level `resolutions` are ignored). Prefer, in this order:
1. **Scoped root entry keyed by parent**, so the pin only applies within the specific dependency chain: `"some-parent/vulnerable-pkg": "X"`.
2. **Unconditional root entry** (`"vulnerable-pkg": "X"`) only when multiple unrelated dependency chains share the vulnerability.

Record each resolution in the PR under "Resolutions added" with: the parent chain tried, why the bump wasn't viable, and which form (scoped / unconditional) was used. Always update `yarn.lock` by running `yarn install --ignore-scripts`, never by hand (the resulting lockfile matches a full install). In a monorepo, apply each `package.json` change in the correct workspace.

For **github-actions-ecosystem** alerts: bump the `uses:` version reference in the affected `.github/workflows/*.yml` file (the alert's `manifest_path` names it). `SECURITY_GH_PAT` carries the `workflows:write` permission this push requires. If the push is nevertheless rejected citing workflow permissions, the workflow files are already **inside the commit** — unstaging alone changes nothing. Rewrite the commit without them, then push again:
```
git reset --soft HEAD~1
git restore --staged --worktree .github/workflows/
git commit -m "chore(security): patch <N> Dependabot alerts"
```
Then move those alerts to "Could not auto-fix (token lacks Workflows permission)", adjust the Summary counts, and ship the rest.

**5. Audit existing resolutions in the root `package.json`.** After applying the bumps above, check each entry under `resolutions` (if you encounter stray `overrides`/`pnpm.overrides` blocks, treat them the same way — they are dead weight under Yarn 1):
- **Stale** — the pinned package no longer appears in the resolved dependency tree. Verify with `yarn why <pkg>`. Remove the entry.
- **Redundant** — removing the entry leaves the natural resolution at a version that still satisfies the original pin (parent packages have since been upgraded upstream to pull in the patched sub-dep on their own). ⚠ A plain `yarn install` after removing the entry is NOT a valid test: Yarn 1 conservatively keeps the existing `yarn.lock` entry, so every pin would look redundant. Instead: remove the entry, **delete the vulnerable package's blocks from `yarn.lock`**, run `yarn install --ignore-scripts` to force re-resolution, then check `yarn why <pkg>`. If the re-resolved version still satisfies the original pin, keep the removal; if not, restore the entry (and restore the lockfile state via `git checkout -- yarn.lock` + `yarn install --ignore-scripts`).

Process one entry at a time, re-running `yarn install --ignore-scripts` between each to avoid compounding changes. Keep removals in the working tree — everything is committed once, in phase 7. On this large monorepo, if disk gets tight across repeated installs (`df -h`), run `yarn cache clean` between iterations. Record every removal in a "Resolutions removed" section of the PR with: the pinned package + version, and why removal is safe (stale or redundant).

**6. Pre-push checks — scoped to what this run changed.** This is a large monorepo and the run normally only edits manifests, lockfiles and the occasional script. Do **not** check or lint the whole repo: the root `lint` script runs eslint in parallel across every package, which dominates the runtime, risks exhausting the runner, and surfaces pre-existing issues you must not touch anyway. Check only the changed files:
```
CHANGED=$(git diff --name-only)
echo "$CHANGED"
# formatting: only changed files prettier handles
echo "$CHANGED" | grep -E '\.(js|jsx|ts|tsx|json|md|ya?ml)$' | xargs -r yarn prettier --check
# lint: only if a source file changed — manifest/lockfile-only changes need no lint
echo "$CHANGED" | grep -E '\.(js|jsx|ts|tsx)$' | xargs -r yarn eslint
```
Fix only what your own changes broke; leave pre-existing issues in untouched files alone. If the eslint invocation fails for a configuration reason rather than a code issue, note it in the PR under Risks and continue — CI runs the full lint anyway. **Do not run the test suite locally** — CI is the source of truth for tests.

**7. Open the PR.**

**Gate first:** if there is nothing to ship — every alert ended up IGNORED or DEFERRED, no resolutions were added, and no stale/redundant resolutions were removed — print the triage summary as the run output and **stop here**: no branch, no commit, no PR. If stale resolutions were removed but nothing else changed, ship the PR anyway — resolution hygiene is worth shipping on its own.

Create the branch with this exact shell command — do **not** use any built-in branch-creation tool that auto-generates names:
```
BRANCH="security/$(date -u +%Y-%m-%d)"
git checkout -b "$BRANCH"
```
**Same-day rerun note:** if the remote branch already exists (`git ls-remote --exit-code --heads origin "$BRANCH"`), this run supersedes it — its content is recomputed from scratch off the default branch. Just note it for now: the push step below changes accordingly, and it only ever happens **after** this run's commit exists.
Before pushing, verify the branch name matches `^security/\d{4}-\d{2}-\d{2}$`:
```
git rev-parse --abbrev-ref HEAD | grep -Eq '^security/[0-9]{4}-[0-9]{2}-[0-9]{2}$' || { echo "Branch name does not match required pattern; aborting"; exit 1; }
```
If the check fails, stop. Do not rename after the fact by auto-generating a name elsewhere — investigate why the branch got a different name and fix it at the source.

Then, strictly in this order:
1. **Commit** as `chore(security): patch <N> Dependabot alerts` (a single commit containing all of this run's changes, including the phase-5 removals).
2. **Push — only after the commit exists** (never push the bare default-branch state over an existing security branch). If the remote branch does not exist: `git push -u origin "$BRANCH"`. If it does (same-day rerun): first `git fetch origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"` so the lease has an expected value — the checkout only fetched the default branch — then `git push --force-with-lease -u origin "$BRANCH"` (the single sanctioned force-push; see Constraints).
3. **Open or reuse the PR:** look for an already-**open** PR whose head is `$BRANCH` (`GET /repos/$REPO/pulls?head=<owner>:$BRANCH&state=open`). If one exists, reuse its `number` as `$PR_NUMBER` and update its description; otherwise create one against the default branch via `POST /repos/$REPO/pulls` and capture `$PR_NUMBER` from the response (closed PRs on that branch are irrelevant — the force-push already discarded their stale history).
4. Set the monitoring commit explicitly on **every** path — create or reuse: `SHA=$(git rev-parse HEAD)`. After any later push, refresh it the same way.

**Label the PR `:lock: security`.** This triggers the Slack notification workflow that pings `@first_level_support` — do not skip. The add-labels endpoint silently auto-creates missing labels with a random color and no description, so ensure the label exists **first**:
```
curl -sS -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $GH_PAT" \
  "https://api.github.com/repos/$REPO/labels/%3Alock%3A%20security"
```
If that returns `404`, create it:
```
curl -sS -X POST \
  -H "Authorization: Bearer $GH_PAT" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/$REPO/labels" \
  -d '{"name":":lock: security","color":"B60205","description":"Security fix — notifies first-level support"}'
```
Then attach it to the PR:
```
curl -sS -o /tmp/label-resp.json -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $GH_PAT" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/$REPO/issues/$PR_NUMBER/labels" \
  -d '{"labels":[":lock: security"]}'
```
If labeling fails, stop and print the response body — do not silently continue, because a missing label means the Slack notification won't fire and the PR won't be picked up for review.

The PR description must include the sections listed below. Mark the **Validation** line as `⏳ Awaiting CI` — phase 8 updates it.

**Alert references in the body must be full Markdown links, never bare `#<number>`.** GitHub auto-links `#<number>` to issues/PRs in the same repo, which sends readers to the wrong page (`#214` would resolve to PR/issue 214, not Dependabot alert 214). Format every alert reference as `[#<number>](https://github.com/$REPO/security/dependabot/<number>)` — in every table AND in any inline mentions ("duplicate of #X", "also closes #Y", etc.).

**Actionable checkboxes go in a task list, never in table cells.** GitHub renders `- [ ]` as an interactive checkbox only when it starts a list item; inside a table cell it stays literal text, and a raw `<input type="checkbox">` is stripped by GitHub's sanitizer. So the tables carry **no** checkbox column, and the body ends with a **Review checklist** section built from real task lists:

```
## Review checklist

**Fixes to verify** — tick once you have confirmed the bump landed:
- [ ] [#<number>](https://github.com/$REPO/security/dependabot/<number>) — `<package>`

**Alerts to dismiss** — tick once dismissed in the repo's Security tab (reason in the Ignored section):
- [ ] [#<number>](https://github.com/$REPO/security/dependabot/<number>) — `<package>`
```
Omit either list if it would be empty. Deferred / Resolutions added / Resolutions removed / Could not auto-fix need no checkboxes — they are informational.

The very first line of the PR description must be the following blockquote so first-level support knows how to review it:

```
> 👋 First-level support: see [Handling automated security PRs](https://forest.slite.com/app/docs/rmjdwFgmV2RzUp) for how to triage and merge this PR.
```

- **Summary**: N fixed, M ignored, K deferred, R resolutions added, S resolutions removed, F could-not-auto-fix. Append `| label: :lock: security applied` once the label POST returns 200. Keep these counts (and the `patch <N>` commit message, when practical) consistent whenever an alert later moves between sections.
- **Fixed** table: alert number, package, ecosystem, from → to, severity, what was bumped (direct dep, or "bumped `<parent>` X → Y").
- **Ignored**: each alert with its specific reason (one of the six allowed reasons).
- **Deferred**: alert numbers skipped by the age gate.
- **Resolutions added** (if any): alert number, package + pinned range, parent chain tried, why the bump wasn't viable, and which form (scoped / unconditional) was used.
- **Resolutions removed** (if any): package + version that was pinned, reason (stale or redundant).
- **Could not auto-fix** (if any): alert number, what was attempted, the observed failure.
- **Risks**: per bump, from the upstream CHANGELOG — breaking changes touching APIs we use, peer-dep bumps affecting neighbors, tests likely to need updating. If no behavior change beyond the patched vuln, say so.
- **Manual testing**: only if automated CI doesn't cover the affected paths — give concrete reproduction steps. Otherwise write "Covered by CI."
- **Validation**: `⏳ Awaiting CI` for now.
- **Review checklist**: the task lists described above (this is where the checkboxes live).

**8. Monitor CI and fix failures.** Poll **inside a single Bash loop per tool call** (about 10 minutes of `sleep 60` iterations per call — do NOT spend one tool call per poll, that would exhaust the turn budget). Each iteration fetches the workflow runs and the combined commit status for the PR head SHA (Actions + Commit statuses APIs only — the Checks API is not accessible to fine-grained PATs; check runs posted by GitHub Apps such as coverage or preview bots are therefore a blind spot of this monitoring):
```
curl -sS -H "Authorization: Bearer $GH_PAT" \
  "https://api.github.com/repos/$REPO/actions/runs?head_sha=$SHA"
curl -sS -H "Authorization: Bearer $GH_PAT" \
  "https://api.github.com/repos/$REPO/commits/$SHA/status"
```
Wait until every workflow run has a non-null `conclusion` and — **only if the combined status reports at least one status context (`total_count > 0`)** — its `state` is no longer `pending`. An empty `statuses` array (`total_count: 0`) always reports `state: pending` on GitHub's side and must be treated as *no status gate*, not as pending CI. **Startup guard:** do not evaluate completion until at least one workflow run other than this security-fixes workflow exists for `$SHA` — with zero runs the condition would be vacuously true. If no such run has appeared after 10 minutes, comment on the PR ("No CI run started for this commit after 10 minutes — please check branch filters.") and stop. Cap one polling cycle at 45 minutes.

Outcomes (every concluded run falls in exactly one bucket — there is no third state):
- **All green** — every workflow run concluded `success`, `skipped`, or `neutral`, and, when `total_count > 0`, the combined status `state` is `success` → edit the PR description: replace `⏳ Awaiting CI` with `✅ CI green (Actions + commit statuses; app-based checks not monitored)`. Stop.
- **Any failure** — a workflow run concludes with **anything else** (`failure`, `timed_out`, `cancelled`, `action_required`, `stale`, `startup_failure`, …), or a status context reports `failure`/`error` → diagnose. Fetching Actions logs is a two-step dance — the endpoint answers `302` with an empty body and a signed storage URL that must then be requested **without** the Authorization header:
```
LOGS_URL=$(curl -sS -o /dev/null -w '%{redirect_url}' -H "Authorization: Bearer $GH_PAT" \
  "https://api.github.com/repos/$REPO/actions/runs/<id>/logs")
curl -sS -o /tmp/logs.zip "$LOGS_URL" && unzip -o /tmp/logs.zip -d /tmp/logs/
```
  Also fetch the per-job breakdown (`GET /repos/$REPO/actions/runs/<id>/jobs`); a failing **status context** has no Actions logs — record its `context` name and `target_url` in the PR instead. Identify the root cause. Apply a fix, commit as `fix(security): address CI failure — <short reason>`, push to the same branch, refresh the head SHA (`SHA=$(git rev-parse HEAD)`) so the polling calls inspect the new commit, and resume polling.
- **Still pending after 45 minutes** → comment on the PR: "CI still pending after 45 minutes; stopping automated monitoring. Please review." Stop.

**Retry cap: push at most 3 fix commits.** If CI fails again after the third fix commit, stop. (The single flaky-job rerun described below pushes nothing and does not count.) When stopping at the cap, comment on the PR with: the failure signatures seen each cycle, what fixes were attempted, and which alerts in the diff are most likely responsible. Update Validation to `❌ CI failing — needs human review`. Do not close the PR.

**Failures the routine must not try to fix — flag and stop instead:**
- Infrastructure failures (runner startup errors, missing CI secrets, GitHub Actions outage). Detect via runner-level error messages or zero-step runs.
- Flaky tests unrelated to the bumped packages (the failing test file doesn't import anything that changed, and the failure is timing/network-shaped). Re-run the failed check **once** via `POST /repos/$REPO/actions/runs/<id>/rerun-failed-jobs`; if it flakes again, comment and stop.
- Any fix that would require editing source code beyond minor test adjustments tied to a specific bump. In that case, revert just the offending bump (and any resolution added for it), regenerate the lockfile, re-push, and move the alert to "Could not auto-fix" in the PR description with the observed failure (updating the Summary counts).

**Constraints:**
- Only modify `package.json` files, `yarn.lock`, `uses:` references in `.github/workflows/*.yml` (github-actions-ecosystem alerts only), and test files that genuinely need to change. Don't touch source code to make a bump work — revert the bump instead.
- Never silence failures with `--no-verify`, `eslint-disable`, `.only`, `.skip`, coverage threshold changes, or by marking a workflow required-status as optional.
- Don't close, dismiss, or comment on Dependabot alerts from the API — merging the PR closes them.
- Don't force-push during CI fix cycles — only add commits to the security branch. Single exception: the same-day-rerun supersede in phase 7 uses `--force-with-lease` once, before the PR is (re)used or created.
- Branch name must match `^security/\d{4}-\d{2}-\d{2}$` — no exceptions, no default-named branches (`claude/*`, `dependabot/*`, etc.). Create the branch via `git checkout -b` in a shell, not via any built-in branch-creation helper that auto-names.
- The PR must carry the `:lock: security` label before phase 7 exits. A missing label means `@first_level_support` never gets pinged and the PR sits unreviewed — treat a labeling failure as hard-stop, not a warning.
- The PR creation and label calls must go through `$GH_PAT` (a user PAT), never a GitHub App installation token or the in-Actions `$GITHUB_TOKEN` — GitHub suppresses workflow-triggered events (like `labeled`) from those tokens, so the Slack notification workflow would never fire.
