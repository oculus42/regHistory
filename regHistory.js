/*
 * regHistory - history.js registration plug-in -- needs history.js, of course.
 * 2013 - Samuel Rouse
 *
 * Allows multiple interface elements to easily share the history.js interface.
 * Only uses the query string rather than full URL updates.
 * Falls back to hash changes if you use the HTML4 support version of history.
 *
 * 2013-08-13 - initial version
 * 2013-08-29 - cleanup, better comments & Examples
 *
 * Use register to add a key, an optional value, and a callback for changes to that key.
 * Register also supports objects being passes as KVPs.
 * Will not overwrite existing keys (returns false if asked to).
 *
 * REGISTER EXAMPLES:
 *
 * #1: key with simple value and anonymous callback:
 * regHistory( "register", "infoTab", 1, function( key, val ){ setInfoTab(val); });
 *
 * #2: key with object value and named callback:
 * regHistory( "register", "product", { "color": "blue", "size": "large" }, updateProduct );
 *
 * #3: multi-key object with named callback:
 * regHistory( "register", { "color": "blue", "size": "large" }, updateProduct );
 *
 * UPDATE EXAMPLES:
 * 
 * #1: Add a new history state for a change to the infoTab.
 * regHistory( "updatePush", "infoTab", 2);
 *
 * #2: Update the URL to match changes to the product data.
 * regHistory( "updateReplace", "product", { "color": "red", "size": "medium" });
 *
 * #3: Set a new history state while updating multiple keys at once.
 * regHistory( "updatePush", { "color": "black", "size": "small", "infoTab": 1 });
 *
 */
 
/* global History */
 
 ;(function(w, $, undefined){
	"use strict";
	var registeredKeys = {},
		callbacks = {},
		pageTitle = $('title').val(),
		pushState = function(){
			/*
			 * Merge the current state and the registered keys, 
			 * so we don't wipe someone else's params
			 * Then pushState
			 */
			var newState = $.extend( {}, methods.fetchState(), registeredKeys );
			// Push to History
			History.pushState(null,pageTitle,"?" + methods.getQueryFromObj(newState));
		},
		replaceState = function(){
			/*
			 * Merge the current state and the registered keys, 
			 * so we don't wipe someone else's params
			 * Then pushState
			 */
			var newState = $.extend( {}, methods.fetchState(), registeredKeys );
			// Replace History
			History.replaceState(null,pageTitle,"?" + methods.getQueryFromObj(newState));
		},
		/*
		 * Can only update registered keys, will error/roll back if not
		 */
		update: function (key, val, trigger) {
			var b_reg = $.extend(true,{},registeredKeys),		// Backup of the keys
				returnState = true;			// Return state
			
			// Only trigger if explicitly set.
			if ( trigger !== true ) { trigger = false; }
			
			if ( typeof key === "object" ) {
									
				// We accept an object of key/value pairs.
				$.each(key, function(k,v) {
					var ret = methods.update(k, v, true);
					// Loop through the keys and register each.
					returnState = returnState && ret;
					return returnState;
				});
				
				// Check for failure and roll back changes if needed
				if ( !returnState ) {
					registeredKeys = b_reg;				
				} else if ( trigger ){
					// Fire callbacks for all pairs.
					$.each(key, function(k) {
						if ( registeredKeys[k] != b_reg[k] && k in callbacks ) { 
							callbacks[k](k,registeredKeys[k]); 
						}
					});
				}
			} else {
				// Check to see if this key is already registered
				if ( key in registeredKeys ) {
					registeredKeys[key] = (typeof val === "function" ? val() : val);
					if ( !trigger && registeredKeys[key] != b_reg[key] && key in callbacks ) { 
						callbacks[key](key,registeredKeys[key]); 
					}
				} else {
					// Pass back a false, since we need to 
					returnState = false;
				}
			}
			
			return returnState;
		},
		methods = {
			/*
			 * getQueryFromObj() & getObjFromQuery() are quick and dirty query string handlers.
			 * You get smaller URLs than de facto standard (PHP) format, but there are limitations.
			 * Nothing is stopping you from using a different URL encoding scheme.
			 *
			 * Very simple formatting; 
			 * - Arrays in brackets
			 * - Objects in curly braces
			 * - Regular values are URI encoded
			 * LIMITATIONS:
			 * - Does not handle commas in Arrays or Objects
			 */
			
			getQueryFromObj: function (obj) {
				var qs = "", 
					i = 0;

				$.each(obj,function(key,val){
					qs += (i !== 0 ? "&" : "") + key + "=";
				
					if (typeof val === "object") {
						if (!(val instanceof Array)) {
							qs += "{" + methods.getQueryFromObj(val) + "}";
						} else {
							qs += "[" + encodeURIComponent(val.toString()) + "]";
						}
					} else {
						qs += encodeURIComponent(val.toString());
					}
					i++;
				});
				return qs;
			},
			getObjFromQuery: function (qs) {
				var obj = {},
					// Ignore bad input.
					q = (typeof qs === "string" ? qs.split("&") : [""]),
					l = q.length,
					i, qp, qpk, qpv;
				
				for (i=0; i < l; i++) {
					qp = q[i].split("=");
					qpk = qp[0];
					
					if ( qpk !== "" ) {
						if ( qp.length > 1 ) {
							qpv = decodeURIComponent(qp[1]);
							if ( qpv.indexOf("{") === 0 ) {
								obj[qpk] = methods.getObjFromQuery(qpv.substring(1,qpv.length-1));
							} else if ( qpv.indexOf("[") === 0 ) {
								obj[qpk] = qpv.substring(1,qpv.length-1).split(",");
							} else {
								obj[qpk] = qpv;
							}
						} else {
							obj[qpk] = null;
						}
					}
				}
				return obj;
			},
			/* 
			 * regHistory( "register", key/object [, value] [, callback] );
			 * Attempting to re-register a key will return false.
			 * If an object is passed with a registered key, it will roll back the entire object.
			 */
			register: function () {
				var b_reg = registeredKeys,		// Backups of the keys and callbacks
					b_call = callbacks,
					// Inputs
					key = arguments[0],
					val = (arguments.length > 1 ? arguments[1] : null ),
					callback = arguments[arguments.length - 1],
					// Return state
					returnState = true;
				
				// Make sure val and callback don't overlap
				if ( typeof callback !== "function" ) { callback = null; }
				if ( val !== null && val === callback ) { val = null; }
				
				if ( typeof key === "object" ) {
					
					// We accept an object of key/value pairs.
					$.each(key, function(k,v) {
						// Loop through the keys and register each.
						returnState = returnState && methods.register(k,v,callback);
					});
					
					// Check for failure and roll back if needed
					if ( !returnState) {
						registeredKeys = b_reg;
						callbacks = b_call;
					}
				} else {
					// Check to see if this key is already registered
					if ( key in registeredKeys ) {
						returnState = false;
					} else {
						// Add to registered keys
						registeredKeys[key] = (typeof val === "function" ? val() : val);
						// Also the callback
						if ( callback !== null ) { callbacks[key] = callback; }
					}
				}
				return returnState;
			},
			/* Two options: push or replace */			 
			updatePush: function() {
				if ( update.apply(this, arguments) ) {
					pushState();
				}
			},
			updateReplace: function() {
				if ( update.apply(this, arguments)  ) {
					replaceState();
				}
			},
			/*
			 * Forces an update of the internal state
			 * Should only be used on load, as update should
			 */
			fetchState: function() {
				var urlHash = History.getState().hash, // Note: We are using History.getState() instead of event.state
					qsIdx = urlHash.indexOf("?"),
					curHash = ( qsIdx === -1 ? "" : urlHash.substring( qsIdx + 1 ) );
				
				return methods.getObjFromQuery(curHash);
			},
			/*
			 * Accept an object and loop over it, checking for registeredKeys
			 * If the value differs, fire the callback, if available
			 * Presumably used with the current state from fetchState()
			 */
			notify: function() {
				var curState = methods.fetchState(),
					key;
				for ( key in curState ) {
					if ( key in registeredKeys && key in curState && registeredKeys[key] != curState[key] ) {
						if ( key in callbacks ) { 
							callbacks[key].apply(this,[key,curState[key]]);
						}
					}
				}
			}
		};
		
		// Catch changes someone else makes.
		// May need to register hash change here?
		History.Adapter.bind(window,'statechange',methods.notify);

		w.regHistory = function( method ) {
			
			if ( method in methods ) {
				methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
			} else {
				// Empty or bad request gets current state
				return methods.fetchState();
			}
		};
		
}(window, jQuery));
