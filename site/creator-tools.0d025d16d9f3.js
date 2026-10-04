(() => {
 'use strict';
 const creator=window.FleetCreator,api=creator.api;
 const choices={open:'OPEN',under_review:'UNDER REVIEW',planned:'PLANNED',prototyping:'PROTOTYPING',implemented:'IMPLEMENTED FROM FEEDBACK',already_in_game:'ALREADY IN GAME',not_planned:'NOT PLANNED',duplicate:'DUPLICATE',superseded:'SUPERSEDED'};
 let serial=0,contentPromise;
 const n=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;};
 const button=(text,cls='button secondary')=>{const x=n('button',cls,text);x.type='button';return x;};
 function field(parent,label,name,value='',options={}){
  const wrap=n('div','creator-field'),id='creator-'+(++serial),caption=n('label','',label);caption.htmlFor=id;
  const input=n(options.tag||'input');input.id=id;input.name=name;
  Object.entries(options).forEach(([k,v])=>{if(k!=='tag')input[k]=v;});input.value=value??'';
  wrap.append(caption,input);parent.append(wrap);return input;
 }
 function check(parent,label,name,value){const row=n('label','creator-check'),input=n('input');input.type='checkbox';input.name=name;input.checked=Boolean(value);row.append(input,document.createTextNode(label));parent.append(row);return input;}
 function details(parent,label){const d=n('details','creator-details');d.append(n('summary','',label));parent.append(d);return d;}
 function message(parent,text,error=false){parent.textContent=text;parent.classList.toggle('error',error);}
 function busy(form,value){[...form.elements].forEach(x=>x.disabled=value);}
 function original(parent,item){const d=details(parent,'Original submission');d.append(n('p','creator-original',item.body),n('p','field-hint',item.author?.callsign||item.handle||'Anonymous Crew Member'));}
 async function contentSelect(parent,current){const select=field(parent,'Ship / system / topic','content_id','',{tag:'select'});contentPromise||=api('/api/content').catch(e=>{contentPromise=null;throw e;});const data=await contentPromise;for(const c of data.content){const option=n('option','',c.title);option.value=c.id;select.append(option);}select.value=current;return select;}
 const currentDecision=idea=>idea.decision_key||({new:'open',reviewing:'under_review',planned:'planned',building:'prototyping',implemented:'legacy',declined:'not_planned'}[idea.status])||'open';
 async function ideaEditor(idea,onSaved,history=[]){
  const form=n('form','creator-editor');form.dataset.ideaId=idea.id;
  form.append(n('p','eyebrow',`Fleet Command / suggestion ${idea.id}`));
  const select=field(form,'Decision','decision_key','',{tag:'select'});
  for(const [value,label] of Object.entries(choices)){const option=n('option','',label);option.value=value;select.append(option);}
  if(currentDecision(idea)==='legacy'){const o=n('option','','IMPLEMENTED — CHOOSE ITS ORIGIN');o.value='legacy';select.prepend(o);form.append(n('p','field-hint','This older badge does not establish community credit. Choose Already in Game or Implemented from Feedback.'));}
  select.value=currentDecision(idea);
  const response=field(form,'Official developer reply','developer_response',idea.developer_response,{tag:'textarea',rows:3,maxLength:2000});
  const hint=n('p','field-hint');form.append(hint);
  const refresh=()=>{response.required=['implemented','already_in_game'].includes(select.value);hint.textContent=select.value==='already_in_game'?'Required: explain that it predates the suggestion and where or how it exists.':select.value==='implemented'?'Required: explain what changed because of this suggestion.':'A short response from Fleet Command. Plain text; supporting links go below.';};
  select.addEventListener('change',refresh);refresh();
  const supporting=details(form,'Build, date & supporting links');
  field(supporting,'Build / development pass (optional)','build_label',idea.build_label,{maxLength:80});
  field(supporting,'Implementation date (optional)','release_date',idea.release_date,{type:'date'});
  const links=[];for(let i=0;i<3;i++){const row=n('div','creator-link-row');supporting.append(row);links.push({label:field(row,`Link ${i+1} label`,'link_label_'+i,idea.evidence?.[i]?.label,{maxLength:80}),url:field(row,'Page, screenshot or clip URL','link_url_'+i,idea.evidence?.[i]?.url,{maxLength:1000,placeholder:'/systems/missiles or https://…'})});}
  const triage=details(form,'Pin, move, lock & visibility');
  check(triage,'Pin this suggestion on its briefing','pinned',idea.pinned);
  check(triage,'Lock new replies (existing discussion stays readable)','locked',idea.locked);
  check(triage,'Hide this suggestion and its replies from public pages','hidden',idea.hidden);
  await contentSelect(triage,idea.content.id);
  const link=details(form,'Duplicate or superseding suggestion');
  field(link,'Destination suggestion number','related_idea_id',idea.related_idea_id,{type:'number',min:1,step:1});
  link.append(n('p','field-hint','Choose Duplicate or Superseded above to link the relevant idea. Its number is in /i/123.'));
  if(!idea.merged_into){check(link,'Consolidate this duplicate’s votes and replies under the destination','merge',false);link.append(n('p','field-hint','Permanent consolidation. Original submissions, authors and links remain. Shared voters count once.'));
  }else link.append(n('p','field-hint',`Already consolidated under idea ${idea.merged_into}. This source stays linked and closed.`));
  const format=details(form,'Clarify formatting / title');
  format.append(n('p','field-hint','The original stays visible. Clarify formatting, not the author’s meaning. Hide sensitive content instead.'));
  field(format,'Short editorial title (optional)','display_title',idea.display_title,{maxLength:120});
  field(format,'Clarified formatting (blank keeps original)','display_body',idea.display_body,{tag:'textarea',rows:4,maxLength:2000});
  field(format,'Public explanation of clarification','edit_note',idea.edit_note,{maxLength:300});original(format,idea);
  if(history.length){const record=details(form,'Recent command history');for(const h of history.slice(0,12))record.append(n('p','field-hint',new Date(h.created_at).toLocaleString()+' · '+h.summary));}
  const submit=n('button','button primary','Save decision');submit.type='submit';const feedback=n('p','form-feedback');feedback.setAttribute('role','status');form.append(submit,feedback);
  let saving=false;
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(saving||!form.reportValidity())return;
   if(select.value==='legacy'){message(feedback,'Choose whether this was already in the game or implemented because of feedback.',true);return;}
   const e=form.elements,payload={revision:idea.revision,decision_key:select.value,developer_response:response.value,
    hidden:e.hidden.checked,pinned:e.pinned.checked,locked:e.locked.checked,content_id:e.content_id.value,
    related_idea_id:e.related_idea_id.value?Number(e.related_idea_id.value):null,merge:Boolean(e.merge?.checked),display_title:e.display_title.value,display_body:e.display_body.value,edit_note:e.edit_note.value,build_label:e.build_label.value,release_date:e.release_date.value,
    evidence:links.filter(l=>l.url.value||l.label.value).map(l=>({label:l.label.value,url:l.url.value}))};
   saving=true;busy(form,true);message(feedback,'Saving…');
   try{const result=await api('/api/admin/ideas/'+idea.id,{method:'PATCH',body:JSON.stringify(payload)});idea=result.idea;message(feedback,'Saved. The public record is updated.');onSaved?.(idea);}
   catch(error){message(feedback,error.message,true);}
   finally{saving=false;busy(form,false);}
  });return form;
 }
 async function replyEditor(reply,onSaved){
  const form=n('form','creator-editor');form.append(n('p','eyebrow',`Fleet Command / reply ${reply.id}`));original(form,reply);
  check(form,'Hide this reply from the public discussion','hidden',reply.hidden);
  const formatting=details(form,'Clarify formatting');field(formatting,'Clarified formatting (optional)','display_body',reply.display_body,{tag:'textarea',rows:3,maxLength:1500});field(formatting,'Public explanation','edit_note',reply.edit_note,{maxLength:300});
  const save=n('button','button secondary','Save reply update');save.type='submit';const feedback=n('p','form-feedback');feedback.setAttribute('role','status');form.append(save,feedback);let saving=false;
  form.addEventListener('submit',async e=>{e.preventDefault();if(saving||!form.reportValidity())return;saving=true;const payload={revision:reply.revision,hidden:form.elements.hidden.checked,display_body:form.elements.display_body.value,edit_note:form.elements.edit_note.value};busy(form,true);message(feedback,'Saving…');try{await api('/api/admin/replies/'+reply.id,{method:'PATCH',body:JSON.stringify(payload)});onSaved?.();}catch(error){message(feedback,error.message,true);}finally{saving=false;busy(form,false);}});
  const promotion=details(form,'Promote to a suggestion');
  if(reply.promoted_idea_id){const a=n('a','back-link','Open promoted suggestion →');a.href='/i/'+reply.promoted_idea_id;promotion.append(a);}
  else{promotion.append(n('p','field-hint','Keeps the author, original text and reply. Creates a linked suggestion with its own discussion.'));const topic=await contentSelect(promotion,reply.content_id);const promote=button('Promote this reply');promotion.append(promote);
   promote.addEventListener('click',async()=>{if(saving)return;saving=true;busy(form,true);message(feedback,'Promoting…');try{const result=await api('/api/admin/replies/'+reply.id+'/promote',{method:'POST',body:JSON.stringify({content_id:topic.value})});message(feedback,'Promoted. Original reply and author retained.');const a=n('a','back-link','Open suggestion →');a.href='/i/'+result.idea.id;feedback.append(a);promote.hidden=true;}catch(error){message(feedback,error.message,true);}finally{saving=false;busy(form,false);}});
  }return form;
 }
 window.FleetCreatorTools={ideaEditor,replyEditor};
})();
