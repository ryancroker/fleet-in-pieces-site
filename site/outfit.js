(() => {
 'use strict';
 const $=id=>document.getElementById(id),F=window.FleetOutfit;if(!F||!$('outfit-workshop'))return;
 const D=F.data,C=F.catalog,S=F.sections,NS='http://www.w3.org/2000/svg',saveKey='fleet-outfit:'+D.version;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const svg=(tag,attrs,text)=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;return n;};
 const num=n=>n.toLocaleString('en-US'),watts=n=>n>0&&n<1000?num(n)+' W':(n/1000).toLocaleString('en-US',{maximumFractionDigits:1})+' kW',copy=v=>JSON.parse(JSON.stringify(v));
 const history=[],catalogButtons=new Map(),sectionButtons=new Map(),art=window.FleetLabData[0].art.hero;
 const power=c=>c.generation?'Output 0–'+watts(c.generation):'Draw '+(c.chargeDemand?'0–'+watts(c.chargeDemand)+' · charging':c.demand?'0–'+watts(c.demand):'0 W');
 let fit=F.preset('expedition'),result,message='Choose a section, then add hardware. Try charging the jump drive to see the power tradeoff.',storage=true;
 function setWorkshop(which){for(const b of document.querySelectorAll('[data-workshop]'))b.setAttribute('aria-pressed',String(b.dataset.workshop===which));$('outfit-workshop').hidden=which!=='design';$('outfit-method').hidden=which!=='design';$('ship-workshop').hidden=which!=='native';$('native-method').hidden=which!=='native';}
 for(const b of document.querySelectorAll('[data-workshop]'))b.addEventListener('click',()=>setWorkshop(b.dataset.workshop));
 function decode(hash){if(!hash.startsWith('#fit=')||hash.length>24000)return null;try{return F.validate(JSON.parse(atob(hash.slice(5))));}catch{return null;}}
 const shared=decode(location.hash),badLink=location.hash.startsWith('#fit=')&&!shared;
 if(shared){fit=shared;message='Shared fit opened as your own editable copy.';}else if(!badLink){try{const current=localStorage.getItem(saveKey),s=F.validate(JSON.parse(current||localStorage.getItem('fleet-interior:interior-1')));if(s){fit=s;message='Restored your equipment from this browser.';}}catch{storage=false;}}
 if(badLink)message='That fit link is invalid or from an unsupported catalog. An intact starter design is open.';
 setWorkshop(location.hash.startsWith('#setup=')?'native':'design');
 function persist(){try{localStorage.setItem(saveKey,JSON.stringify(fit));$('fit-save').textContent='Fit saved in this browser · no account needed';}catch{storage=false;$('fit-save').textContent='Browser storage unavailable · keep a Share fit link';}}
 const index=()=>fit.items.findIndex(p=>p.uid===fit.selected);
 function snapshot(){history.push(copy(fit));if(history.length>20)history.shift();}
 function commit(text){message=text;$('fit-share-result').hidden=true;persist();render();}
 function mutate(fn,text){snapshot();fn();commit(text);}
 function status(i){return !result.rows[i].ready?'bad':fit.states[i].condition<100?'warn':'good';}
 function metric(label,value,caption,warn=false){const d=node('div',undefined,'lab-metric'+(warn?' warn':''));d.append(node('span',label),node('strong',value),node('small',caption));return d;}
 function chooseSection(id){fit.section=id;const first=fit.items.find(p=>p.section===id);if(first)fit.selected=first.uid;message=S.get(id).name+' selected. Add equipment below, or test damage to this section.';persist();render();}
 function select(uid){fit.selected=uid;fit.section=fit.items[index()].section;render();}
 function add(type){
  const uid=Math.max(...fit.items.map(p=>p.uid))+1,p={uid,type,section:fit.section},problem=F.canAssign(fit.items,p);
  if(problem||uid>10000){message=problem||'Installation limit reached. Start from a preset.';render();return;}
  mutate(()=>{fit.items.push(p);fit.states.push(F.freshState(p));fit.selected=uid;},C.get(type).name+' added to '+S.get(p.section).name.toLowerCase()+'.');
 }
 // Fade the intact native art, then reveal the selected section through a soft
 // screen-space mask along its projected fore/aft axis. These are UI regions,
 // not geometry cuts or changes to equipment placement/capacity.
 function draw(){
  const map=$('fit-map'),focused=map.contains(document.activeElement)?document.activeElement.dataset.section:null;
  const P=art.projection,dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),labels={rear:[240,290],middle:[1270,330],front:[1530,1230]};
  const project=p=>[art.width/2+(dot(p,P.right)-P.centre_x_m)*P.pixels_per_metre,art.height/2-(dot(p,P.up)-P.centre_y_m)*P.pixels_per_metre];
  const [x1,y1]=project([-50,0,0]),[x2,y2]=project([50,0,0]);
  const a=(S.get('rear').point[0]+S.get('middle').point[0])/2/100+.5,b=(S.get('middle').point[0]+S.get('front').point[0])/2/100+.5,feather=.018;
  const stops=fit.section==='rear'?[[0,1],[a-feather,1],[a+feather,0],[1,0]]:fit.section==='front'?[[0,0],[b-feather,0],[b+feather,1],[1,1]]:[[0,0],[a-feather,0],[a+feather,1],[b-feather,1],[b+feather,0],[1,0]];
  const defs=svg('defs',{}),gradient=svg('linearGradient',{id:'fit-section-fade',gradientUnits:'userSpaceOnUse',x1,y1,x2,y2});
  for(const [offset,opacity]of stops)gradient.append(svg('stop',{offset,'stop-color':'white','stop-opacity':opacity}));
  const mask=svg('mask',{id:'fit-section-focus',maskUnits:'userSpaceOnUse',x:0,y:0,width:art.width,height:art.height});
  mask.append(svg('rect',{width:art.width,height:art.height,fill:'url(#fit-section-fade)'}));defs.append(gradient,mask);
  const image={href:'/assets/fleet-register/'+art.path,width:art.width,height:art.height,'pointer-events':'none','aria-hidden':'true'};
  const focus=svg('g',{class:'fit-art-focus','pointer-events':'none'});focus.append(svg('image',{...image,mask:'url(#fit-section-focus)'}));
  map.replaceChildren(defs,svg('image',{...image,class:'fit-art-muted'}),focus);
  map.setAttribute('aria-label','KESTREL artwork. '+S.get(fit.section).name+' highlighted; other sections faded. Select front, middle or rear.');
  $('fit-focus-label').textContent='Editing: '+S.get(fit.section).name;
  for(const s of result.sections){
   const x=art.width/2+(dot(s.point,P.right)-P.centre_x_m)*P.pixels_per_metre,y=art.height/2-(dot(s.point,P.up)-P.centre_y_m)*P.pixels_per_metre,[lx,ly]=labels[s.id];
   const damaged=fit.items.some((p,i)=>p.section===s.id&&fit.states[i].condition<100),g=svg('g',{class:'fit-section-marker'+(s.id===fit.section?' selected':'')+(damaged?' damaged':''),tabindex:0,role:'button','aria-label':'Select '+s.name+' section','aria-pressed':String(s.id===fit.section),'data-section':s.id});
   // A continuous hit target covers the callout and its tether, including the
   // empty space between them, for touch and ordinary button activation.
   const hitX=Math.min(x-22,lx-145),hitY=Math.min(y-22,ly-35);
   g.append(svg('rect',{class:'fit-marker-hit',x:hitX,y:hitY,width:Math.max(x+22,lx+145)-hitX,height:Math.max(y+22,ly+85)-hitY}));
   g.append(svg('path',{d:`M${x} ${y} L${lx} ${ly+35}`}),svg('circle',{cx:x,cy:y,r:18}),svg('rect',{x:lx-145,y:ly-35,width:290,height:120,rx:5}),svg('text',{x:lx,y:ly+12,'text-anchor':'middle',class:'fit-marker-title'},s.name.toUpperCase()),svg('text',{x:lx,y:ly+55,'text-anchor':'middle',class:'fit-marker-space'},s.used+' / '+s.capacity+' SPACE'));
   g.addEventListener('click',()=>chooseSection(s.id));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseSection(s.id);}});map.append(g);
   if(focused===s.id)g.focus({preventScroll:true});
  }
 }
 function render(){
  result=F.evaluate(fit);const section=S.get(fit.section),members=fit.items.flatMap((p,i)=>p.section===fit.section?[i]:[]);
  if(members.length&&!members.includes(index()))fit.selected=fit.items[members[0]].uid;
  $('fit-budget').replaceChildren(metric('Space',result.occupied+' / '+result.total,'Across three sections',result.sections.some(s=>s.used>s.capacity)),metric('Power demand',watts(result.requested),'Available: '+watts(result.supply),result.requested>result.used+1),metric('Build cost',num(result.cost)+' cr',num(Math.abs(fit.budget-result.cost))+(fit.budget>=result.cost?' remaining':' over budget'),result.cost>fit.budget),metric('Jump charging','+'+watts(result.jumpPeak),result.jumpCount?'Compact · high power draw':'No jump-drive expense'));
  $('fit-phase').value=fit.phase;$('fit-budget-target').value=fit.budget;$('fit-jump-status').textContent=result.jumpStatus;
  $('fit-event').textContent=message;$('fit-converted').hidden=!fit.converted;$('fit-warnings').replaceChildren(...result.warnings.map(t=>node('li',t)));
  for(const s of result.sections){const b=sectionButtons.get(s.id);b.setAttribute('aria-pressed',String(s.id===fit.section));b.replaceChildren(node('strong',s.name),node('span',s.used+' / '+s.capacity+' spaces'),node('small',s.used>s.capacity?(s.used-s.capacity)+' over capacity':(s.capacity-s.used)+' free'));}
  $('fit-section-target').textContent='Damage test · '+section.name;$('fit-section-hit').disabled=!members.some(i=>fit.states[i].condition>0);$('fit-section-repair').disabled=!members.some(i=>fit.states[i].condition<100);
  $('fit-manifest-title').textContent=section.name+' equipment';$('fit-manifest-space').textContent=members.length+' installed';$('fit-catalog-target').textContent='Adding to '+section.name.toLowerCase();
  const installed=$('fit-installed'),focus=installed.contains(document.activeElement)?document.activeElement.dataset.uid:null;installed.replaceChildren();
  for(const i of members){const p=fit.items[i],c=C.get(p.type),b=node('button',undefined,'fit-installed '+status(i));b.dataset.uid=p.uid;b.setAttribute('aria-pressed',String(p.uid===fit.selected));b.append(node('span',c.name),node('small',c.size+' · '+c.space+' sp · '+fit.states[i].condition+'%'));b.addEventListener('click',()=>select(p.uid));installed.append(b);if(focus===String(p.uid))b.focus({preventScroll:true});}
  if(!members.length)installed.append(node('p','Empty section. Add hardware below.','outfit-caption'));
  $('fit-component').hidden=!members.length;
  if(members.length){
   const i=index(),p=fit.items[i],c=C.get(p.type),s=fit.states[i],r=result.rows[i];
   $('fit-kind').textContent=c.locked?'Fixed core installation':'Installation '+p.uid;$('fit-name').textContent=c.name;$('fit-state').textContent=r.reason;$('fit-state').className=status(i);$('fit-note').textContent=c.note;
   const facts=[['Size / space',c.size+' · '+c.space+' spaces'],['Build cost',num(c.cost)+' cr'],[c.generation?'Output range':'Power draw',power(c).replace(/^(Output|Draw) /,'')],['Allocated now',watts(r.allocated)]];
   if(c.generation)facts.push(['Output now',watts(r.output)]);
   if(c.quantity&&!c.generation)facts.push([c.kind==='fuel_tank'?'Propellant':'Ammunition',num(s.quantity)+(c.kind==='fuel_tank'?' kg':' rounds')]);
   $('fit-facts').replaceChildren(...facts.map(([k,v])=>{const d=node('div');d.append(node('dt',k),node('dd',v));return d;}));
   $('fit-location').value=p.section;$('fit-location').disabled=!!c.locked;for(const o of $('fit-location').options)o.disabled=!!c.section&&o.value!==c.section;
   $('fit-remove').disabled=!!c.locked;$('fit-condition').value=s.condition;$('fit-condition-label').textContent=s.condition+'%';$('fit-enabled').checked=s.enabled;$('fit-priority').value=s.priority;$('fit-priority').disabled=!!c.generation||result.model.machines[i].DemandWatts===0;
   $('fit-hit').disabled=s.condition===0;$('fit-repair').disabled=s.condition===100;
   const store=$('fit-store');store.hidden=!['gun','fuel_tank','magazine'].includes(c.kind);store.disabled=c.kind==='gun'?!r.ready:!s.quantity;store.textContent=c.kind==='gun'?'Test fire · spend 1 round':'Simulate empty store';
  }
  $('fit-undo').disabled=!history.length;
  for(const[id,{button,hint}]of catalogButtons){const problem=F.canAssign(fit.items,{type:id,section:fit.section});button.disabled=!!problem;hint.textContent=problem||'Add to '+section.name.toLowerCase()+' +';}
  $('fit-readiness').replaceChildren(metric('Main thrust',(result.thrust/1e6).toLocaleString('en-US',{maximumFractionDigits:1})+' MN','Available in this model'),metric('Weapons',result.guns+' / '+result.gunTotal,'Ready with ammunition'),metric('Shields',result.shields+' / '+result.shieldTotal,'Powered emitters'),metric('Mission',result.jumpCount?'Jump-equipped':'Local defense',result.jumpCount?'Charging needs available power':'Local / assisted travel'));
  draw();
 }
 for(const s of D.sections){const b=node('button');b.addEventListener('click',()=>chooseSection(s.id));$('fit-sections').append(b);sectionButtons.set(s.id,b);}
 for(const c of D.catalog.filter(c=>!c.locked)){
  const card=node('div',undefined,'fit-catalog-item type-'+c.id),button=node('button'),hint=node('span');button.append(hint);button.setAttribute('aria-label','Add '+c.name);card.append(node('strong',c.name),node('span',c.size+' · '+c.space+' spaces · '+num(c.cost)+' cr'),node('small',power(c)),button);button.addEventListener('click',()=>add(c.id));$('fit-catalog').append(card);catalogButtons.set(c.id,{button,hint});
 }
 $('fit-location').addEventListener('change',e=>{const i=index(),p=fit.items[i],next={...p,section:e.target.value};if(C.get(p.type).locked||next.section===p.section){render();return;}const problem=F.canAssign(fit.items,next,p.uid);if(problem){message=problem+'.';render();return;}mutate(()=>{fit.items[i]=next;fit.section=next.section;},'Equipment reassigned to '+S.get(next.section).name.toLowerCase()+'.');});
 $('fit-remove').addEventListener('click',()=>{const i=index(),c=C.get(fit.items[i].type);if(c.locked)return;mutate(()=>{fit.items.splice(i,1);fit.states.splice(i,1);fit.selected=fit.items[0].uid;},c.name+' removed. '+c.space+' spaces and '+c.cost+' credits released.');});
 $('fit-section-hit').addEventListener('click',()=>mutate(()=>{fit.items.forEach((p,i)=>{if(p.section===fit.section)fit.states[i].condition=Math.max(0,fit.states[i].condition-25);});},S.get(fit.section).name+' hit: each assigned component lost 25 condition points. Space and cost stay reserved.'));
 $('fit-section-repair').addEventListener('click',()=>mutate(()=>{fit.items.forEach((p,i)=>{if(p.section===fit.section)fit.states[i].condition=100;});},S.get(fit.section).name+' repaired. Stores and on/off settings are unchanged.'));
 $('fit-condition').addEventListener('change',e=>{const value=Number(e.target.value);mutate(()=>{fit.states[index()].condition=value;},'Working condition changed. Space and purchase cost remain.');});
 $('fit-hit').addEventListener('click',()=>mutate(()=>{fit.states[index()].condition=Math.max(0,fit.states[index()].condition-25);},'Component damaged. Check the ship’s remaining capability.'));
 $('fit-repair').addEventListener('click',()=>mutate(()=>{fit.states[index()].condition=100;},'Prototype component repaired.'));
 $('fit-enabled').addEventListener('change',e=>{const value=e.target.checked;mutate(()=>{fit.states[index()].enabled=value;},value?'Equipment enabled.':'Equipment switched off. It still occupies space and costs the same to build.');});
 $('fit-priority').addEventListener('change',e=>{const value=Number(e.target.value);mutate(()=>{fit.states[index()].priority=value;},'Power priority changed. Dependencies are still supplied first.');});
 $('fit-phase').addEventListener('change',e=>{const value=e.target.value;mutate(()=>{fit.phase=value;},value==='jump'?'Jump charging requested. Check what the reactors can supply alongside propulsion and weapons.':'Normal operation. Jump charging no longer reserves power.');});
 $('fit-budget-target').addEventListener('change',e=>{const value=Number(e.target.value);if(!Number.isInteger(value)||value<0||value>100000){e.target.value=fit.budget;message='Choose a whole-number budget from 0 to 100,000.';render();return;}mutate(()=>{fit.budget=value;},'Design-credit budget updated.');});
 $('fit-store').addEventListener('click',()=>{const i=index(),m=result.model.machines[i];if(m.kind_name==='gun'&&result.rows[i].ready&&m.ammo_store>=0)mutate(()=>{fit.states[m.ammo_store].quantity--;},'One round spent from the connected magazine.');else if(['fuel_tank','magazine'].includes(m.kind_name))mutate(()=>{fit.states[i].quantity=0;},'Store emptied. Its reserved space remains.');});
 for(const b of document.querySelectorAll('[data-fit-preset]'))b.addEventListener('click',()=>{const next=F.preset(b.dataset.fitPreset);if(!F.validate(next))return;snapshot();fit=next;commit(D.presets[b.dataset.fitPreset].name+' loaded with intact equipment. Undo restores your previous fit.');});
 $('fit-undo').addEventListener('click',()=>{if(history.length){fit=history.pop();commit('Previous fit restored.');}});
 $('fit-share').addEventListener('click',async()=>{const url=location.origin+'/ship-lab#fit='+btoa(JSON.stringify(fit));$('fit-share-url').value=url;$('fit-share-result').hidden=false;try{await navigator.clipboard.writeText(url);$('fit-save').textContent='Fit link copied. Paste it into your discussion.';}catch{$('fit-save').textContent='Copy the fit link below.';$('fit-share-url').focus();$('fit-share-url').select();}});
 $('fit-export').addEventListener('click',()=>{const receipt={purpose:'Fleet in Pieces section outfitting UI prototype; not an engine save',catalog:D.version,fit,totals:{space:result.occupied,capacity:result.total,designCredits:result.cost,normalWatts:result.normalDemand,jumpChargingWatts:result.jumpPeak,sections:result.sections.map(s=>({section:s.id,used:s.used,capacity:s.capacity}))}},url=URL.createObjectURL(new Blob([JSON.stringify(receipt,null,2)],{type:'application/json'})),a=node('a');a.href=url;a.download='kestrel-section-study.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 addEventListener('hashchange',()=>{if(location.hash.startsWith('#setup=')){setWorkshop('native');return;}if(!location.hash.startsWith('#fit='))return;const v=decode(location.hash);if(!v){message='That shared fit is invalid. Your current design is unchanged.';render();return;}snapshot();fit=v;setWorkshop('design');commit('Shared fit opened as a separate copy.');historyReplace();});
 function historyReplace(){window.history.replaceState(null,'',location.pathname+location.search);}
 render();if(shared){persist();historyReplace();}else $('fit-save').textContent=storage?'Fit stays in this browser · no account needed':'Browser storage unavailable · keep a Share fit link';
})();
