'use strict';
(() => {
  const motion=createMotionPreference();
  window.PortalScenes?.mount(()=>motion.active);
  createAmbientParticles(document.getElementById('portalParticles'));
  document.querySelectorAll('[data-title-motion]').forEach(createTitleMotion);
  const input=document.getElementById('gameSearch'),cards=[...document.querySelectorAll('.world-card')],count=document.getElementById('gameCount'),empty=document.getElementById('searchEmpty');
  const normalize=value=>String(value).normalize('NFKC').toLowerCase().trim();
  function filter(){const words=normalize(input.value).split(/\s+/).filter(Boolean);let visible=0;for(const card of cards){card.hidden=!words.every(word=>card.dataset.search.includes(word));if(!card.hidden)visible++;}empty.hidden=visible>0;count.textContent=String(visible).padStart(2,'0')+' 个游戏';}
  input.addEventListener('input',filter);
  document.querySelector('.portal-search').addEventListener('submit',event=>{event.preventDefault();const visible=cards.filter(card=>!card.hidden);if(visible.length===1)location.assign(visible[0].href);else document.getElementById('games').scrollIntoView({block:'start'});});
  document.getElementById('clearGameSearch').addEventListener('click',()=>{input.value='';filter();input.focus();});
  document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!/INPUT|TEXTAREA/.test(document.activeElement?.tagName||'')){event.preventDefault();input.focus();}if(event.key==='Escape'&&document.activeElement===input){input.value='';filter();input.blur();}});

  function createMotionPreference() {
    const lifecycle=new AbortController(),options={signal:lifecycle.signal};
    const reduced=matchMedia('(prefers-reduced-motion: reduce)'),button=document.getElementById('footerMotion'),root=document.documentElement;
    let paused=false,override=false,suspended=false;
    try{paused=localStorage.getItem('gamematerial:portal-motion')==='off';}catch{}
    const state={get enabled(){return !paused&&(override||!reduced.matches&&!navigator.connection?.saveData);},get active(){return this.enabled&&!document.hidden&&!suspended;}};
    function sync(){
      root.dataset.motion=state.active?'running':'paused';root.dataset.motionOverride=String(override);
      if(button){const label=state.enabled?'暂停页面动效':'开启页面动效';button.dataset.playing=String(state.enabled);button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(!state.enabled));button.querySelector('.motion-label').textContent=label;}
      dispatchEvent(new CustomEvent('portal:motion-change'));
    }
    button?.addEventListener('click',()=>{if(state.enabled)paused=true;else{paused=false;override=true;}try{localStorage.setItem('gamematerial:portal-motion',paused?'off':'on');}catch{}sync();},options);
    document.addEventListener('visibilitychange',sync,options);
    reduced.addEventListener('change',()=>{override=false;sync();},options);
    addEventListener('pagehide',event=>{suspended=true;sync();if(!event.persisted)lifecycle.abort();},options);
    addEventListener('pageshow',()=>{suspended=false;sync();},options);sync();return state;
  }

  function createTitleMotion(picture) {
    const image=picture.querySelector('img');
    if(!image)return;
    const lifecycle=new AbortController(),options={signal:lifecycle.signal};
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const constrained=Boolean(navigator.connection?.saveData||navigator.deviceMemory&&navigator.deviceMemory<=2||navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=2);
    const variants=[...picture.querySelectorAll('source'),image];
    let inView=true,failedAnimation=false,disposed=false;
    function render(forceStill=false){
      if(disposed)return;
      const animate=!forceStill&&motion.active&&inView&&!constrained&&!failedAnimation;
      for(const element of variants){
        const attribute=element===image?'src':'srcset',url=animate?element.dataset.motionSrc:element.dataset.stillSrc;
        if(element.getAttribute(attribute)!==url)element.setAttribute(attribute,url);
      }
      picture.dataset.motionState=animate?'motion':reduced.matches?'reduced-motion':'still';
    }
    const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;render();},{threshold:0}):null;
    observer?.observe(picture);
    function destroy(){observer?.disconnect();lifecycle.abort();disposed=true;}
    image.addEventListener('error',()=>{
      if(picture.dataset.motionState==='motion'){failedAnimation=true;render();return;}
      picture.hidden=true;
      const heading=picture.closest('h1');heading?.classList.remove('has-title-art');
      heading?.querySelector('.title-copy')?.classList.remove('sr-only');
      picture.closest('.portal-intro')?.classList.remove('has-title-visual');
      destroy();
    },options);
    reduced.addEventListener('change',()=>render(),options);
    addEventListener('portal:motion-change',()=>render(),options);
    document.addEventListener('visibilitychange',()=>render(),options);
    addEventListener('pagehide',event=>{render(true);if(!event.persisted)destroy();},options);
    addEventListener('pageshow',()=>render(),options);
    render();
  }

  function createAmbientParticles(canvas) {
    const context=canvas?.getContext('2d',{alpha:true});
    if(!context)return;
    const lifecycle=new AbortController(),options={passive:true,signal:lifecycle.signal};
    const reduced=matchMedia('(prefers-reduced-motion: reduce)'),compact=matchMedia('(max-width: 680px), (pointer: coarse)');
    const lowPower=Boolean(navigator.deviceMemory&&navigator.deviceMemory<=2||navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=2);
    let points=new Float32Array(0),width=0,height=0,count=0,frame=0,last=0,time=0,resizeTimer=0,scrollTimer=0,scrolling=false,disposed=false;
    let pointerX=0,pointerY=0,seed=0x73a91;
    const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
    const colors=['185,215,255','218,225,255','236,212,163'];

    function stop(){if(frame)cancelAnimationFrame(frame);frame=0;last=0;}
    function resize(){
      width=document.documentElement.clientWidth;height=innerHeight;
      const dpr=Math.min(devicePixelRatio||1,compact.matches||lowPower?1.25:1.5);
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
      context.setTransform(dpr,0,0,dpr,0,0);
      count=lowPower?12:compact.matches?Math.min(22,Math.max(14,Math.round(width*height/21000))):Math.min(70,Math.max(36,Math.round(width*height/19000)));
      points=new Float32Array(count*8);seed=0x73a91;
      for(let index=0;index<count;index++){
        const offset=index*8;
        points[offset]=random()*width;points[offset+1]=random()*height;
        points[offset+2]=(random()-.5)*3;points[offset+3]=-1.5-random()*3.5;
        points[offset+4]=.4+random()*.9;points[offset+5]=random()*Math.PI*2;
        points[offset+6]=.4+random()*.7;points[offset+7]=Math.floor(random()*colors.length);
      }
      canvas.dataset.particleCount=String(count);
    }
    function draw(timestamp){
      frame=0;
      if(disposed||!motion.active||scrolling)return;
      const interval=1000/(lowPower?15:compact.matches?24:30);
      if(last&&timestamp-last<interval){frame=requestAnimationFrame(draw);return;}
      const dt=last?Math.min((timestamp-last)/1000,.08):0;last=timestamp;time+=dt;
      context.clearRect(0,0,width,height);
      for(let index=0;index<count;index++){
        const offset=index*8;
        points[offset]+=points[offset+2]*dt;points[offset+1]+=points[offset+3]*dt;
        if(points[offset+1]<-16)points[offset+1]=height+16;
        if(points[offset]<-16)points[offset]=width+16;else if(points[offset]>width+16)points[offset]=-16;
        const depth=points[offset+6],x=points[offset]+Math.sin(time*.2+points[offset+5])*9+pointerX*depth*7,y=points[offset+1]+pointerY*depth*5;
        const pulse=(Math.sin(time*depth+points[offset+5])+1)*.5,alpha=.18+pulse*.48,radius=points[offset+4];
        context.fillStyle=`rgba(${colors[points[offset+7]]},${alpha*.1})`;
        context.beginPath();context.arc(x,y,radius*2.8,0,Math.PI*2);context.fill();
        context.fillStyle=`rgba(${colors[points[offset+7]]},${alpha})`;
        context.beginPath();context.arc(x,y,radius,0,Math.PI*2);context.fill();
        if(index%9===0){
          const length=radius*(3+pulse*2);
          context.strokeStyle=`rgba(${colors[points[offset+7]]},${alpha*.65})`;context.lineWidth=.6;
          context.beginPath();context.moveTo(x-length,y);context.lineTo(x+length,y);context.moveTo(x,y-length);context.lineTo(x,y+length);context.stroke();
        }
      }
      frame=requestAnimationFrame(draw);
    }
    function sync(){
      stop();canvas.hidden=!motion.enabled;
      canvas.dataset.particleState=!motion.enabled&&reduced.matches?'reduced-motion':!motion.active||scrolling?'paused':'running';
      if(disposed||!motion.active||scrolling)return;
      if(!points.length)resize();
      frame=requestAnimationFrame(draw);
    }
    function destroy(){disposed=true;stop();clearTimeout(resizeTimer);clearTimeout(scrollTimer);lifecycle.abort();context.clearRect(0,0,width,height);canvas.dataset.particleState='disposed';}
    addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{resize();sync();},120)},options);
    addEventListener('scroll',()=>{scrolling=true;stop();canvas.dataset.particleState='paused';clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{scrolling=false;sync();},160)},options);
    addEventListener('pointermove',event=>{if(!compact.matches){pointerX=event.clientX/Math.max(width,1)-.5;pointerY=event.clientY/Math.max(height,1)-.5;}},options);
    document.addEventListener('visibilitychange',sync,options);
    reduced.addEventListener('change',sync,options);
    addEventListener('portal:motion-change',sync,options);
    compact.addEventListener('change',()=>{resize();sync();},options);
    addEventListener('pagehide',event=>{stop();clearTimeout(resizeTimer);clearTimeout(scrollTimer);scrolling=false;if(!event.persisted)destroy();},options);
    addEventListener('pageshow',sync,options);
    sync();
  }
})();
