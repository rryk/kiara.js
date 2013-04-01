// Based on x3dom's debug.js
/*
 * X3DOM JavaScript Library
 * http://x3dom.org
 *
 * (C)2009 Fraunhofer Insitute for Computer
 *         Graphics Reseach, Darmstadt
 * Dual licensed under the MIT and GPL.
 *
 * Based on code originally provided by
 * Philip Taylor: http://philip.html5.org
 */

var logger = {

    INFO:       "INFO",
    WARNING:    "WARNING",
    ERROR:      "ERROR",
    EXCEPTION:  "EXCEPTION",

	// determines whether debugging/logging is active. If set to "false"
	// no debugging messages will be logged.
	isActive: false,

    // stores if the logger object is initialized already
    isSetup: false,

	// stores if logger object is append already (Need for IE integration)
	isAppend: false,

    // stores the number of lines logged
    numLinesLogged: 0,

    // the maximum number of lines to log in order to prevent
    // the browser to slow down
    maxLinesToLog: 10000,

	// the container div for the logging messages
	logContainer: null,

    /** @brief Setup the logger object.

        Checks for firebug and creates the container div for the logging
		messages.
      */
    setup: function() {
		// If debugging is already setup simply return
        if (logger.isSetup) { return; }

		//
		logger.setupLogContainer();

        // setup should be setup only once, thus store if we done that already
        logger.isSetup = true;
    },

	/** @brief Activates the log
      */
	activate: function(visible) {
		logger.isActive = true;

        //var aDiv = document.createElement("div");
        //aDiv.style.clear = "both";
        //aDiv.appendChild(document.createTextNode("\r\n"));
        //aDiv.style.display = (visible) ? "block" : "none";
        logger.logContainer.style.display = (visible) ? "block" : "none";

		//Need this HACK for IE/Flash integration. IE don't have a document.body at this time when starting Flash-Backend
		if(!logger.isAppend) {
			if(navigator.appName == "Microsoft Internet Explorer") {
				//document.documentElement.appendChild(aDiv);
				logger.logContainer.style.marginLeft = "8px";
				document.documentElement.appendChild(logger.logContainer);
			}else{
				//document.body.appendChild(aDiv);
				document.body.appendChild(logger.logContainer);
			}
			logger.isAppend = true;
		}
	},

	/** @brief Inserts a container div for the logging messages into the HTML page
      */
	setupLogContainer: function() {
		logger.logContainer = document.createElement("div");
		logger.logContainer.id = "logger_logdiv";
		logger.logContainer.setAttribute("class", "logger-logContainer");
		logger.logContainer.style.clear = "both";
		//document.body.appendChild(logger.logContainer);
	},

	/** @brief Generic logging function which does all the work.

		@param msg the log message
		@param logType the type of the log message. One of INFO, WARNING, ERROR
					   or EXCEPTION.
      */
    doLog: function(msg, logType) {

		// If logging is deactivated do nothing and simply return
		if (!logger.isActive) { return; }

		// If we have reached the maximum number of logged lines output
		// a warning message
		if (logger.numLinesLogged === logger.maxLinesToLog) {
			msg = "Maximum number of log lines (=" + logger.maxLinesToLog +
				  ") reached. Deactivating logging...";
		}

		// If the maximum number of log lines is exceeded do not log anything
		// but simply return
		if (logger.numLinesLogged > logger.maxLinesToLog) { return; }

		// Output a log line to the HTML page
		var node = document.createElement("p");
		node.style.margin = 0;
        switch (logType) {
            case logger.INFO:
                node.style.color = "#00ff00";
                break;
            case logger.WARNING:
                node.style.color = "#cd853f";
                break;
            case logger.ERROR:
                node.style.color = "#ff4500";
                break;
            case logger.EXCEPTION:
                node.style.color = "#ffff00";
                break;
            default:
                node.style.color = "#00ff00";
                break;
        }

		// not sure if try/catch solves problem http://sourceforge.net/apps/trac/x3dom/ticket/52
		// but due to no avail of ATI gfxcard can't test
        try {
			node.innerHTML = logType + ": " + msg;
			logger.logContainer.insertBefore(node, logger.logContainer.firstChild);
        } catch (err) {
			if (window.console.firebug !== undefined) {
				window.console.warn(msg);
			}
        }

		logger.numLinesLogged++;
    },

    /** Log an info message. */
    info: function(msg) {
        logger.doLog(msg, logger.INFO);
    },

    /** Log a warning message. */
    warning: function(msg) {
        logger.doLog(msg, logger.WARNING);
    },

    /** Log an error message. */
    error: function(msg) {
        logger.doLog(msg, logger.ERROR);
    },

    /** Log an exception message. */
    exception: function(msg) {
        logger.doLog(msg, logger.EXCEPTION);
    },

    /** Log an assertion. */
	assert: function(c, msg) {
		if (!c) {
			logger.doLog("Assertion failed in " +
                    logger.assert.caller.name + ': ' +
                    msg, logger.ERROR);
		}
	},

	/**
	 Checks the type of a given object.

	 @param obj the object to check.
	 @returns one of; "boolean", "number", "string", "object",
	  "function", or "null".
	*/
	typeOf: function (obj) {
		var type = typeof obj;
		return type === "object" && !obj ? "null" : type;
	},

	/**
	 Checks if a property of a specified object has the given type.

	 @param obj the object to check.
	 @param name the property name.
	 @param type the property type (optional, default is "function").
	 @returns true if the property exists and has the specified type,
	  otherwise false.
	*/
	exists: function (obj, name, type) {
		type = type || "function";
		return (obj ? this.typeOf(obj[name]) : "null") === type;
	},

	/**
	 Dumps all members of the given object.
	*/
	dumpFields: function (node) {
		var str = "";
		for (var fName in node) {
			str += (fName + ", ");
		}
		str += '\n';
		logger.logInfo(str);
		return str;
	}
};

// Call the setup function to... umm, well, setup logger
logger.setup();
