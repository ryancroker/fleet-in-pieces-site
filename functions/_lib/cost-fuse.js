import { fail, keysOnly } from './community.js';
import { readOnly, writesConfigured } from './site-mode.js';

export const WRITE_LIMITS = Object.freeze({
  minute: { attempts: 30, rows: 5000 },
  hour: { attempts: 300, rows: 20000 },
  day: { attempts: 1500, rows: 50000 },
  month: { attempts: 15000, rows: 500000 }
});
const MAX_PENDING = 12, STALE_SECONDS = 300;
const clock = () => Math.floor(Date.now()/1000);
let closedUntil = 0;
function windows(now) {
  const d = new Date(now*1000);
  return {minute:Math.floor(now/60),hour:Math.floor(now/3600),day:Math.floor(now/86400),month:d.getUTCFullYear()*12+d.getUTCMonth()};
}
// Only locally derived integer clocks/constants enter SQL text; tokens are bound.
function current(name, field, key) { return `(CASE WHEN ${name}_key=${key} THEN ${name}_${field} ELSE 0 END)`; }
function exhausted(now) {
  return Object.entries(windows(now)).flatMap(([name,key])=>[
    `${current(name,'attempts',key)}>=${WRITE_LIMITS[name].attempts}`,
    `${current(name,'rows',key)}>=${WRITE_LIMITS[name].rows}`
  ]).join(' OR ');
}
function rolled(now, attempts=0, rows='0') {
  return Object.entries(windows(now)).flatMap(([name,key])=>[
    `${name}_attempts=${current(name,'attempts',key)}+${attempts}`,
    `${name}_rows=${current(name,'rows',key)}+${rows}`,`${name}_key=${key}`
  ]).join(',');
}
async function row(db) {
  const value=await db.prepare(`SELECT f.*,(SELECT COUNT(*) FROM community_write_permits) AS pending,
    (SELECT MIN(admitted_at) FROM community_write_permits) AS oldest_pending FROM community_write_fuse f WHERE id=1`).first();
  if(!value)throw Error('Safety state unavailable');
  return value;
}
export async function fuseStatus(db,env) {
  const state=await row(db),now=clock(),counters={};
  for(const [name,key] of Object.entries(windows(now)))counters[name]={
    attempts:state[name+'_key']===key?state[name+'_attempts']:0,
    rows:state[name+'_key']===key?state[name+'_rows']:0,limits:WRITE_LIMITS[name]
  };
  const atLimit=Object.values(counters).some(c=>c.attempts>=c.limits.attempts||c.rows>=c.limits.rows);
  const stale=state.pending>0&&state.oldest_pending<=now-STALE_SECONDS;
  const enabled=writesConfigured(env)&&!!state.enabled&&!state.tripped_at&&!atLimit&&!stale;
  const observedSeconds=Math.max(3600,now-Math.max(state.started_at,Math.floor(now/86400)*86400));
  return {enabled,configured:writesConfigured(env),manually_paused:!state.enabled,
    tripped_at:state.tripped_at?new Date(state.tripped_at*1000).toISOString():null,
    reason:!writesConfigured(env)?'environment_switch':!state.enabled?'manual_pause':state.reason||(stale?'accounting_incomplete':atLimit?'budget_reached':''),
    revision:state.revision,pending:state.pending,stale_pending:stale,counters,
    estimated_daily_rows:Math.ceil(counters.day.rows/observedSeconds*86400),
    rate_limiting:{public_writes:'shared D1 actor and network limits',public_reads:'bounded per-isolate burst shield; no database writes'},
    reset_allowed:!atLimit&&state.pending===0,as_of:new Date(now*1000).toISOString(),
    cpu_ms:100,d1_statements_per_request:50,native_subrequest_cap_confirmed:false};
}
export async function publicFuseStatus(db,env) {
  try { const state=await fuseStatus(db,env);return {enabled:state.enabled}; }
  catch { return {enabled:false}; }
}
export async function admitWrite(db,env) {
  if(!writesConfigured(env)||closedUntil>clock())readOnly();
  const now=clock(),token=crypto.randomUUID(),over=exhausted(now);
  const reachesLimit=Object.entries(windows(now)).map(([name,key])=>`${current(name,'attempts',key)}+1>=${WRITE_LIMITS[name].attempts}`).join(' OR ');
  const results=await db.batch([
    db.prepare(`UPDATE community_write_fuse SET tripped_at=${now},reason=CASE
      WHEN (${over}) THEN 'budget_reached' ELSE 'accounting_incomplete' END,revision=revision+1
      WHERE id=1 AND enabled=1 AND tripped_at IS NULL AND ((${over}) OR
        (SELECT COUNT(*) FROM community_write_permits)>=${MAX_PENDING} OR
        EXISTS(SELECT 1 FROM community_write_permits WHERE admitted_at<=${now-STALE_SECONDS}))`),
    db.prepare(`UPDATE community_write_fuse SET ${rolled(now,1)},revision=revision+1,
      tripped_at=CASE WHEN ${reachesLimit} THEN ${now} ELSE NULL END,
      reason=CASE WHEN ${reachesLimit} THEN 'budget_reached' ELSE reason END
      WHERE id=1 AND enabled=1 AND tripped_at IS NULL AND NOT (${over})`),
    db.prepare(`INSERT INTO community_write_permits(token,admitted_at)
      SELECT ?,${now} WHERE changes()=1 RETURNING token`).bind(token)
  ]);
  if(!results[2].results?.length){closedUntil=now+5;readOnly();}
  return token;
}
export async function finishWrite(db,token,rowsWritten) {
  const now=clock();
  // Reserve the two accounting changes and a possible latch update. WITHOUT
  // ROWID avoids a second permit index. This slightly overcounts normal writes.
  const rows=Math.max(0,Math.ceil(rowsWritten))+3;
  const result=await db.batch([
    db.prepare('DELETE FROM community_write_permits WHERE token=? RETURNING token').bind(token),
    db.prepare(`UPDATE community_write_fuse SET ${rolled(now,0,String(rows))},revision=revision+1
      WHERE id=1 AND changes()=1`)
  ]);
  if(result[0].results?.length)await db.prepare(`UPDATE community_write_fuse SET tripped_at=${now},reason='budget_reached',revision=revision+1
    WHERE id=1 AND tripped_at IS NULL AND (${exhausted(now)})`).run();
}
export async function accountingFailed(db) {
  closedUntil=clock()+5;
  await db.prepare("UPDATE community_write_fuse SET tripped_at=COALESCE(tripped_at,?),reason='accounting_incomplete',revision=revision+1 WHERE id=1").bind(clock()).run();
}
export async function controlFuse(db,env,data) {
  keysOnly(data,['action','revision','confirm']);
  if(!['pause','resume'].includes(data.action)||!Number.isSafeInteger(data.revision)||data.confirm!==true)fail(400,'invalid_control','Confirm the safety action first.');
  const now=clock();
  if(data.action==='pause'){
    const changed=await db.prepare("UPDATE community_write_fuse SET enabled=0,reason='manual_pause',revision=revision+1 WHERE id=1 AND revision=? RETURNING id").bind(data.revision).first();
    if(!changed)fail(409,'safety_changed','Safety status changed. Refresh before trying again.');
  }else{
    if(!writesConfigured(env))fail(409,'switch_disabled','COMMUNITY_WRITES_ENABLED is false. Enable it and redeploy before resuming.');
    // Never erase budgets or lost receipts. Missing accounting needs repair;
    // a reset must not refund unknown writes or silently conceal a broken fuse.
    const over=exhausted(now);
    const changed=await db.prepare(`UPDATE community_write_fuse SET enabled=1,tripped_at=NULL,reason='',revision=revision+1
      WHERE id=1 AND revision=? AND NOT (${over}) AND NOT EXISTS(SELECT 1 FROM community_write_permits) RETURNING id`).bind(data.revision).first();
    if(!changed)fail(409,'reset_not_ready','Refresh status. Budgets must have room and all write receipts must settle. Missing accounting needs repair before resuming.');
  }
  closedUntil=0;return fuseStatus(db,env);
}
