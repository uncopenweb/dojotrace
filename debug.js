DbG =
(function () {
    var data = [];
    var current = { 
        name: "",
        trace: []
    };
    function debug(file, line) {
        if (typeof(file) == 'undefined') {
            return data;
        }
        if (current.name != file) {
            current = {
                name: file,
                trace: []
            };
            data.push(current);
        }
        current.trace.push(line);
    }
    var gt = dojo._getText;
    function myGetText(fname) {
        var name = fname.match(/(\w+)\.js/);
        if (name == null) {
            return gt.apply(this, arguments);
        }
        name = name[1];
        txt = gt.apply(this, arguments);
        txt = dojo.map(txt.split('\n'), function(chunk, i) {
            return chunk.replace(/(\)|\s+else)\s*{/g, 
                                 '$1 { DbG("'+name+'", '+(i+1)+');'); }).join('\n');
        return txt;
    }
    dojo._getText = myGetText;
    return debug;
})();
