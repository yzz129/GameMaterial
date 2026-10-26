'use strict';
// One renderer per visible illustration, with image-space regions supplied by the theme.
// Faces, hands and rigid props can be pinned independently from cloth and hair.
window.PortalScenes = (() => {
  const vertex = `attribute vec2 a_position; varying vec2 v_uv;
    void main(){v_uv=vec2((a_position.x+1.0)*.5,(1.0-a_position.y)*.5);gl_Position=vec4(a_position,0.0,1.0);}`;
  const fragment = `precision mediump float;
    varying vec2 v_uv; uniform sampler2D u_image; uniform vec2 u_scale,u_offset;
    uniform float u_time; uniform int u_count,u_lockCount,u_lineCount,u_light;
    uniform vec4 u_regions[8],u_motion[8],u_locks[4],u_lines[2]; uniform vec2 u_lineWidth;
    float area(vec2 p,vec4 r){vec2 q=(p-r.xy)/max(r.zw,vec2(.001));return exp(-2.5*dot(q,q));}
    float lineLock(vec2 p,vec4 s,float w){vec2 d=s.zw-s.xy;float t=clamp(dot(p-s.xy,d)/max(dot(d,d),.0001),0.0,1.0);return 1.0-smoothstep(w,w*2.0,length(p-s.xy-t*d));}
    void main(){
      vec2 p=(v_uv-u_offset)/u_scale;
      if(p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0){gl_FragColor=vec4(0.0);return;}
      float pin=0.0;
      for(int i=0;i<4;i++){if(i<u_lockCount){vec2 q=(p-u_locks[i].xy)/u_locks[i].zw;pin=max(pin,1.0-smoothstep(.65,1.25,length(q)));}}
      for(int i=0;i<2;i++){if(i<u_lineCount)pin=max(pin,lineLock(p,u_lines[i],i==0?u_lineWidth.x:u_lineWidth.y));}
      vec2 flow=vec2(0.0);
      for(int i=0;i<8;i++){if(i<u_count){vec4 m=u_motion[i];float phase=u_time*m.z+m.w+p.y*3.0;flow+=area(p,u_regions[i])*m.xy*vec2(sin(phase),sin(phase+.7));}}
      float edge=smoothstep(0.0,.035,min(min(p.x,1.0-p.x),min(p.y,1.0-p.y)));
      vec4 color=texture2D(u_image,clamp(p-flow*(1.0-pin)*edge,vec2(0.0),vec2(1.0)));
      if(u_light==1){float stars=smoothstep(.32,.82,color.b)*smoothstep(.02,.25,color.b-color.r);color.rgb*=1.0+.13*sin(u_time*.7+p.x*31.0+p.y*47.0)*stars*(1.0-pin);}
      if(u_light==2){float blue=smoothstep(.02,.2,color.b-color.r);float arc=pow(max(0.0,sin(atan(p.y-.52,p.x-.5)*2.0-u_time*.85)),12.0);color.rgb+=vec3(.07,.12,.19)*blue*arc*color.a*(1.0-pin);}
      if(u_light==3){float fire=area(p,vec4(.565,.86,.13,.2));color.rgb+=vec3(.07,.035,.005)*fire*(.5+.5*sin(u_time*1.4))*color.a;}
      gl_FragColor=color;
    }`;

  function mount(isActive) {
    const life=new AbortController(),options={signal:life.signal};
    const compact=matchMedia('(max-width: 680px)');
    const lowPower=Boolean(navigator.deviceMemory&&navigator.deviceMemory<=2||navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=2);
    const scenes=[],videos=[],groups=[...document.querySelectorAll('[data-motion-group]')];
    let frame=0,last=0,disposed=false;

    function makeScene(host) {
      const image=host.querySelector('.motion-source');
      if(!image)return null;
      let profile;
      try{profile=JSON.parse(host.dataset.motionProfile);}catch{return null;}
      const canvas=document.createElement('canvas');canvas.className='scene-canvas';canvas.setAttribute('aria-hidden','true');host.append(canvas);
      let gl,program,texture,buffer,uniforms,ready=false,failed=false,view=false,time=0,draws=0,dirty=true;
      const regions=(profile.regions||[]).slice(0,8),locks=(profile.locks||[]).slice(0,4),lines=(profile.lines||[]).slice(0,2);
      function free(){
        if(!gl)return;
        if(texture)gl.deleteTexture(texture);if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);
        texture=buffer=program=null;ready=false;
      }
      function fail(){failed=true;ready=false;host.dataset.sceneState='fallback';delete host.dataset.rendered;free();}
      function compile(kind,source){const shader=gl.createShader(kind);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);throw Error('Scene shader compilation failed');}return shader;}
      function init(){
        if(ready||failed||!image.complete||!image.naturalWidth)return;
        try{
          gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,powerPreference:'low-power'});
          if(!gl){fail();return;}
          const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
          program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
          if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Scene shader link failed');
          gl.useProgram(program);
          buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,1,-1,-1,1,1,1,-1]),gl.STATIC_DRAW);
          const position=gl.getAttribLocation(program,'a_position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
          texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
          gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
          gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
          uniforms=Object.fromEntries(['scale','offset','time','count','lockCount','lineCount','light','regions','motion','locks','lines','lineWidth'].map(key=>[key,gl.getUniformLocation(program,'u_'+key+(['regions','motion','locks','lines'].includes(key)?'[0]':''))]));
          const packed=(entries,size,selector)=>{const data=new Float32Array(size*4);entries.forEach((entry,index)=>data.set(selector(entry),index*4));return data;};
          gl.uniform4fv(uniforms.regions,packed(regions,8,r=>r.area));gl.uniform4fv(uniforms.motion,packed(regions,8,r=>r.motion));gl.uniform4fv(uniforms.locks,packed(locks,4,r=>r));gl.uniform4fv(uniforms.lines,packed(lines,2,r=>r.points));
          gl.uniform2f(uniforms.lineWidth,lines[0]?.width||.01,lines[1]?.width||.01);
          gl.uniform1i(uniforms.count,regions.length);gl.uniform1i(uniforms.lockCount,locks.length);gl.uniform1i(uniforms.lineCount,lines.length);gl.uniform1i(uniforms.light,profile.light||0);
          ready=true;dirty=true;draw(0);host.dataset.rendered='true';
        }catch{fail();}
      }
      function resize(){
        const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return false;
        const maxPixels=lowPower?450000:compact.matches?700000:1500000;
        const dpr=Math.min(devicePixelRatio||1,1.5,Math.sqrt(maxPixels/(width*height)));
        canvas.width=Math.max(1,Math.round(width*dpr));canvas.height=Math.max(1,Math.round(height*dpr));gl.viewport(0,0,canvas.width,canvas.height);
        const style=getComputedStyle(image),scale=(style.objectFit==='contain'?Math.min:Math.max)(width/image.naturalWidth,height/image.naturalHeight);
        const sx=image.naturalWidth*scale/width,sy=image.naturalHeight*scale/height;
        const parts=style.objectPosition.split(' '),position=(s,fallback)=>s?.endsWith('%')?parseFloat(s)/100:({left:0,top:0,center:.5,right:1,bottom:1}[s]??fallback);
        gl.uniform2f(uniforms.scale,sx,sy);gl.uniform2f(uniforms.offset,(1-sx)*position(parts[0],.5),(1-sy)*position(parts[1],.5));dirty=false;return true;
      }
      function draw(dt){
        if(!ready||dirty&&!resize())return;
        time+=dt;gl.uniform1f(uniforms.time,time);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);draws++;
        if(draws===1||draws%12===0){host.dataset.sceneFrames=String(draws);host.dataset.sceneTime=time.toFixed(2);}
      }
      const resizeObserver=new ResizeObserver(()=>{dirty=true;wake();});resizeObserver.observe(host);
      image.addEventListener('load',()=>{dirty=true;if(view&&isActive())init();wake();},options);
      image.addEventListener('error',()=>{fail();wake();},options);
      canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();ready=false;failed=true;delete host.dataset.rendered;host.dataset.sceneState='fallback';},options);
      canvas.addEventListener('webglcontextrestored',()=>{failed=false;free();if(view&&isActive())init();wake();},options);
      return {host,get active(){return view&&isActive()&&ready&&!failed;},setView(value){view=value;this.sync();},sync(){if(view&&isActive())init();host.dataset.sceneState=failed?'fallback':view&&isActive()&&ready?'running':'paused';},draw,dispose(){resizeObserver.disconnect();free();gl?.getExtension('WEBGL_lose_context')?.loseContext();canvas.remove();delete host.dataset.rendered;}};
    }

    function makeVideo(video){
      let view=false,failed=false;video.muted=true;
      function sync(){
        if(!view||!isActive()||failed){video.pause();video.dataset.sceneState='paused';return;}
        const source=compact.matches&&video.dataset.mobileSrc?video.dataset.mobileSrc:video.dataset.desktopSrc;
        if(video.getAttribute('src')!==source){video.src=source;video.load();}
        video.play().catch(()=>{video.dataset.sceneState='poster';});
      }
      video.addEventListener('playing',()=>{video.dataset.sceneState='running';video.dataset.rendered='true';},options);
      video.addEventListener('pause',()=>{video.dataset.sceneState='paused';},options);
      video.addEventListener('error',()=>{failed=true;video.dataset.sceneState='poster';delete video.dataset.rendered;},options);
      return {host:video,setView(value){view=value;sync();},sync,dispose(){video.pause();video.removeAttribute('src');video.load();}};
    }
    for(const host of document.querySelectorAll('[data-motion-profile]')){const scene=makeScene(host);if(scene)scenes.push(scene);}
    for(const video of document.querySelectorAll('[data-scene-video]'))videos.push(makeVideo(video));
    const controlled=new Map([...scenes,...videos].map(item=>[item.host,item]));
    const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{
      for(const entry of entries){const visible=entry.isIntersecting&&entry.intersectionRatio>0;entry.target.dataset.inView=String(visible);controlled.get(entry.target)?.setView(visible);}
      wake();
    },{threshold:0}):null;
    for(const host of new Set([...groups,...controlled.keys()])){if(observer)observer.observe(host);else{host.dataset.inView='true';controlled.get(host)?.setView(true);}}
    function tick(timestamp){
      frame=0;if(disposed||!isActive())return;
      if(!scenes.some(scene=>scene.active)){last=0;return;}
      const interval=1000/(lowPower?20:compact.matches?24:30);
      if(last&&timestamp-last<interval){frame=requestAnimationFrame(tick);return;}
      const dt=last?Math.min((timestamp-last)/1000,.09):0;last=timestamp;
      for(const scene of scenes)if(scene.active)scene.draw(dt);
      frame=requestAnimationFrame(tick);
    }
    function wake(){if(disposed)return;for(const item of [...scenes,...videos])item.sync();if(!isActive()){if(frame)cancelAnimationFrame(frame);frame=0;last=0;}else if(!frame)frame=requestAnimationFrame(tick);}
    addEventListener('portal:motion-change',wake,options);compact.addEventListener('change',wake,options);
    addEventListener('pagehide',event=>{if(frame)cancelAnimationFrame(frame);frame=0;last=0;for(const item of videos)item.host.pause();if(!event.persisted){disposed=true;observer?.disconnect();life.abort();for(const item of [...scenes,...videos])item.dispose();}},options);
    addEventListener('pageshow',wake,options);wake();
  }
  return {mount};
})();
