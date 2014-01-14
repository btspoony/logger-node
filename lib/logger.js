var log4js = require('log4js');
var fs = require('fs');
var util = require('util');

var funcs = {
	'env': doEnv,
	'args': doArgs,
	'opts': doOpts
};

function getLogger(categoryName) {
	var args = arguments;
	var prefix = "";
	for (var i = 1; i < args.length; i++) {
		if(i !== args.length-1)
			prefix = prefix + args[i] + "][";
		else 
			prefix = prefix + args[i];
	}

	var logger = log4js.getLogger(categoryName);
	var pLogger = {};
	for (var key in logger) {
		pLogger[key] = logger[key];
	}

	['log', 'debug', 'info', 'warn', 'error', 'trace', 'fatal'].forEach(function(item) {
		pLogger[item] = function() {
			var p = "";
			if (args.length > 1) {
				p = "[" + prefix + "] ";
			}
			if(args.length && process.env.LOGGER_LINE) {
				p = getLine() + ": " + p;
			}
			if(args.length) {
				arguments[0] = p + arguments[0];
			}
			logger[item].apply(logger, arguments);
		}
	});
	return pLogger;
};

/**
 * Configure the logger.
 * Configure file just like log4js.json. And support ${scope:arg-name} format property setting.
 * It can replace the placeholder in runtime.
 * scope can be:
 *     env: environment variables, such as: env:PATH
 *     args: command line arguments, such as: args:1
 *     opts: key/value from opts argument of configure function
 *
 * @param  {String|Object} config configure file name or configure object
 * @param  {Object} opts   options
 * @return {Void}
 */

function configure(config, opts) {
	var filename = config;
	config = config || process.env.LOG4JS_CONFIG;
	opts = opts || {};

	if (typeof config === 'string') {
		config = JSON.parse(fs.readFileSync(config, "utf8"));
	}

	if (config) {
		config = replaceProperties(config, opts);
	}
	
	if(config && config.lineDebug) {
		process.env.LOGGER_LINE = true;
	}

	log4js.configure(config, opts);
};

function replaceProperties(configObj, opts) {
	if (configObj instanceof Array) {
		for (var i = 0, l = configObj.length; i < l; i++) {
			configObj[i] = replaceProperties(configObj[i], opts);
		}
	} else if (typeof configObj === 'object') {
		var field;
		for (var f in configObj) {
			if (!configObj.hasOwnProperty(f)) {
				continue;
			}

			field = configObj[f];
			if (typeof field === 'string') {
				configObj[f] = doReplace(field, opts);
			} else if (typeof field === 'object') {
				configObj[f] = replaceProperties(field, opts);
			}
		}
	}

	return configObj;
}

function doReplace(src, opts) {
	if (!src) {
		return src;
	}

	var ptn = /\$\{(.*?)\}/g;
	var m, pro, ts, scope, name, defaultValue, func, res = '',
		lastIndex = 0;
	while ((m = ptn.exec(src))) {
		pro = m[1];
		ts = pro.split(':');
		if (ts.length !== 2 && ts.length !== 3) {
			res += pro;
			continue;
		}

		scope = ts[0];
		name = ts[1];
		if (ts.length === 3) {
			defaultValue = ts[2];
		}

		func = funcs[scope];
		if (!func && typeof func !== 'function') {
			res += pro;
			continue;
		}

		res += src.substring(lastIndex, m.index);
		lastIndex = ptn.lastIndex;
		res += (func(name, opts) || defaultValue);
	}

	if (lastIndex < src.length) {
		res += src.substring(lastIndex);
	}

	return res;
}

function doEnv(name) {
	return process.env[name];
}

function doArgs(name) {
	return process.argv[name];
}

function doOpts(name, opts) {
	return opts ? opts[name] : undefined;
}

function getLine() {
	var e = new Error();
	// now magic will happen: get line number from callstack
	var line = e.stack.split('\n')[3].split(':')[1];
	return line;
}

// setup Logger export
var Logger = {};
for( var key in log4js ){
	Logger[key] = log4js[key];
}
// override getLogger and configure
Logger.getLogger = getLogger;
Logger.configure = configure;

module.exports = Logger;
