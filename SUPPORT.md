# Private support intake

Prepared from verified current-source commit `f1a53d891dc424c353301c58156ae18cb6ef938e` in isolated branch `site/support-20261102`. Source: `Saved/SourceChanges/FleetSupport_20261102/worktree` in PixelSimShips. Actual deployment status belongs to the adjacent release receipt.

## Visitor and owner flow

Homepage links and a compact support section lead to `/support`. Category, summary and details are required; game/system version and visitor reply email are optional. A reference appears only after persistence. No owner email is required or exposed. No account, public discussion, attachments or automatic email is created. Failed submission leaves the form intact; same-reference exact retries return the saved receipt. No report text is stored in browser localStorage. Without JavaScript or during unavailability, the page retains the real Discord contact link.

The private `/crew-support` inbox uses the existing `/crew` creator login. Every GET/PATCH checks canonical-host cookie, key version and expiry; the public HTML contains no report data. Owner views are New/Reviewing/Closed/All,25records per page, manual Refresh, private status and note updates with revision guards. Updates do not contact the submitter. Optional email is for manual follow-up; no mail provider or notification service was added. No automatic record deletion was introduced.

## Configuration and boundaries

- Existing Pages project `fleet-in-pieces-site`; GitHub `ryancroker/fleet-in-pieces-site`, production branch `main`, blank build command and prepared output `site/`.
- Existing D1 binding `COMMUNITY_DB`, database `fleet-in-pieces-community`; existing encrypted creator/signing secrets reused. No new secrets/providers/billing settings.
- Keep `COMMUNITY_WRITES_ENABLED = "false"`. `SUPPORT_WRITES_ENABLED = "true"` opens only this independent private intake. Missing/invalid/false support flag fails closed.
- Additive `migrations/0014_support_requests.sql` adds one private report table/index.0013belongs to a separate unpublished branch and is excluded.
- Category enum, summary3-100characters, details10-4000, optional email<=254 and version<=80. Request JSON<=8192bytes, same-origin JSON and honeypot. Emails/text never appear in public responses or logs; private UI uses textContent.
- Public submissions: signed pseudonymous actor and daily keyed network hash;3/actor/hour,8/actor/day,20/network/hour,60/network/day. No plaintext IP is stored. Shared write-fuse limits and accounting remain;44handler+6accounting SQL slots. Reads are read-only; no background polling.
- Support-only environment copy feeds existing admitWrite/controlFuse/fuseStatus. It never changes the old community gate. Stored pause, exhausted budgets and unknown-receipt refusal remain. Resume never refunds usage or deletes unknown receipts.
- Missing schema/database/signing configuration returns503 rather than false success or SQL details. Apply migration before code. Missing schema after admission may latch failed accounting; never erase that receipt to recover.

## Release sequence

1. Use this current-source isolated branch, not old `Website/fleet-in-pieces-site` local main containing unpublished Commander Notes. Refresh remote main and reconcile newer changes without force-push.
2. Run `node scripts/prepare-site.mjs`; review source and generated pages/fingerprints. Keep previous immutable files and existing redirects/history links.
3. For the authorized production change, privately export current D1 outside public/Git paths and record preservation evidence. Inspect applied migrations. Apply only reviewed0014, never another checkout's pending0013 or a blind migration batch. Compare every pre-existing persistent row/field after the additive migration.
4. Commit only the reviewed source/generated files/docs, with local `.dev.vars`, `.wrangler`, synthetic fixtures and private database exports excluded. Push normally to existing GitHub main; its existing Pages integration deploys.
5. Verify deployment, public `/support` and script200, and unauthenticated `/api/support`401. Do not create a production test report/account or read actual reports. Confirm retired community flag remains false; no DNS/billing/account/auth changes or fuse resets.
6. Record exact commit, deployment ID, migration and bounded read-only checks before calling support live. The Steam private Support URL may be saved earlier, but public Steam publication must not point to an unavailable page.

## Local evidence

Local Worker compilation, migration and source syntax checks passed. Nineteen actual localhost API checks cover private persistence, exact retry, changed retry409, CSRF403, honeypot422, guest GET401, owner login/list/update, stale409, pause503/resume, revoked-sessionGET/PATCH401, and retired public writes503 before/after support resume. `../LocalVerification.json` records these checks. Root reviewed the real local form and submitted a synthetic browser report. No production reports were used for local review. Ryan owns ordinary usability; this is not a full security/privacy audit.

Current Discord authority: Oct28 permanent invite `https://discord.gg/ASV7xWfQQ2`, max_age0/max_uses0/temporaryfalse per the retained invite/site receipts. The formerPRSTCxCeH expired. Preserve the current config source.

## Historical production preflight stop

On November 2 the existing Pages deployment still matched f1a53d8 and COMMUNITY_WRITES_ENABLED=false. The existing D1 cost fuse was already latched accounting_incomplete with one outstanding permit (tripped_at1791788567). Release stopped before backup, migration, commit/push or deployment; no reset or counter/permit change occurred. A diagnostic403 resolved on the same existing auth path without permission changes; cause unproven. The unknown existing accounting must be reviewed separately before enabling support. See ../ProductionPreflight.json.

## Accounting recovery and release continuity

On November 2, the documented orphan-repair procedure reconciled the exact old receipt against unsampled D1 usage. A1000-row allowance exceeded the382 reported database rows in the full October11-13 bracket and included repair overhead. Backup/restore, exact state/revision guards and post-repair preservation passed;27 other tables were unchanged. Original failure cause remains unknown. COMMUNITY_WRITES_ENABLED remains false. Do not replay the recovery package. See Saved/SourceChanges/FleetSupportRecovery_20261102/ApplyReceipt.json and the support package's final release receipt for actual migration/deployment state.

Active studio footer uses Death Gets Flowers for developer and publisher, and exposes the existing configured TikTok and permanent Discord links. Final root review covered desktop and390px layouts without horizontal overflow. No production test report was submitted.
