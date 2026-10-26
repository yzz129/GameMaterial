/* After Effects 2026 / editable title and logo source.
   Run: AfterFX.exe -m -noui -r D:\yuanshenvoice\_tools\build-art-type.jsx
   The separate instance never opens or changes the user's current project. */
(function () {
    app.beginSuppressDialogs();
    var root = new File($.fileName).parent.parent;
    var out = new Folder(root.fsName + '/output/art-type-ae-v1');
    var report = new File(out.fsName + '/build-result.txt');
    function write(value) { report.encoding = 'UTF-8'; report.open('w'); report.write(value); report.close(); }
    function comp(name, w, h) { return app.project.items.addComp(name, w, h, 1, 3, 24); }
    function effect(layer, name) { return layer.property('ADBE Effect Parade').addProperty(name); }
    function color(hex) { return [parseInt(hex.substr(0, 2), 16) / 255, parseInt(hex.substr(2, 2), 16) / 255, parseInt(hex.substr(4, 2), 16) / 255]; }
    function gold(layer, top, bottom) {
        var ramp = effect(layer, 'ADBE Ramp');
        ramp.property(1).setValue(top); ramp.property(2).setValue(color('fff7dc'));
        ramp.property(3).setValue(bottom); ramp.property(4).setValue(color('bb8a43'));
        ramp.property(6).setValue(0);
    }
    function shadow(layer) {
        var fx = effect(layer, 'ADBE Drop Shadow');
        fx.property(1).setValue(color('041026')); fx.property(2).setValue(140);
        fx.property(3).setValue(180); fx.property(4).setValue(2); fx.property(5).setValue(6);
    }
    function line(c, name, vertices, opacity) {
        var l = c.layers.addShape(); l.name = name;
        var contents = l.property('ADBE Root Vectors Group');
        var path = contents.addProperty('ADBE Vector Shape - Group');
        var s = new Shape(); s.vertices = vertices; s.closed = false;
        path.property('ADBE Vector Shape').setValue(s);
        var stroke = contents.addProperty('ADBE Vector Graphic - Stroke');
        stroke.property('ADBE Vector Stroke Color').setValue(color('ead4a0'));
        stroke.property('ADBE Vector Stroke Width').setValue(1.6);
        l.property('ADBE Transform Group').property('ADBE Position').setValue([0, 0]);
        l.property('ADBE Transform Group').property('ADBE Opacity').setValue(opacity);
        return l;
    }
    function star(c, name, x, y, radius, opacity) {
        var l = c.layers.addShape(); l.name = name;
        var contents = l.property('ADBE Root Vectors Group');
        var path = contents.addProperty('ADBE Vector Shape - Group');
        var r = radius, s = new Shape();
        s.vertices = [[0, -r], [r * .2, -r * .2], [r * .72, 0], [r * .2, r * .2], [0, r], [-r * .2, r * .2], [-r * .72, 0], [-r * .2, -r * .2]];
        s.closed = true; path.property('ADBE Vector Shape').setValue(s);
        var fill = contents.addProperty('ADBE Vector Graphic - Fill');
        fill.property('ADBE Vector Fill Color').setValue(color('f8e7bc'));
        l.property('ADBE Transform Group').property('ADBE Position').setValue([x, y]);
        l.property('ADBE Transform Group').property('ADBE Opacity').setValue(opacity);
        return l;
    }
    function row(c, text, size, y, name) {
        var l = c.layers.addText(text); l.name = name;
        var td = l.property('ADBE Text Properties').property('ADBE Text Document').value;
        td.font = 'SimSun'; td.fontSize = size; td.tracking = 35;
        td.applyFill = true; td.fillColor = color('f3dfb3');
        td.applyStroke = true; td.strokeColor = color('f3dfb3'); td.strokeWidth = 1.2;
        td.strokeOverFill = false; td.fauxBold = false;
        td.justification = ParagraphJustification.LEFT_JUSTIFY;
        l.property('ADBE Text Properties').property('ADBE Text Document').setValue(td);
        l.property('ADBE Transform Group').property('ADBE Position').setValue([28, y]);
        gold(l, [0, y - size * .9], [0, y + 8]);
        return l;
    }
    function title(id, first, second, firstSize, secondSize, starX) {
        var face = comp('TYPE_FACE_' + id, 1480, 500);
        row(face, first, firstSize, 208, '01 · ' + first);
        row(face, second, secondSize, 432, '02 · ' + second);
        // Ornament echoes the reference's star terminals and horizontal frame.
        line(face, 'Upper constellation rule', [[starX - 120, 102], [starX + 105, 102]], 44);
        star(face, 'Reference four-point star', starX, 102, 35, 96);
        star(face, 'Companion star', starX + 116, 102, 10, 70);
        line(face, 'Lower rule / left', [[28, 478], [612, 478]], 28);
        line(face, 'Lower rule / right', [[648, 478], [1365, 478]], 28);
        star(face, 'Lower rule diamond', 630, 478, 8, 65);
        var c = comp('TITLE_' + id + '_ALPHA', 1480, 500);
        var base = c.layers.add(face); base.name = 'Champagne gold / editable type and ornaments';
        shadow(base);
        var sweep = effect(base, 'CC Light Sweep');
        sweep.property(1).setValueAtTime(.25, [-240, 80]);
        sweep.property(1).setValueAtTime(1.9, [1760, 390]);
        sweep.property(2).setValue(22); sweep.property(4).setValue(220);
        sweep.property(5).setValue(65); sweep.property(6).setValue(28);
        sweep.property(7).setValue(1.7); sweep.property(8).setValue(color('fff5db'));
        // All glyphs stay complete throughout; light and stars provide the reveal.
        for (var i = 0; i < 12; i++) {
            var x = 950 + (i * 89) % 470, y = 25 + (i * 73) % 425;
            var dust = star(c, 'Stardust ' + (i + 1), x, y, 3 + (i % 3) * 2, 0);
            var start = .12 + i * .075;
            var tr = dust.property('ADBE Transform Group');
            tr.property('ADBE Opacity').setValueAtTime(start, 0);
            tr.property('ADBE Opacity').setValueAtTime(start + .3, 65);
            tr.property('ADBE Opacity').setValueAtTime(start + .85, 0);
            tr.property('ADBE Position').setValueAtTime(start, [x + 18, y + 12]);
            tr.property('ADBE Position').setValueAtTime(start + .85, [x, y - 6]);
        }
        return c;
    }
    function queue(c, dir, name, still) {
        var q = app.project.renderQueue.items.add(c);
        q.timeSpanStart = 0;
        q.timeSpanDuration = still ? 1 / 24 : 3;
        var om = q.outputModule(1);
        om.applyTemplate('_HIDDEN X-Factor 16');
        var settings = om.getSettings(GetSettingsFormat.STRING);
        if (settings.Format !== 'PNG Sequence' || settings.Channels !== 'RGB + Alpha' || settings.Color !== 'Straight (Unmatted)') throw new Error('Expected straight alpha PNG output');
        om.file = new File(out.fsName + '/frames/' + dir + '/' + name + '_[####].png');
        return q;
    }
    try {
        if (app.project && (app.project.numItems || app.project.file)) throw new Error('Refusing to replace an existing project; invoke with -m in a separate instance.');
        if (!app.project) app.newProject();
        app.project.bitsPerChannel = 16;
        app.project.workingSpace = 'sRGB IEC61966-2.1';
        app.project.gpuAccelType = GpuAccelType.SOFTWARE;
        var original = app.project.importFile(new ImportOptions(new File(root.fsName + '/assets/masters/typography/TEYVAT_04_FG_genshin-logo-reference_v1.png')));
        var brand = comp('BRAND_GOLD_ALPHA', 600, 440);
        var mark = brand.layers.add(original); mark.name = 'User supplied 原神 star-terminal mark / luminance matte';
        mark.property('ADBE Transform Group').property('ADBE Anchor Point').setValue([395, 294]);
        mark.property('ADBE Transform Group').property('ADBE Position').setValue([300, 220]);
        effect(mark, 'ADBE Invert');
        var levels = effect(mark, 'ADBE Easy Levels2');
        levels.property('ADBE Easy Levels2-0003').setValue(.045);
        levels.property('ADBE Easy Levels2-0004').setValue(.53);
        effect(mark, 'ADBE Shift Channels').property(1).setValue(2);
        gold(mark, [400, 105], [400, 460]);
        var main = title('MAIN', '循着星光', '重逢熟悉的声音', 224, 184, 1200);
        var nahida = title('NAHIDA', '把须弥的故事', '说给你听', 184, 224, 1300);
        queue(main, 'main', 'TITLE_MAIN', false);
        queue(nahida, 'nahida', 'TITLE_NAHIDA', false);
        queue(brand, 'brand', 'BRAND_GOLD', true);
        app.project.save(new File(out.fsName + '/TEYVAT_04_FX_art-type_v1.aep'));
        write('READY\nAfter Effects ' + app.version + '\n16 bpc / sRGB / 24 fps / 3 seconds\nMain and Nahida: 1480 x 500 / straight alpha PNG\nBrand: 600 x 440 / straight alpha PNG\n');
    } catch (e) { write('ERROR\n' + e.toString() + '\nLine ' + e.line); }
    app.endSuppressDialogs(false);
    app.exitAfterLaunchAndEval = true;
})();
