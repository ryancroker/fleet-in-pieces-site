(() => {
 'use strict';
 const data=window.FleetDesignerData,$=id=>document.getElementById(id);
 if(!data||!$('designer-hull'))return;
 const select=$('designer-hull'),category=$('designer-category'),search=$('designer-search');
 const initial=location.pathname.includes('/kite')?'kite':new URLSearchParams(location.search).get('ship')||'kestrel';
 let current=data.entries.find(e=>e.key===initial)||data.entries[0];
 category.value=current.category;
 function show(){
  if(!current)return;
  const registeredView=location.pathname==='/ship-lab/refit',articleEditor=!registeredView&&['kestrel','kite'].includes(current.key);
  const edition=articleEditor&&current.fitting||current;
  $('designer-art').src=current.hero;$('designer-art').alt=current.name+' native hull reference';
  $('designer-art').hidden=articleEditor&&!!current.fitting;document.querySelector('.designer-selection').classList.toggle('designer-no-thumbnail',articleEditor&&!!current.fitting);
  $('designer-name').textContent=current.name+' · '+current.role;
  $('designer-edition').textContent=edition.recipe+' · exported '+edition.exported.slice(0,10);
  $('designer-capability').textContent=current.crew?current.crew.bunks+' bunks · '+current.crew.complement+' native crew · '+(current.crew.watts/1000).toLocaleString('en-US')+' kW life support.':articleEditor?'Article fitting · hull-specific alternatives and limits.':current.modules?current.modules+' draft modules · original mounts; native build validation pending.':'Fixed architecture · inspect its systems; article fitting is not available yet.';
  $('designer-open').href=registeredView?current.registeredFitRoute:current.fitRoute;$('designer-open').textContent='Fit this ship →';
  $('designer-inspect').hidden=false;$('designer-inspect').href=current.inspectRoute;
  $('designer-inspect').textContent=articleEditor&&current.fitting?'Inspect earlier published edition →':'Inspect all systems →';
  const choices=data.entries.filter(e=>e.crew?.family===(current.crew?.family||current.key)),nav=$('designer-crew-options');
  nav.hidden=!choices.length;nav.replaceChildren();
  if(choices.length){const label=document.createElement('span');label.textContent='Crew fits';nav.append(label);for(const e of choices){const a=document.createElement('a');a.href=e.fitRoute+'#refit-crew';a.textContent=['','Minimum','Watch','Reserve'][e.crew.mode]+' · '+e.crew.bunks+' bunks';if(e.key===current.key)a.setAttribute('aria-current','page');nav.append(a);}}
 }
 function filter(){
  const query=search.value.trim().toLowerCase(),items=data.entries.filter(e=>(!category.value||e.category===category.value)&&(!query||(e.name+' '+e.role).toLowerCase().includes(query)));
  select.replaceChildren(...items.map(e=>new Option(e.name+' · '+e.role,e.key)));
  if(!items.some(e=>e.key===current?.key))current=items[0];
  if(current)select.value=current.key;
  select.disabled=!items.length;document.querySelector('.designer-selection').hidden=!items.length;
  $('designer-result').textContent=items.length+' matching hull'+(items.length===1?'':'s')+'. Published editions may predate current game changes.';show();
 }
 category.addEventListener('change',filter);search.addEventListener('input',filter);
 select.addEventListener('change',()=>{current=data.entries.find(e=>e.key===select.value);show();});filter();
 addEventListener('fleet:inspection-loaded',event=>{const active=data.entries.find(e=>e.key===event.detail?.key);if(!active)return;current=active;category.value=current.category;search.value='';filter();});
})();
