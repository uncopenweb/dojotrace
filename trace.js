/**
 * A hack to insert simple line number tracing into javascript code included 
 * with dojo.require. Add a script tag like:
 *
 * <script type="text/javascript" src="trace.js"></script>
 *
 * after loading dojo.js. Move the script tag even later to avoid adding 
 * logging to uninteresting files.
 *
 * Add the following parameters to your URL to configure tracing:
 *
 * trace=[console|silent]
 * When set to console, trace statements go to the console in real-time. When
 * set to silent trace statements are collected in an array and can be 
 * retrieved with uow.trace().
 *
 * filter=[<regex>|!<regex>]
 * When set to a regex, only adds tracing to files matching that regex. If
 * prefixed with !, only adds to tracing to files NOT matching the regex.
 *
 * slice=<int>
 * Index to use when slicing the split of the file path on the '/' character
 * when logging. Defaults to -1 showing the filename with no path. Set to -2,
 * for example, to see the name of the file plus its parent folder in the
 * trace.
 *
 * :requires: Dojo 1.3.2 or higher, XD or local build fine
 * :copyright: Gary Bishop, Peter Parente 2010
 * :license: BSD
 **/
dojo.provide('uow.trace');
uow.trace =
(function () {
    // get the url parameters
    var parms = dojo.queryToObject(window.location.search.substring(1));
    if (typeof(parms.trace) == 'undefined') {
        // bail if not requested
        return null;
    }
    
    // setup the tracing function
    var func; // return this below
    if (parms.trace == 'silent') {
        var trace = [];
        func = function(file, line, context) {
            if (typeof(file) == 'undefined') {
                return trace;
            }
            trace.push(file+':'+line, context);
        };
    } else if(parms.trace == 'console') {
        func = function(file, line, context) {
            console.debug(file+':'+line, context);
        };
    } else {
        return null;
    }
    var filter;
    var neg = true;
    if(parms.filter) {
        if(parms.filter.charAt(0) == '!') {
            parms.filter = parms.filter.slice(1);
            neg = false;
        }
        filter = new RegExp(parms.filter);
    } else {
        filter = /.*/;
    }
    
    // hook the function dojo uses to fetch the code
    var _getText = dojo._getText;
    function myGetText(fname) {
        // call dojo._getText to get its output
        var txt = _getText.apply(this, arguments);
        // deal with uri objects
        fname = fname.path || fname;
        if(neg ^ filter.test(fname) ||  // respect user filter
           fname.search('nls') > -1 ||  // avoid nls folders (@todo: improve)
           fname.search(/(\w+)\.js$/) == -1) { // only match Javascript files
               return txt; 
        }
        // get the name for display
        parms.slice = Number(parms.slice) || -1;
        name = fname.split('/').slice(parms.slice).join('/');
        // rewrite the text to insert trace calls at the beginning of code
        // blocks working line-by-line. of course this doesn't work with all 
        // coding styles. don't do that
        var lines = txt.split('\n');
        txt = dojo.map(lines, function(line, i) {
            // ignore switch blocks
            if(/switch\s*\(.*\)\s*\{\s*$/.test(line)) { return line; }
            // only work on lines ending with {, this excludes some useful 
            // cases but avoids getting triggered inside strings. If you want 
            // a block traced, put a newline after {
            if(!(/\{\s*$/).test(line)) return line;
            // try to pick up some useful context from the line
            var context;
            try {
                context = line.match(/[a-zA-Z_][^{\\]+/)[0];
                context = context.replace(/"/g, "'");
                // @todo: limit the length + ellipsize
            } catch(e) {
                context = '';
            }
            return line.replace(/(\)|\Welse)(\s*\{)\s*$/g,
                                '$1$2 uow.trace("'+name+'",'+(i+1)+',"'+context+'");');
        }).join('\n');
        return txt;
    }
    // replace their function with mine
    dojo._getText = myGetText;
    // return my trace function
    return func;
})();
