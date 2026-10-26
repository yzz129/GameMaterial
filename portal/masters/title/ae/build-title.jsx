/* Build an isolated AE project. File/network scripting stays disabled;
   only AE's native import, project-save and render output APIs are used. */
(function(){
  if(app.project&&(app.project.file||app.project.numItems>0))return;
  app.beginSuppressDialogs();
  if(!app.project)app.newProject();
  var root='D:/游戏素材/portal/masters/title/',duration=4,fps=12,status='READY';
  function comp(name,w,h){return app.project.items.addComp(name,w,h,1,duration,fps);}
  function place(target,source,name,x,y,scale){var l=target.layers.add(source);l.name=name;l.property('ADBE Transform Group').property('ADBE Anchor Point').setValue([0,0]);l.property('ADBE Transform Group').property('ADBE Position').setValue([x,y]);l.property('ADBE Transform Group').property('ADBE Scale').setValue([scale,scale]);return l;}
  function glint(c,name,x,y,phase){
    var l=c.layers.addShape();l.name=name;var group=l.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group'),contents=group.property('ADBE Vectors Group');
    var p=contents.addProperty('ADBE Vector Shape - Group'),shape=new Shape();shape.vertices=[[0,-6],[1.1,-1.1],[6,0],[1.1,1.1],[0,6],[-1.1,1.1],[-6,0],[-1.1,-1.1]];shape.closed=true;p.property('ADBE Vector Shape').setValue(shape);
    contents.addProperty('ADBE Vector Graphic - Fill').property('ADBE Vector Fill Color').setValue([.87,.94,1,1]);
    l.property('ADBE Transform Group').property('ADBE Position').setValue([x,y]);
    l.property('ADBE Transform Group').property('ADBE Opacity').expression='12+62*Math.pow(Math.max(0,Math.sin(time*Math.PI/2+'+phase+')),8)';
    var glow=l.property('ADBE Effect Parade').addProperty('ADBE Glo2');glow.property('ADBE Glo2-0002').setValue(170);glow.property('ADBE Glo2-0003').setValue(9);glow.property('ADBE Glo2-0004').setValue(.75);
  }
  function finish(base,name,folder){
    var c=comp(name,base.width,base.height),l=place(c,base,'星空艺术字 · 主体',0,0,100);
    var glow=l.property('ADBE Effect Parade').addProperty('ADBE Glo2');glow.property('ADBE Glo2-0002').setValue(180);glow.property('ADBE Glo2-0003').setValue(12);glow.property('ADBE Glo2-0004').expression='.22+.06*Math.sin(time*Math.PI/2)';
    var sweep=l.property('ADBE Effect Parade').addProperty('CC Light Sweep');
    sweep.property('CC Light Sweep-0001').setValueAtTime(0,[-180,c.height*.5]);sweep.property('CC Light Sweep-0001').setValueAtTime(2.7,[c.width+180,c.height*.5]);sweep.property('CC Light Sweep-0001').setValueAtTime(4,[c.width+180,c.height*.5]);
    sweep.property('CC Light Sweep-0002').setValue(-22);sweep.property('CC Light Sweep-0004').setValue(140);sweep.property('CC Light Sweep-0005').setValue(12);sweep.property('CC Light Sweep-0006').setValue(16);sweep.property('CC Light Sweep-0007').setValue(1.3);
    if(c.width>1200){glint(c,'字尖星芒 · 每',137,43,0);glint(c,'字尖星芒 · 响',1510,58,2.1);}else{glint(c,'字尖星芒 · 每',133,35,0);glint(c,'字尖星芒 · 都',130,291,2.1);}
    var rq=app.project.renderQueue.items.add(c),templates=rq.templates;
    for(var i=0;i<templates.length;i++)if(/最佳|Best Settings/.test(templates[i])){rq.applyTemplate(templates[i]);break;}
    var om=rq.outputModule(1),outputs=om.templates,alphaTemplate=null;
    for(var j=0;j<outputs.length;j++)if(/TIFF/i.test(outputs[j])&&/Alpha/i.test(outputs[j])){alphaTemplate=outputs[j];break;}
    if(!alphaTemplate)throw Error('No native TIFF with alpha output template');
    om.applyTemplate(alphaTemplate);om.file=new File(root+'renders/'+folder+'/title_[#####].tif');
    rq.timeSpanStart=0;rq.timeSpanDuration=duration;
    c.comment='PORTAL_AE_RENDER | '+app.version+' | '+c.width+'x'+c.height+' | 4s/12fps | RGBA TIFF master sequence | CC Light Sweep + Glow + deterministic glints | alpha template: '+alphaTemplate;
    return c;
  }
  try{
    app.project.bitsPerChannel=16;
    var source=app.project.importFile(new ImportOptions(new File(root+'PORTAL_02_TYPE_title-source_v1.png')));
    var first=comp('ART_LINE_1_每个世界，',1540,460),second=comp('ART_LINE_2_都有回响',1500,426);
    place(first,source,'Image Gen · 每个世界，',-40,-60,100);place(second,source,'Image Gen · 都有回响',-40,-520,100);
    var desk=comp('LAYOUT_DESKTOP',1800,300);place(desk,first,'每个世界，',54,26,52);place(desk,second,'都有回响',850,35,56);
    var mobile=comp('LAYOUT_MOBILE',960,540);place(mobile,first,'每个世界，',48,18,53);place(mobile,second,'都有回响',48,274,56.5);
    var desktopMaster=finish(desk,'PORTAL_TITLE_DESKTOP','desktop'),mobileMaster=finish(mobile,'PORTAL_TITLE_MOBILE','mobile');
    var guide=desktopMaster.layers.addText('每个世界，都有回响');guide.name='原文校对 · 可编辑文字参考';guide.enabled=false;guide.guideLayer=true;
    desktopMaster.comment+=' | PORTAL_AE_STATUS:READY';
  }catch(error){status='ERROR: '+String(error)+' line '+error.line;var failure=comp('PORTAL_AE_ERROR',600,100);failure.comment='PORTAL_AE_STATUS:'+status;}
  app.project.save(new File(root+'ae/PORTAL_02_TYPE_title_v1.aepx'));
  app.endSuppressDialogs(false);app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);app.quit();
})();
