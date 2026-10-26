(function(){
  if(app.project&&(app.project.file||app.project.numItems>0))return;
  app.beginSuppressDialogs();
  var root='D:/游戏素材/portal/masters/title/';
  try{
    app.open(new File(root+'ae/PORTAL_02_TYPE_title_v1.aepx'));
    try{app.setMultiFrameRenderingConfig(true,35);}catch(ignore){}
    try{app.setMemoryUsageLimits(10,25);}catch(ignore){}
    app.project.renderQueue.render();
    var ok=true;for(var i=1;i<=app.project.renderQueue.numItems;i++)if(app.project.renderQueue.item(i).status!==RQItemStatus.DONE)ok=false;
    for(var j=1;j<=app.project.numItems;j++)if(app.project.item(j).name==='PORTAL_TITLE_DESKTOP')app.project.item(j).comment+=' | PORTAL_AE_STATUS:'+(ok?'RENDERED':'RENDER_ERROR');
    app.project.save(new File(root+'ae/PORTAL_02_TYPE_title-rendered_v1.aepx'));
  }catch(error){if(app.project){var c=app.project.items.addComp('PORTAL_RENDER_ERROR',600,100,1,1,12);c.comment='PORTAL_AE_STATUS:ERROR '+error+' line '+error.line;app.project.save(new File(root+'ae/PORTAL_02_TYPE_title-rendered_v1.aepx'));}}
  app.endSuppressDialogs(false);if(app.project)app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);app.quit();
})();
