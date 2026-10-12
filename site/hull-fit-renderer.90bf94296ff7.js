/* Draw the exported part surfaces only, on change. Never redraw a stock image
 * underneath removed modules. Geometry is lazy and identity-pinned per hull. */
(()=>{'use strict';
 const canvas=document.getElementById('refit-canvas'),status=document.getElementById('refit-render-status');if(!canvas)return;
 let gl,program,buffer,bytes,model,latest,frame=0,ticket=0,ready=false,controller;const U={};
 const vertex=`attribute vec3 position;attribute vec4 color;
 uniform vec3 right,up,toward;uniform vec4 camera;uniform vec2 imageSize,bounds;
 uniform float section,selected,condition,powered;varying vec4 tint;
 void main(){gl_Position=vec4((dot(position,right)-camera.x)*camera.z/(imageSize.x*.5),(dot(position,up)-camera.y)*camera.z/(imageSize.y*.5),-dot(position,toward)/camera.w,1.0);
 float t=(position.x-bounds.x)/max(.01,bounds.y-bounds.x);float a=section<-.5?1.:section<.5?1.-smoothstep(.31,.35,t):section<1.5?smoothstep(.31,.35,t)*(1.-smoothstep(.65,.69,t)):smoothstep(.65,.69,t);
 vec3 rgb=mix(color.rgb*.55,color.rgb,powered);rgb=mix(rgb,vec3(.65,.33,.23),.4*(1.-condition))+vec3(.07,.10,.12)*selected;tint=vec4(rgb,.22+.78*a);}`;
 function fail(){ready=false;canvas.hidden=true;status.textContent='Live geometry could not load. The equipment controls remain available; reload to retry the ship view.';}
 function setup(){
  gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});if(!gl)throw Error('WebGL unavailable');
  if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);
  const shader=(kind,source)=>{const s=gl.createShader(kind);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Shader');return s;};
  program=gl.createProgram();for(const [kind,source]of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,'precision mediump float;varying vec4 tint;void main(){gl_FragColor=tint;}']]){const s=shader(kind,source);gl.attachShader(program,s);gl.deleteShader(s);}gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Program');gl.useProgram(program);
  buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,bytes,gl.STATIC_DRAW);
  for(const name of ['position','color']){const a=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,name==='position'?3:4,name==='position'?gl.FLOAT:gl.UNSIGNED_BYTE,name==='color',16,name==='position'?0:12);}
  for(const n of ['right','up','toward','camera','imageSize','bounds','section','selected','condition','powered'])U[n]=gl.getUniformLocation(program,n);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);gl.clearColor(0,0,0,0);ready=true;canvas.hidden=false;status.textContent='Native parts · removing a module changes this view';schedule();
 }
 function draw(){frame=0;if(!ready||!latest||!model)return;
  const {fit,derived,view}=latest,art=model.art[view],p=art.projection,range=model.refit.geometry.bounds;
  const w=Math.min(2048,Math.max(320,Math.round(canvas.clientWidth*Math.min(devicePixelRatio||1,2))));
  const h=Math.round(w*art.height/art.width);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
  for(const key of ['right','up','toward'])gl.uniform3fv(U[key],p[key]);
  const depth=Math.max(1,...range.flat().map(Math.abs))*4;
  gl.uniform4f(U.camera,p.centre_x_m,p.centre_y_m,p.pixels_per_metre,depth);gl.uniform2f(U.imageSize,art.width,art.height);gl.uniform2f(U.bounds,range[0][0],range[1][0]);
  gl.uniform1f(U.section,['rear','middle','front'].indexOf(fit.section));
  const selected=model.refit.modules.find(m=>m.id===fit.selected),drawn=[];
  for(const [id,g]of Object.entries(model.refit.geometry.groups)){
   const part=Number(id);if(derived.parts.has(part))continue;
   const owner=model.refit.modules.find(m=>m.parts.includes(part)),state=owner?fit.states[owner.primary]:null;
   gl.uniform1f(U.selected,selected?.parts.includes(part)?1:0);gl.uniform1f(U.condition,state?state.condition/100:1);gl.uniform1f(U.powered,state?Number(derived.result.rows[owner.primary].ready):1);
   gl.drawArrays(gl.TRIANGLES,g.first,g.count);drawn.push(part);
  }
  canvas.dataset.parts=drawn.join(',');canvas.dataset.removed=fit.removed.join(',');
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(draw);}
 async function load(next){const current=++ticket;controller?.abort();controller=new AbortController();ready=false;canvas.hidden=true;model=next;status.textContent='Loading this hull’s native parts…';
  try{const r=await fetch(model.refit.geometry.asset,{credentials:'omit',signal:controller.signal});if(!r.ok||!r.body)throw Error('Mesh');
   const data=await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();if(current!==ticket)return;
   if(data.byteLength!==model.refit.geometry.bytes)throw Error('Mesh size');bytes=data;setup();
  }catch(e){if(current===ticket&&e.name!=='AbortError')fail();}
 }
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail();});canvas.addEventListener('webglcontextrestored',()=>{try{setup();}catch{fail();}});
 new ResizeObserver(schedule).observe(canvas);
 window.FleetHullRenderer={load,update(value){latest=value;schedule();}};
})();
