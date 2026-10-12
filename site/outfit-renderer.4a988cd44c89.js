/* Native part renderer. Draw only on fitting/selection/size changes, never poll.
 * Same orthographic camera and editorial lighting as the pinned registrar art.
 * A depth buffer reveals the real hull when an installed article is removed. */
(() => {
 'use strict';
 const G=window.FleetOutfitGeometry,canvas=document.getElementById('fit-hull');
 if(!canvas||!G)return;
 const message=document.getElementById('fit-render-status');
 let gl,program,buffer,latest=null,frame=0,ready=false;
 const locations={};
 const mounts={gun:{front:[[27.5,0,6]],middle:[[-3.5,0,7.5]],rear:[]},shield:{front:[[17,-4.5,4.5],[17,4.5,4.5]],middle:[],rear:[[-15.5,-3.5,5],[-15.5,3.5,5]]}};
 function fail(){ready=false;message.textContent='Live ship view unavailable in this browser. The equipment list still works.';canvas.hidden=true;}
 const vs=`attribute vec3 position;attribute vec4 color;
 uniform vec3 shift;uniform vec3 right;uniform vec3 up;uniform vec3 toward;
 uniform vec4 camera;uniform float section;uniform float selected;uniform float condition;uniform float powered;
 varying vec4 tint;
 void main(){vec3 p=position+shift;
 gl_Position=vec4((dot(p,right)-camera.x)*camera.z/1024.0,(dot(p,up)-camera.y)*camera.z/768.0,-dot(p,toward)/128.0,1.0);
 float rear=1.0-smoothstep(-13.0,-9.0,p.x),front=smoothstep(13.5,17.5,p.x);
 float active=section<0.5?front:section<1.5?1.0-max(front,rear):rear;
 vec3 rgb=mix(vec3(dot(color.rgb,vec3(.21,.72,.07))),color.rgb,.65+.35*active);
 rgb=mix(rgb*.7,rgb,powered);rgb=mix(rgb,vec3(.64,.32,.23),.4*(1.0-condition));
 rgb=mix(rgb,rgb*1.12,active)+vec3(.055,.08,.09)*selected;
 tint=vec4(rgb,.22+.78*active);}`;
 const fs='precision mediump float;varying vec4 tint;void main(){gl_FragColor=tint;}';
 function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Shader unavailable');return s;}
 function init(bytes){
  gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:false});if(!gl)throw Error('WebGL unavailable');
  program=gl.createProgram();const v=shader(gl.VERTEX_SHADER,vs),f=shader(gl.FRAGMENT_SHADER,fs);gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);gl.deleteShader(v);gl.deleteShader(f);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Shader unavailable');
  gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,bytes,gl.STATIC_DRAW);
  for(const name of ['position','color']){const a=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,name==='position'?3:4,name==='position'?gl.FLOAT:gl.UNSIGNED_BYTE,name==='color',16,name==='position'?0:12);}
  for(const name of ['shift','right','up','toward','camera','section','selected','condition','powered'])locations[name]=gl.getUniformLocation(program,name);
  const p=window.FleetLabData[0].art.hero.projection;
  for(const key of ['right','up','toward'])gl.uniform3fv(locations[key],p[key]);
  gl.uniform4f(locations.camera,p.centre_x_m,p.centre_y_m,p.pixels_per_metre,0);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);gl.clearColor(0,0,0,0);
  ready=true;canvas.hidden=false;message.textContent='Native hull · live weapons & emitters';schedule();
 }
 function drawPart(key,shift=[0,0,0],item=null){const g=G.groups[key];if(!g)return;
  gl.uniform3fv(locations.shift,shift);gl.uniform1f(locations.selected,item?.uid===latest.fit.selected?1:0);
  gl.uniform1f(locations.condition,item?item.state.condition/100:1);gl.uniform1f(locations.powered,item?Number(item.state.enabled):1);
  gl.drawArrays(gl.TRIANGLES,g.first,g.count);
 }
 function draw(){frame=0;if(!ready||!latest||canvas.closest('[hidden]'))return;
  const width=Math.min(2048,Math.max(320,Math.round(canvas.clientWidth*Math.min(devicePixelRatio||1,2))));
  if(canvas.width!==width){canvas.width=width;canvas.height=Math.round(width*.75);}
  gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.uniform1f(locations.section,['front','middle','rear'].indexOf(latest.fit.section));
  // Keep the registered hull and internal/drive reference. Weapons and shields
  // are drawn solely from the editable recipe, never from the old flat image.
  for(const part of ['0','11','12','13','14'])drawPart(part);
  const counts={};
  const items=latest.fit.items.map((p,i)=>({...p,state:latest.fit.states[i]})).sort((a,b)=>a.uid-b.uid);
  for(const p of items){const c=window.FleetOutfit.catalog.get(p.type),family=c.kind==='gun'?'gun':c.kind==='shield'?'shield':null;if(!family)continue;
   const key=family+':'+p.section,n=counts[key]||0;counts[key]=n+1;const mount=mounts[family][p.section][n];if(!mount)continue;
   if(family==='gun'){
    const small=p.section==='middle',base=small?4:1;
    drawPart(String(base),[0,0,0],p);drawPart(String(base+1),[0,0,0],p);
    if(!c.article||c.article==='stock')drawPart(String(base+2),[0,0,0],p);
    else drawPart((small?'aft-':'fore-')+c.article,[mount[0]+2,mount[1],mount[2]+1.5],p);
   }else if(!c.article||c.article==='stock')drawPart(String(p.section==='front'?7+n:n===0?10:9),[0,0,0],p);
   else drawPart(c.article,mount,p);
  }
  canvas.dataset.rendered=latest.fit.items.filter(p=>['gun','shield'].includes(window.FleetOutfit.catalog.get(p.type).kind)).map(p=>p.uid+':'+p.type+':'+p.section).join(',');
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(draw);}
 let bytes;
 fetch(G.asset).then(r=>{if(!r.ok)throw Error('Geometry unavailable');return r.arrayBuffer();}).then(b=>{bytes=b;init(b);}).catch(fail);
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail();});
 canvas.addEventListener('webglcontextrestored',()=>{try{init(bytes);}catch{fail();}});
 new ResizeObserver(schedule).observe(canvas);
 window.FleetOutfitRenderer={update(fit,result){latest={fit,result};schedule();}};
})();
