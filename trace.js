/**
 * A hack to insert simple line number tracing into javascript code included 
 * with dojo.require. Add a script tag like:
 *
 * <script type="text/javascript" src="trace.js"></script>
 *
 * after loading dojo.js. Move the script tag even later to avoid adding 
 * logging to uninteresting files.
 *
 * Add the following parameters to your URL or djConfig.trace_config to 
 * configure tracing:
 *
 * trace=[console|silent]
 * When set to 'console', trace statements go to the console in real-time.
 * When set to 'silent' trace statements are collected in an array and can be 
 * retrieved with uow.trace.get(). When set to 'enabled', tracing doesn't 
 * start until uow.trace.start() is called. When ommitted, files are not
 * annotated for tracing.
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
 * Use the following API to control tracing at runtime:
 *
 * uow.trace.start([logger]) - Starts tracing if it is not running yet. 
 *   The 'logger' param can be 'console' or 'silent' and defaults to 'silent'
 *   if not specified. Or, the 'logger' can be a callback function of the form
 *     logger(filename, line, context, scope, arguments) -> string
 *   where filename, line, and context are strings, scope is the value of 
 *   'this' in the logged scope, and 'arguments' are the args passed to the
 *   function in the called scope (or undefined if not in a function). Any
 *   value returned from the callback is added to the trace log array.
 * uow.trace.stop() - Stops tracing if it is running and returns the last
 *   trace log array.
 * uow.trace.get() - Gets the current silent trace log.
 *
 * :requires: Dojo 1.3.2 or higher, XD or local build fine
 * :copyright: Gary Bishop, Peter Parente 2010
 * :license: BSD
 **/
dojo.provide('uow.trace');
uow.trace =
(function () {
    var func, trace = [], limit;
    var noTrace = function() {}; // nop to return below
    var consoleTrace = function(file, line, context) {
        console.debug(file+':'+line, context);
    };
    var silentTrace = function(file, line, context) {
        return file+':'+line, context;
    };
    
    // get the url parameters
    var parms = dojo.queryToObject(window.location.search.substring(1));
    if (parms.trace === undefined) {
        parms = djConfig.trace_config;
    }
    if(parms === undefined) {
        parms = {};
    }
    
    // setup the initial tracing function
    if (parms.trace == 'silent') {
        func = silentTrace;
    } else if(parms.trace == 'console') {
        func = consoleTrace;
    } else if(parms.trace == 'enabled') {
        func = noTrace;
    } else {
        // return disabled trace API
        return {
            _err : new Error('tracing disabled'),
            log : function() { throw this._err; },
            start : function() {  },
            get : function() { return trace; },
            stop : function() { return trace; }
        };
    }

    // pull out the limit
    var limit = parms.limit || 0;

    // decide what files to annotate or not
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
                                '$1$2 uow.trace.log("'+name+'",'+(i+1)+',"'+context+'", this, arguments);');
        }).join('\n');
        return txt;
    }
    // replace their function with mine
    dojo._getText = myGetText;

    // return trace API
    return {
        logger : func,
        log : function() {
            var rv = this.logger.apply(this, arguments);
            if(rv !== undefined) {
                trace.push(rv);
                if (limit) {
                    trace = trace.splice(-limit,limit);
                }
            }
        },
        start : function(logger) {
            if(this.logger !== noTrace) {
                throw new Error('trace already running');
            }
            trace = [];
            if(logger == 'silent' || logger === undefined) {
                // default to silent
                this.logger = silentTrace;
            } else if(logger == 'console') {
                this.logger = consoleTrace;
            } else {
                this.logger = logger;
            }
        },
        get : function() {
            return trace;
        },
        stop : function() {
            if(this.logger === noTrace) {
                throw new Error('trace not running');
            }
            this.logger = noTrace;
            return trace;
        }
    };
})();
