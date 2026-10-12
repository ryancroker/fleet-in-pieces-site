/* Native KITE parts, with source-derived light barrels/projectors on original mounts.
 * Redraw only on input/resize; no ticking simulation, polling or backend requests. */
(()=>{'use strict';
 const D=window.FleetCarrierData,G=window.FleetOutfitGeometry,canvas=document.getElementById('carrier-hull'),message=document.getElementById('carrier-render-status');
 if(!D||!G||!canvas)return;
 let gl,program,bytes,latest,frame=0,ready=false;const U={};
 const guns=D.machines.filter(m=>m.kind_name==='gun').slice(0,2),shields=D.machines.filter(m=>m.kind_name==='shield');
 const replaced=new Set([...guns.flatMap(m=>[m.part,m.part+1,m.part+2]),...shields.map(m=>m.part)]);
 const vs=`attribute vec3 position;attribute vec4 color;uniform vec3 shift,right,up,toward;uniform vec3 camera;uniform float section,selected,condition,powered;varying vec4 tint;
 void main(){vec3 p=position+shift;gl_Position=vec4((dot(p,right)-camera.x)*camera.z/1024.0,(dot(p,up)-camera.y)*camera.z/768.0,-dot(p,toward)/512.0,1.0);
 float rear=1.0-smoothstep(-70.0,-60.0,p.x),front=smoothstep(60.0,70.0,p.x);float active=section<0.5?front:section<1.5?1.0-max(front,rear):rear;
 vec3 rgb=mix(color.rgb*.65,color.rgb,powered);rgb=mix(rgb,vec3(.64,.32,.23),.4*(1.0-condition));rgb+=vec3(.06,.09,.1)*selected;tint=vec4(rgb,.23+.77*active);}`;
 function fail(){ready=false;canvas.hidden=true;message.textContent='Live ship view unavailable. Fitting and damage controls still work below.';}
 function init(){
  gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});if(!gl)throw Error('WebGL');
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Shader');return s;}
  program=gl.createProgram();for(const [type,source] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,'precision mediump float;varying vec4 tint;void main(){gl_FragColor=tint;}']]){const s=shader(type,source);gl.attachShader(program,s);gl.deleteShader(s);}gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Program');gl.useProgram(program);
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,bytes,gl.STATIC_DRAW);
  for(const n of ['position','color']){const a=gl.getAttribLocation(program,n);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,n==='position'?3:4,n==='position'?gl.FLOAT:gl.UNSIGNED_BYTE,n==='color',16,n==='position'?0:12);}
  for(const n of ['shift','right','up','toward','camera','section','selected','condition','powered'])U[n]=gl.getUniformLocation(program,n);
  for(const n of ['right','up','toward'])gl.uniform3fv(U[n],D.projection[n]);gl.uniform3f(U.camera,D.projection.centre_x_m,D.projection.centre_y_m,D.projection.pixels_per_metre);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);gl.clearColor(0,0,0,0);ready=true;canvas.hidden=false;message.textContent='Native KITE hull · live fitted guns & projectors';schedule();
 }
 function part(key,offset=[0,0,0],machine=-1){const g=G.groups[key];if(!g)return;
  const s=latest.states[machine];gl.uniform3fv(U.shift,offset);gl.uniform1f(U.selected,machine===latest.selected?1:0);gl.uniform1f(U.condition,s?s.condition/100:1);gl.uniform1f(U.powered,s?Number(s.enabled):1);gl.drawArrays(gl.TRIANGLES,g.first,g.count);
 }
 function draw(){frame=0;if(!ready||!latest)return;
  const w=Math.min(2048,Math.max(320,Math.round(canvas.clientWidth*Math.min(devicePixelRatio||1,2))));if(canvas.width!==w){canvas.width=w;canvas.height=Math.round(w*.75);}
  gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(U.section,['front','middle','rear'].indexOf(latest.section));
  for(const p of D.parts)if(!replaced.has(p.index)){const m=D.machines.find(m=>m.part===p.index);part(String(p.index),[0,0,0],m?.index??-1);}
  guns.forEach((m,i)=>{part(String(m.part),[0,0,0],m.index);part(String(m.part+1),[0,0,0],m.index);const choice=i?latest.aft:latest.fore;
   if(!choice)part(String(m.part+2),[0,0,0],m.index);else{const offset=[0,0,0];for(const p of D.parts.filter(p=>p.index>=m.part&&p.index<=m.part+2))p.offset_m.forEach((v,k)=>offset[k]+=v);part('aft-'+(choice===1?'rapid':'lance'),offset,m.index);}
  });
  for(const m of shields)if(latest.emitter===3)part(String(m.part),[0,0,0],m.index);else part(['reservoir','cascade','facet'][latest.emitter],D.parts[m.part].offset_m,m.index);
  canvas.dataset.fit=[latest.emitter,latest.fore,latest.aft].join(':');
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(draw);}
 fetch(G.asset).then(r=>{if(!r.ok)throw Error('Mesh');return r.arrayBuffer();}).then(b=>{bytes=b;init();}).catch(fail);
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail();});canvas.addEventListener('webglcontextrestored',()=>{try{init();}catch{fail();}});new ResizeObserver(schedule).observe(canvas);
 window.FleetCarrierRenderer={update(value){latest=value;schedule();}};
})();
