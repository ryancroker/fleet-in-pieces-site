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
  const edition=current.fitting||current;
  $('designer-art').src=current.hero;$('designer-art').alt=current.name+' native hull reference';
  $('designer-art').hidden=!!current.fitting;document.querySelector('.designer-selection').classList.toggle('designer-no-thumbnail',!!current.fitting);
  $('designer-name').textContent=current.name+' · '+current.role;
  $('designer-edition').textContent=edition.recipe+' · exported '+edition.exported.slice(0,10);
  $('designer-capability').textContent=current.fitRoute?'Editable fittings · hull-specific mounts and limits.':'Inspect systems · native reference geometry; fitting changes are not enabled for this hull yet.';
  $('designer-open').href=current.fitRoute||current.inspectRoute;$('designer-open').textContent=current.fitRoute?'Fit this ship →':'Inspect this ship →';
  $('designer-inspect').hidden=!current.fitRoute;$('designer-inspect').href=current.inspectRoute;
  $('designer-inspect').textContent=current.fitting?'Inspect earlier published edition →':'Inspect published systems →';
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
