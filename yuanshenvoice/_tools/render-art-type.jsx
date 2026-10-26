/* Actual AE render-queue execution. Run in a separate -m -noui instance. */
(function () {
    app.beginSuppressDialogs();
    var root = new File($.fileName).parent.parent;
    var out = new Folder(root.fsName + '/output/art-type-ae-v1');
    var log = new File(out.fsName + '/render-status.txt');
    function write(text) { log.encoding = 'UTF-8'; log.open('w'); log.write(text); log.close(); }
    try {
        if (app.project && (app.project.numItems || app.project.file)) throw new Error('Separate clean AE instance required');
        var modeFile = new File(out.fsName + '/render-mode.txt'), full = false;
        if (modeFile.exists) { modeFile.open('r'); full = /full/.test(modeFile.read()); modeFile.close(); }
        app.open(new File(out.fsName + '/TEYVAT_04_FX_art-type_v1.aep'));
        app.project.gpuAccelType = GpuAccelType.SOFTWARE;
        // Keep this small transparent render bounded beside the user's open AE job.
        app.setMultiFrameRenderingConfig(false, 50);
        for (var i = 1; i <= app.project.renderQueue.numItems; i++) {
            var q = app.project.renderQueue.item(i);
            if (i < 3) { q.timeSpanStart = full ? 0 : 71 / 24; q.timeSpanDuration = full ? 3 : 1 / 24; }
            q.render = true;
        }
        write('RENDERING\n' + (full ? 'full' : 'review') + '\nAdobe After Effects ' + app.version);
        app.project.renderQueue.render();
        var result = 'COMPLETE\nAdobe After Effects ' + app.version + '\n';
        for (var j = 1; j <= app.project.renderQueue.numItems; j++) {
            var item = app.project.renderQueue.item(j);
            if (item.status !== RQItemStatus.DONE) throw new Error('Render did not finish: ' + item.comp.name + ' / ' + item.status);
            result += item.comp.name + ' | ' + item.timeSpanDuration + 's | ' + item.outputModule(1).file.fsName + '\n';
        }
        write(result);
        app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
    } catch (e) { write('ERROR\n' + e.toString() + '\nLine ' + e.line); if(app.project)app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); }
    app.endSuppressDialogs(false);
    app.exitAfterLaunchAndEval = true;
})();
