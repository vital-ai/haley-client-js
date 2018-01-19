HaleyAPIVitalServiceImpl = function(vitalService) {
	if(HaleyAPIVitalServiceImpl.SINGLETON != null) throw "only single instance of HaleyAPIVitalServiceImpl allowed";
	HaleyAPIVitalServiceImpl.SINGLETON = this;
	this.vitalService = vitalService;
	this.haleySessionSingleton = null;
	this.streamName = 'haley';
	
	this.handlers = [];
	
	//requestURI -> callback
	this.requestHandlers = {};
	
	this.defaultHandler = null;
	
	this.handlerFunction = null;

	this.logEnabled = true;
	
	//classesURIs is an object for better efficiency
	//{ callback, primaryURIs, classesURIs } 
	
	this.reconnectListeners = [];
	
	var _this = this;
	
	this.vitalService.impl.reconnectHandler = function(){
	
		if(_this.logEnabled) {
			
			console.log("Notifying " + _this.reconnectListeners.length + ' reconnect listener(s)');
			
		}
		
		for(var i = 0 ; i < _this.reconnectListeners.length; i++) {
				
			_this.reconnectListeners[i]();
				
		}
		
	};
	
	//this timestamp is updated when a new non-hearbeat or non-loggedin/out message is sent
	this.lastActivityTimestamp = null; 
	
	this.cachedCredentials = {};
	
	
	//from vital service url
	this.saasServerURL = null;
	
	if( !this.vitalService.impl.url ) {
		throw "No eventbusURL available in vitalService object";
		return;
	}
	
	var protocol = null;
	var host = null;
	//port ?
	
	if(typeof(module) === 'undefined') {
		
		var parser  = document.createElement("a");
		parser.href = this.vitalService.impl.url;
		
		protocol = parser.protocol;
		host = parser.host;
		
	} else {
		
		var url = require('url').parse(this.vitalService.impl.url);

		protocol = url.protocol;
		host = url.host;
		
	}

	this.saasServerURL = protocol + '//' + host;

	this.aimpMessageSentListeners = [];
	
}

HaleyAPIVitalServiceImpl.SINGLETON = null;

HaleyAPIVitalServiceImpl.prototype.initialize = function(syncdomains, callback) {
	if(syncdomains) {
		callback('sync domains not supported yet in this implementation');
		return;
	}
	
	//ok
	callback();
	
}

HaleyAPIVitalServiceImpl.prototype._checkSession = function(haleySession) {
	
	if(this.haleySessionSingleton == null) return 'no active haley session found';
	
	if(this.haleySessionSingleton != haleySession) return 'unknown haley session';
	
	return null;
	
}

HaleyAPIVitalServiceImpl.prototype._cleanup = function() {
	
	this.handlers = [];
	this.requestHandlers = {};
	this.defaultHandler = null;
	
}

/* SESSION RELATED CALLS */
HaleyAPIVitalServiceImpl.prototype.isAuthenticated = function(haleySession) {
	
	var e = this._checkSession(haleySession);
	if(e) throw e;
	
	//check if vital
	return this.vitalService.getAppSessionID() != null;
	
}

HaleyAPIVitalServiceImpl.prototype.getAuthSessionID = function(haleySession) {

	var e = this._checkSession(haleySession);
	if(e) throw e;
	
	//check if vital
	return this.vitalService.getAppSessionID();
	
}

HaleyAPIVitalServiceImpl.prototype.getSessionID = function(haleySession) {
	
	var e = this._checkSession(haleySession);
	if(e) throw e;
	
	return this.vitalService.impl.sessionID;
	
}

HaleyAPIVitalServiceImpl.prototype.getAuthAccount = function(haleySession) {
	
	var e = this._checkSession(haleySession);
	if(e) throw e;
	
	return this.vitalService.getCurrentLogin();
	
}


/* END OF SESSION RELATED CALLS */


HaleyAPIVitalServiceImpl.prototype.authenticateSession = function(haleySession, username, password, callback) {
	
	var e = this._checkSession(haleySession);
	if(e) {
		callback(e);
		return;
	}
	
	if(haleySession.isAuthenticated()) {
		callback('session already authenticated');
		return;
	}
	
	var _this = this;
	
	this.vitalService.callFunction(VitalServiceWebsocketImpl.vitalauth_login, {loginType: 'Login', username: username, password: password}, function(loginSuccess){
			
		if(_this.logEnabled) {
			console.log("auth success: ", loginSuccess);
		}

		var sessionID = haleySession.getSessionID();

		//credentials caching not supported yet
//		_this.cachedCredentials[sessionID] = {username: username, password: password};
		
		_this._sendLoggedInMsg(function(error){

			if(_this.logEnabled) {
				console.log("loggedin msg sent");
			}
			
			if(error) {
				callback(error);
				return;
			}
			
			//success
			callback(null, loginSuccess.first());
			
		});
		
			
	}, function(loginError) {
			
		console.error("Login error: ", loginError);
		
		callback(loginError);
	});
		
}


HaleyAPIVitalServiceImpl.prototype.closeAllSessions = function(callback) {

	
	if(this.haleySessionSingleton == null) {
		callback();
		return;
	}
	
	this.closeSession(haleySession, callack);
	
}

HaleyAPIVitalServiceImpl.prototype.close = function(callback) {
	
	this.vitalService.close(function(){
		
		console.log("haley api closed");
		
		callback(null);
		
	}, function(error){
		
		console.error(error);
		
		callback(error);
		
	});
	
}

HaleyAPIVitalServiceImpl.prototype.closeSession = function(haleySession, callack) {
	
	var e = this._checkSession(haleySession);
	if(e) throw e;
	
	var _this = this;
	
	var afterUnsubscribed = function() {
		
		//first register stream handler
		_this.vitalService.callFunction(VitalService.JS_UNREGISTER_STREAM_HANDLER, {streamName: _this.streamName, handlerFunction: _this.handlerFunction}, function(succsessObj){
			
			if(_this.logEnabled) {
				console.log('unregistered handler for stream ' + _this.streamName, succsessObj);
			}
			
			_this.haleySessionSingleton = null;
			
			_this._cleanup();
			callack();
			
			
		}, function(error){

			console.error('couldn\'t deregister messages handler', error);
			
			callback(error);
			
		});
		
	};
	
	var afterUnauth = function(){
		
		//unsubscribe first
		_this.vitalService.callFunction(VitalService.VERTX_STREAM_UNSUBSCRIBE, {streamName: _this.streamName}, function(succsessObj){
			
			if(_this.logEnabled) {
				console.log("unsubscribed from stream " + _this.streamName, succsessObj); 
			}
			
			afterUnsubscribed();
			
		}, function(errorObj) {
			
			console.error("Error when unsubscribing from stream", errorObj);
			
			callack(errorObj);
			
		});
		
		//do nothing
		
	}; 
	
	if(haleySession.isAuthenticated()) {
		
		//logout current user
		this.unauthenticateSession(haleySession, function(error){
			
			if(error) {
				console.error(error);
			}

			afterUnauth();
			
		});
		
	} else {
		
		afterUnauth();
		
		
	}

	
}


/**
 * Deregisters given callback based on function equality. request, types and default callback. 
 * @param haleySession
 * @param callback
 * @returns true if a callback was removed, false if not found
 */
HaleyAPIVitalServiceImpl.prototype.deregisterCallback = function(haleySession, callback) {
	
	var e = this._checkSession(haleySession);
	if(e) {
		throw e
	}
	
	if(this.defaultHandler != null && this.defaultHandler == callback) {
		this.defaultHandler = null;
		return true;
	}
	
	for( var i = 0 ; i < this.handlers.length; i++ ) {
		
		var h = this.handlers[i];
		
		if(h.callback == callback) {
			
			this.handlers.splice(i, 1);
			
			return true;
		}
		
	}
	
	//request handlers are stored in a map for efficient access
	this.requestHandlers.prototype
	
	for (var requestURI in this.requestHandlers) {
	    if (this.requestHandlers.hasOwnProperty(requestURI)) {
	        // do stuff
	    	var cb = this.requestHandlers[requestURI];
	    	if(cb == callback) {
	    		delete this.requestHandlers[requestURI];
	    		return true;
	    	}
	    }
	}
	
	return false;
	
}


/**
 * Returns current default callback for this session
 * @returns current callback
 */
HaleyAPIVitalServiceImpl.prototype.getDefaultCallback = function(haleySession) {
	var e = this._checkSession(haleySession);
	if(e) {
		throw e
	}
	return this.defaultHandler;
}

//downloadBinary(HaleySession, String, Channel)
//downloadBinary(HaleySession, String, Channel, HaleyCallback)
//getActiveThreadCount()
HaleyAPIVitalServiceImpl.prototype.getSessions = function() {
	var l = [];
	if(this.haleySessionSingleton != null) {
		l.push(this.haleySessionSingleton);
	}
	return l;
}

//isQuiescent()

HaleyAPIVitalServiceImpl.prototype._streamHandler = function(msgRL) {

	if(this.logEnabled) {
		console.log("Stream " + this.streamName + "received message: ", msgRL);
	}
	
	var m = msgRL.first();
	
//	var payload = [];
//	
//	for(var i = 1 ; i < msgRL.results.length; i++) {
//		
//		payload.push(msgRL.results[i].graphObject);
//		
//	}
	
	var c = 0;
	
	var type = m.type;
	
	//requestURI handler
	var requestURI = m.get('requestURI');
	
	if(requestURI != null) {
		
		var h = this.requestHandlers[requestURI];
		
		if(h != null) {
			
			if(this.logEnabled) {
				console.log("Notifying requestURI handler", requestURI);
			}
			
			var cbRes = h(msgRL);
			
			if(cbRes != null && cbRes == false) {
				
				if(this.logEnabled) {
					console.log("RequestURI handler returned false, unregistering");
				}
				
				delete this.requestHandlers[requestURI];
				
			} else {
				
				if(this.logEnabled) {
					
					console.log("RequestURI handler returned non-false, still regsitered");
					
				} 
					
				
			}
			
			return;
			
		}
		
	}
	
	
	//primary classes
	for(var i = 0 ; i < this.handlers.length; i++) {
		
		var h = this.handlers[i];
		
		if(h.primaryURIs[type] == true) {
			if(this.logEnabled) {
				//console.log("Notifying primary type handler: ", h.primaryURIs);
			}
			h.callback(msgRL);
			c++;
			return;
		}
		
		
	}
	
	for(var i = 0 ; i < this.handlers.length; i++) {
		
		var h = this.handlers[i];
		
		if(h.classesURIs[type] == true) {
			
			if(this.logEnabled) {
				//console.log("Notifying secondary type handler: ", h.classesURIs);
			}
			h.callback(msgRL);
			c++;
			return;
			
		}
		
	}
	
	if(this.defaultHandler != null) {
		
		if(this.logEnabled) {
			//console.log("Notifying default handler");
		}
		
		this.defaultHandler(msgRL);
		
		return;
	}
	
	
	if(this.logEnabled) {
		console.log("Notified " + c + " msg handlers");
	}
	
	//notify handlers if found
}

HaleyAPIVitalServiceImpl.prototype._sendLoggedInMsg = function(callback) {
	
	var msg = vitaljs.graphObject({type: 'http://vital.ai/ontology/vital-aimp#UserLoggedIn'});
	
	this.sendMessage(this.haleySessionSingleton, msg, [], function(error){
		
		if(error) {
			console.error("Error when sending loggedin message: ", error);
			callback(error);
		} else {
			callback(null);
		}
		
	});
}


HaleyAPIVitalServiceImpl.prototype.listCallbacks = function(haleySession) {
	var e = this._checkSession(haleySession);
	if(e) {
		throw e
	}
	
	var l = [];
	
	for (var requestURI in this.requestHandlers) {
	    if (this.requestHandlers.hasOwnProperty(requestURI)) {
	        // do stuff
	    	var cb = this.requestHandlers[requestURI];
	    	l.push({
	    		type:'request',
	    		callback: cb,
	    		requestURI: requestURI
	    	});
	    }
	}
	
	for(var i = 0 ; i < this.handlers.length; i++) {
		
		var h = this.handlers[i];
		
		l.push({
			type:'type', 
			callback: h.callback, 
			primaryURIs: h.primaryURIs,
			classesURIs: h.classesURIs
		});
		
	}

	if(this.defaultHandler != null) {
		
		l.push({
			type: 'default',
			callback: this.defaultHandler
		});
		
	}
	
	return l;
}


HaleyAPIVitalServiceImpl.prototype.listChannels = function(haleySession, callback) {
	
	var e = this._checkSession(haleySession);
	if(e) {
		callback(e);
		return;
	}
	
	//prepare channel message
	var msg = vitaljs.graphObject({type: 'http://vital.ai/ontology/vital-aimp#ListChannelsRequestMessage'});
	msg.URI = this._randomURI();
	
//	@param callback a closure (ResultList message)
	
	var requestCallback = function(message){
		
		callback(null, message);
		
		//remove it always!
		return false;
		
	}
	
	if( ! this.registerRequestCallback(haleySession, msg, requestCallback) ) {
		callback('couldn\'t register request callback');
		return;
	}
	
	var _this = this;
	
//	this.sendMessageWithRequestCallback(haleySession, aimpMessage, graphObjectsList, callback, requestCallback)
	
	this.sendMessage(this.haleySessionSingleton, msg, [], function(error){
		
		if(error) {
			console.error("Error when sending list channel request message: ", error);
			
			callback(error);
			
			_this.deregisterCallback(haleySession, requestCallback);
		}
		
	});
	
}


HaleyAPIVitalServiceImpl.prototype.openSession = function(callback) {
	
	if(this.haleySessionSingleton != null) {
		callback('active session already detected');
		return;
	}
	
	if(this.logEnabled) {
		console.log('subscribing to stream ', this.streamName);
	}
	
	var _this = this;

	this.handlerFunction = function(msgRL){
		_this._streamHandler(msgRL);
	}
	
	//first register stream handler
	this.vitalService.callFunction(VitalService.JS_REGISTER_STREAM_HANDLER, {streamName: this.streamName, handlerFunction: this.handlerFunction}, function(succsessObj){
		
		if(_this.logEnabled) {
			console.log('registered handler to ' + _this.streamName, succsessObj);
		}
		
		_this.vitalService.callFunction(VitalService.VERTX_STREAM_SUBSCRIBE, {streamName: _this.streamName}, function(succsessObj){
			
			if(_this.logEnabled) {
				console.log("subscribed to stream " + _this.streamName, succsessObj); 
			}
			
			//session opened
			_this.haleySessionSingleton = new HaleySession(_this);
			
			if(_this.haleySessionSingleton.isAuthenticated()) {
				
				_this._sendLoggedInMsg(function(error){
					
					if(_this.logEnabled) {
						console.log("LoggedIn msg sent successfully");
					}
					
					if(error) {
						callback(error);
					} else {
						callback(null, _this.haleySessionSingleton);
					}
					
				});
				
			} else {
				
				callback(null, _this.haleySessionSingleton);
				
			}
			
			
			
		}, function(errorObj) {
			
			console.error("Error when subscribing to stream", errorObj);
			
			callback(errorObj);
			
		});

		
	}, function(error){

		console.error('couldn\'t register messages handler', error);
		
		callback(error);
		
	});
	
}


/**
 * callback is a closure (AIMP_Message, List<GraphObject>)
 */
HaleyAPIVitalServiceImpl.prototype.registerCallback = function(haleySession, classURIorList, subclasses, callback) {
	
	var e = this._checkSession(haleySession);
	if(e) {
		throw e
	}
	
	for( var i = 0 ; i < this.handlers.length; i++ ) {
		
		if( this.handlers[i].callback == callback ) {
			console.warn("handler already registered ", callback);
			return false;
		}
	}
	
	var primaryURIs = {};
	
	var classesURIs = {};
	
	var inputuris = [];
	
	if(typeof(classURIorList) === 'string') {
		inputuris.push(classURIorList);
	} else {
		inputuris = classURIorList;
	}

	if(inputuris.length == 0) {
		throw "input classes URIs list must not be empty";
	}
	
	
	for(var i = 0 ; i < inputuris.length; i++) {
		
		var classURI = inputuris[i];
		
		if( ! vitaljs.isSubclassOf(classURI, 'http://vital.ai/ontology/vital-aimp#AIMPMessage')) {
			
			throw "" + classURI + " class is not a subclass of http://vital.ai/ontology/vital-aimp#AIMPMessage";
			
		}
		
		primaryURIs[classURI] = true;
		
		classesURIs[classURI] = true;
		
		
		if(subclasses) {
			
			var subclasses = vitaljs.getSubclasses({URI: classURI}, false);
			
			for(var j = 0 ; j < subclasses.length; j++) {
				
				var u = subclasses[j].URI;
				
				classesURIs[u] = true;
				
			}
			
		}
		
	}
	
	//validate if 
	
	this.handlers.push({
		callback: callback,
		primaryURIs: primaryURIs,
		classesURIs: classesURIs
	});
	
	return true;
}



HaleyAPIVitalServiceImpl.prototype.registerDefaultCallback = function(haleySession, callback) {

	var e = this._checkSession(haleySession);
	if(e) {
		throw e
	}
	
	if(callback == null) {
		if(this.defaultHandler == null) {
			return false;
		} else {
			this.defaultHandler = null;
			return true;
		}
	}
	
	if(this.defaultHandler != null && this.defaultHandler == callback) {
		return false;
	} else {
		this.defaultHandler = callback;
		return true;
	}
	
}

HaleyAPIVitalServiceImpl.prototype.registerRequestCallback = function(haleySession, aimpMessage, callback) {

	var e = this._checkSession(haleySession);
	if(e) {
		throw e
	}
	
	if(aimpMessage == null) throw "null aimpMessage";
	if(aimpMessage.URI == null) throw "null aimpMessage.URI";
	if(callback == null) throw "null callback";
	var currentCB = this.requestHandlers[aimpMessage.URI];
	
	if(currentCB == null || currentCB != callback) {
		this.requestHandlers[aimpMessage.URI] = callback;
		return true;
	} else {
		return false;
	}
	
}

//registerDefaultCallback(HaleyCallback)

HaleyAPIVitalServiceImpl.prototype._randomURI = function() {
	return 'http://vital.ai/message/msg-'+ new Date().getTime() + Math.floor(Math.random() * 100000);
}

HaleyAPIVitalServiceImpl.prototype.sendMessage = function(haleySession, aimpMessage, graphObjectsListOrCallback, callback) {
	
	var graphObjectsList = null;
	
	if(arguments.length == 3) {
		callback = graphObjectsListOrCallback;
	} else if(arguments.length == 4) {
		//ok
		graphObjectsList = graphObjectsListOrCallback;
	} else {
		console.error("expected 3 or 4 arguments");
		callback("expected 3 or 4 arguments");
		return;
	}
	
	if(typeof(callback) !== 'function') {
		console.error("callback param must be a function");
		callback("callback param must be a function");
		return;
	}
	
	if(aimpMessage == null) {
		callback("aimpMessage must not be null");
		return;
	}
	
	this.sendMessageImpl(haleySession, aimpMessage, graphObjectsList, 0, callback);
	
}
	
HaleyAPIVitalServiceImpl.prototype.sendMessageImpl = function(haleySession, aimpMessage, graphObjectsList, retryCount, callback) {
	
	if(!vitaljs.isSubclassOf(aimpMessage.type, 'http://vital.ai/ontology/vital-aimp#AIMPMessage')) {
		callback("aimpMessage must be an instance of AIMPMessage class, type: " + aimpMessage.type);
		return;
	}
	
	if(aimpMessage.URI == null) {
		aimpMessage.URI = this._randomURI();
	}
	
	if(aimpMessage.get('channelURI') == null && haleySession.defaultChannelURI != null) {
		aimpMessage.set('channelURI', haleySession.defaultChannelURI);
	}
	
	if(aimpMessage.get('endpointURI') == null && haleySession.defaultEndpointURI != null ) {
		aimpMessage.set('endpointURI', haleySession.defaultEndpointURI);
	}
	
	var updateTimestamp = true;
	
	var msgType = aimpMessage.type;
	
	if(msgType == 'http://vital.ai/ontology/vital-aimp#UserLoggedIn'
		|| msgType == 'http://vital.ai/ontology/vital-aimp#UserLoggedOut'
		|| msgType == 'http://vital.ai/ontology/vital-aimp#UserLeftApp') {
		updateTimestamp = false;
	} else if(msgType == 'http://vital.ai/ontology/vital-aimp#HeartbeatMessage') {
		updateTimestamp = false;
		if(this.lastActivityTimestamp != null) {
			aimpMessage.set('lastActivityTime', this.lastActivityTimestamp);
		}
	}
	
	var sessionID = haleySession.getSessionID();

	var authAccount = haleySession.getAuthAccount();
	
	
	if( authAccount != null ) {
		
		var userID = aimpMessage.get('userID');
		
		var authUserID = authAccount.get('username');

		var masterUserID = aimpMessage.get('masterUserID');
		
		if(masterUserID != null) {

			if(masterUserID != authUserID) {
				callback("aimp masterUserID must be equal to current user userID: " + masterUserID + " vs " + authUserID);
				return;
			}
			
			if(userID == null) {
				callback('aimp message userID is required when tunneling the message with masterUserID');
				return;
			}

			
			if(masterUserID == userID) {
				callback('masterUserID cannot be equal to userID: ' + masterUserID);
				return;
			}
				
		} else {
		
			if(userID == null) {
				aimpMessage.set('userID', authUserID);
			} else {
				if(userID != authUserID) {
					callback('auth userID ' + authUserID + ' does not match one set in message: ' + userID);
					return;
				}
			}
			
			var n = authAccount.get('name');
			aimpMessage.set('userName', n != null ? n : authAccount.get('username'));
			
		}
		
		
		
		
	} else {
		
		
		if( haleySession.tunnelEnabled == true ) {
			callback('tunnel must not be enabled for anonymous sessions');
			return;
		} 
//		this.defaultUserID = null;
//		//default userName for output messages
//		this.defaultUserName = null;
//		//with tunnelEnabled option the message masterUserID will be set 
//		//allowing for different userID set in the message
//		this.tunnelEnabled = false;
		
		if(aimpMessage.get('userID') == null && haleySession.defaultUserID != null) {
			aimpMessage.set('userID', haleySession.defaultUserID);
		}
		
		if(aimpMessage.get('userName') == null && haleySession.defaultUserName != null) {
			aimpMessage.set('userName', haleySession.defaultUserName);
		}
	
		
	}
	
	
	var sid = aimpMessage.get('sessionID');
	if(sid == null) {
		aimpMessage.set('sessionID', sessionID);
	} else {
		if(sid != sessionID) {
			callback('auth sessionID ' + sessionID + " does not match one set in message: " + sid);
		}
	}
	
	var rl = vitaljs.resultList();
	rl.addResult(aimpMessage);
	
	if(graphObjectsList != null) {
		for(var i = 0 ; i < graphObjectsList.length; i++) {
			rl.addResult(graphObjectsList[i]);
		}
	}
	
//	this.vi
	var currentLogin = this.vitalService.getCurrentLogin();
	
	var method = currentLogin != null ? 'haley-send-message' : 'haley-send-message-anonymous';
	
	var _this = this;
	
	this.vitalService.callFunction(method, {message: rl}, function(successRL){
		
		if(_this.logEnabled) {
			console.log("message sent successfully", successRL);
		}
		
		if(updateTimestamp) {
			_this.lastActivityTimestamp = new Date().getTime();
		}
		
		for(var i = 0 ; i < _this.aimpMessageSentListeners.length; i++) {
			var listener = _this.aimpMessageSentListeners[i];
			listener(haleySession, aimpMessage, graphObjectsList);
		}
		
		callback();
		
	}, function(error){
		
		console.error("error when sending message: " + error);
		
		if( retryCount == 0 && error && error.indexOf('error_denied') == 0) {
			
			var cachedCredentials = _this.cachedCredentials[sessionID];
			
			if(cachedCredentials != null) {
				
				if(_this.logEnabled) console.log("Session not found, re-authenticating...");
				
				//this info updated in vitalservice instance
//				haleySession.authAccount = null
//				haleySession.authenticated = false
//				haleySession.authSessionID = null
//				vitalService.appSessionID = null
				
				_this.authenticateSession(haleySession, cachedCredentials.username, cachedCredentials.password, function(authError, login){
			
					if(! authError ) {
						if(_this.logEnabled) console.log("Successfully reauthenticated the session, sending the message");
						_this.sendMessageImpl(haleySession, aimpMessage, graphObjectsList, retryCount + 1, callback);
						
					} else {
						
						console.error("Reauthentication attempt failed: ", authError);
						
						callback(error);
						
						return
						
					}
					
				});
				
				return;
				
			}
			
		}
		
		callback(error);
		
	});
	
}

HaleyAPIVitalServiceImpl.prototype.sendMessageWithRequestCallback = function(haleySession, aimpMessage, graphObjectsList, callback, requestCallback) {

	var resp = this.registerRequestCallback(haleySession, aimpMessage, requestCallback);
	
	this.sendMessage(haleySession, aimpMessage, graphObjectsList, callback);
	
	return resp;
	
}

HaleyAPIVitalServiceImpl.prototype.unauthenticateSession = function(haleySession, callback) {

	var e = this._checkSession(haleySession);
	if(e) {
		callback(e);
		return;
	}
	
	var sessionID = haleySession.getSessionID();
	if(sessionID != null) {
		delete this.cachedCredentials[sessionID];
	}
	
	if(!haleySession.isAuthenticated()) {
		callback('session not authenticated');
		return;
	}

	
	//first send logged out message
	var msg = vitaljs.graphObject({type: 'http://vital.ai/ontology/vital-aimp#UserLoggedOut'});

	var _this = this;
	
	this.sendMessage(haleySession, msg, [], function(error){
		if(error) {
			console.error("Error when sending logged out msg");
			callback(error);
			return;
		}
		
		_this.vitalService.callFunction(VitalServiceWebsocketImpl.vitalauth_logout, {}, function(logoutSuccess){
			
			if(_this.logEnabled) {
				console.log("Logout function success", logoutSuccess);
			}
			
			callback();
			
		}, function(logoutError) {
			
			console.error("Logout function error", logoutError);
			
			callback(logoutError);
			
		});
		
		
	});
	
	

}

//uploadBinary(HaleySession, Channel)
//uploadBinary(HaleySession, Channel, HaleyCallback)




HaleyAPIVitalServiceImpl.prototype.addReconnectListener = function(reconnectListener) {


	if(this.reconnectListeners.indexOf(reconnectListener) >= 0) {
		if(this.logEnabled) console.log("Reconnect listner already added");
		return false;
		
	} else {
		
		if(this.logEnabled) console.log("New reconnect listener added");
		
		this.reconnectListeners.push(reconnectListener);
		
		return true;
		
	}
	
}


HaleyAPIVitalServiceImpl.prototype.removeReconnectListener = function(reconnectListener) {

	var indexOf = this.reconnectListeners.indexOf(reconnectListener);
	
	if(indexOf < 0) {
		return false;
	}
	
	this.reconnectListeners.splice(indexOf, 1);
	
	return true;
	
}

HaleyAPIVitalServiceImpl.prototype._listServerDomainModelsJQueryImpl = function(callback) {
	
	console.log("Getting server domains list from saas server");

	if(typeof(document) === 'undefined') {
		callback("No document object - client side listServerDomainModels not available");
		return;
	}
	
	if(typeof(jQuery) === 'undefined') {
		callback("No jQuery object - client side listServerDomainModels not available");
		return;
	}
	
    var parser  = document.createElement("a");
    parser.href = this.vitalService.impl.url;
    
    var domainsURL = parser.protocol + '//' + parser.host + '/domains';
    
	//Load the request module
	var jqxhr = $.ajax( { method: 'GET', url: domainsURL, cache: false} )
	.done(function(body) {
		try {
			console.log("domains objects", body);
			var parsed = body;
   			var domainsList = [];
   			for(var i = 0 ; i < parsed.length; i++) {
   				var obj = parsed[i];
   				domainsList.push(vitaljs.graphObject(obj));
   			}
    			
			callback(null, domainsList);
				
   		} catch(e) {
   			callback("error when parsing domains json: " + e, null);
   		}
	}).fail(function(jqXHR, textStatus) {
		console.error("domains check failed: " + textStatus);
    	callback(textStatus, null);
	});
		
}

HaleyAPIVitalServiceImpl.prototype.listServerDomainModels = function(callback) {

	console.log("Getting server domains list");
	
	if(typeof(module) === 'undefined') {
//		callback("No module object - listServerDomainModels is only available in nodejs context");
//		return;
		this._listServerDomainModelsJQueryImpl(callback);
		return;
	}
	
	if(typeof(require) === 'undefined') {
		callback("No require object - listServerDomainModels is only available in nodejs context");
		return;
	}
	
	var domainsURL = this.saasServerURL + '/domains';

	//Load the request module
	var request = require('request');

	
	request({
	    url: domainsURL,
	    qs: {}, //Query string data
	    method: 'GET'
	}, function(error, response, body){
	    if(error) {
	    	console.error("Error when getting user profile data", error);
	    	callback(error, null);
	    } else {
	    	if(response.statusCode == 200) {
	    		
	    		console.log(response.statusCode, ( body && body.length > 100 ) ? ( body.substring(0, 97) + "...") : body);
	    		try {
	    			
	    			var parsed = JSON.parse(body);
	    			var domainsList = [];
	    			for(var i = 0 ; i < parsed.length; i++) {
	    				var obj = parsed[i];
	    				domainsList.push(vitaljs.graphObject(obj));
	    			}
	    			
    				callback(null, domainsList);
    				
	    		} catch(e) {
	    			callback("error when parsing domains json: " + e, null);
	    		}
	    	} else {
	    		console.error("Error when getting domains data " + response.statusCode, body);
	    	}
	    }
	});
	
}


HaleyAPIVitalServiceImpl.prototype.uploadFileInBrowser = function(haleySession, fileQuestionMessage, fileObject, callback) {
	this._uploadFileImpl(true, haleySession, fileQuestionMessage, fileObject, callback);
}	
HaleyAPIVitalServiceImpl.prototype.uploadFile = function(haleySession, fileQuestionMessage, fileObject, callback) {
	this._uploadFileImpl(false, haleySession, fileQuestionMessage, fileObject, callback);
}

HaleyAPIVitalServiceImpl.prototype._uploadFileImpl = function(isBrowser, haleySession, fileQuestionMessage, fileObject, callback) {	
	
	var _this = this;
	
	if(isBrowser) {
		
		if( fileObject.file == null ) {
			callback("no form 'file' object in fileObject param");
			return;
		}
		
	} else {
		
		if( fileObject.filePath == null || fileObject.filePath.length == 0 ) {
			callback("no 'filePath' string in  fileObject param");
			return;
		}
		
	}
	
	if(fileQuestionMessage == null || fileQuestionMessage.length < 2) {
		callback("expected at least two elements in fileQuestionMessage");
		return;
	}
	
	var questionMessage = fileQuestionMessage[0];
	if(questionMessage.type != 'http://vital.ai/ontology/vital-aimp#QuestionMessage') {
		callback("expected a QuestionMessage: " + questionMessage.type);
		return;
	}
	
	var fileQuestion = fileQuestionMessage[1];
	if(fileQuestion.type != 'http://vital.ai/ontology/vital-aimp#FileQuestion') {
		callback("not a FileQuestion: " + fileQuestion.type);
		return;
	}
	
	var scope = fileQuestion.get('fileScope');
	if(!scope) {
		callback("no file scope: " + scope);
		return;
	}
	
	var accountURIs = fileObject.accountURIs;
    
    
    var fileNodeClass = fileObject.fileNodeClass;
    if(!fileNodeClass) {
    	fileNodeClass = 'http://vital.ai/ontology/vital#FileNode';
    }
    var parentNodeURI = fileObject.parentNodeURI;
    
    var url = this.saasServerURL + '/fileupload/';
    
//    url += '?fileNodeClass=' + encodeURIComponent(fileNodeClass);
    url += '?temporary=true'
//    url += '&scope=' + scope;
    
    var currentLogin = this.vitalService.getCurrentLogin();
    
    if(currentLogin != null) {
    	
    	url += '&authSessionID=' + encodeURIComponent(this.getAuthSessionID(haleySession));
    	
    } else {
    	
    	//anonymous upload?
    	url += '&sessionID=' + encodeURIComponent(this.getSessionID(haleySession));
    	
    }
    
    
    
//    if(accountURIs != null && accountURIs.length > 0) {
//    	url += '&accountURIs=' + encodeURIComponent(accountURIs.join(','))
//    }
//
//    if(parentNodeURI) {
//    	url += '&parentNodeURI=' + encodeURIComponent(parentNodeURI); 
//    }
//    
    
    
    console.log('upload URL: ' + url);
    
    //old way
	var onFileNodeURI = function(fileNodeURI, newFileNode){
		
		//file node URI created, assemble response
		
		var am = vitaljs.graphObject({type: 'http://vital.ai/ontology/vital-aimp#AnswerMessage'});
		am.URI = _this._randomURI();
		am.set('replyTo', questionMessage.URI);
		am.set('channelURI', questionMessage.get('channelURI'))
		am.set('endpointURI', questionMessage.get('endpointURI'));
		

		var fa = vitaljs.graphObject({type: 'http://vital.ai/ontology/vital-aimp#FileAnswer'});
		fa.URI = _this._randomURI();
		fa.set('fileNodeURI', fileNodeURI)
		
		_this.sendMessage(_this.haleySessionSingleton, am, [fa], function(error){
			
			if(error) {
				
				var errMsg = "Error when sending file answer: " + error;
				
				console.error(errMsg);
				
				callback(errMsg);
				
			} else {
				
				//answer accepted
				callback(null, newFileNode);
				
			}
			
		});
		
		//the dialog has to answer with a filenode now
		
		
	};
	
	var onFileDataResponse = function(data) {
	
		console.log('file data received: ', data);
		
	
		var am = vitaljs.graphObject({type: 'http://vital.ai/ontology/vital-aimp#AnswerMessage'});
		am.URI = _this._randomURI();
		am.set('replyTo', questionMessage.URI);
		am.set('channelURI', questionMessage.get('channelURI'))
		am.set('endpointURI', questionMessage.get('endpointURI'));
		
//		var fileName.fileName

		var fa = vitaljs.graphObject({type: 'http://vital.ai/ontology/vital-aimp#FileAnswer'});
		fa.URI = _this._randomURI();
		fa.set('fileNodeClassURI', fileNodeClass);
		fa.set('parentObjectURI', parentNodeURI);
		fa.set('url', data.url);
		fa.set('fileName', data.fileName);
		fa.set('fileType', data.fileType);
		fa.set('fileLength', data.fileLength);
		fa.set('deleteOnSuccess', true);
		
		_this.sendMessageWithRequestCallback(_this.haleySessionSingleton, am, [fa], function(error){
			
			if(error) {
				
				var errMsg = "Error when sending file answer: " + error;
				
				console.error(errMsg);
				
//				callback(errMsg);
				
			} else {
				
				console.log('file upload answer sent');
				//answer accepted
//				callback(null, newFileNode);
				
			}
			
		}, function(msgRL){
			
			var msg = msgRL.first();
			
			console.log('file upload response:', msg);
			
			if(msg.type != 'http://vital.ai/ontology/vital-aimp#MetaQLResultsMessage') {
				return true;
			}
			
			var status = msg.get('status');
			
			if(status != 'ok') {
				var statusMessage = msg.get('statusMessage');
				if(!statusMessage) statusMessage = 'unknow file upload error';
				callback(statusMessage);
				return false;
			}
			
			var fileNode = null;
			
			var fileNodes = msgRL.iterator('http://vital.ai/ontology/vital#FileNode');
			
			if(fileNodes.length > 0) {
				fileNode = fileNodes[0];
			}
			
			if(fileNode == null) {
				callback('no file node in the response');
				return false;
			}
			
			callback(null, fileNode);
			
			return false;
			
		});
		
		
	}
	
	if(isBrowser) {
		
		var fd = new FormData();
		fd.append('upload_file', fileObject.file);
		
	    var xhr = new XMLHttpRequest();
		console.log('default timeout: ', xhr.timeout);
		
		xhr.open("POST", url, true);
		xhr.onreadystatechange = function() {
			
			if (xhr.readyState == 4) {
				
				var error = null;
				
				var r = null;
				
//				var fileNodeURI = null;
//				
//				var newFileNode = null;
				
				var fileData = null;
				
				if(xhr.status == 200) {
					
					try {
						
						r = JSON.parse(xhr.responseText)
						
						if(r.error) {
							error = r.error
						} else {
							
							if(r.temporary == true) {
								
								fileData = r;
								
							} else {
								
								error = 'only temporary response accepted';
								
//								fileNodeURI = r.fileNodeURI;
//								
//								newFileNode = vitaljs.graphObject( r.fileNode );
								
							}
							
							
							
						}
						
					} catch(e) {
						
						error = 'response error: ' + e.message;
						
					}
					//parse json
					
				} else {
					
					error = 'HTTP status ' + xhr.status + ' - ' + xhr.responseText
					
				}

				if(error) {
					
					callback(error);

				} else {
					
//					onFileNodeURI(fileNodeURI, newFileNode);
					
					onFileDataResponse(fileData);
					
				}

			}

		};

		xhr.send(fd);
		
	} else {
		
		var fs = require('fs');
		
		var request = require('request');
		
		var formData = {};
		
		try {
			console.log("uploading file from location: " + fileObject.filePath);
			var rs = fs.createReadStream(fileObject.filePath);
			console.log("readstream", rs);
			formData['upload_file'] = rs;
		} catch(e) {
			console.error("error when starting upload: ", e);
			callback("error when starting upload: " + e.message);
			return;
		}
		
		var req = request.post({url:url, formData: formData}, function (err, resp, body) {
		  
			if (err) {
				console.error(err);
				callback("Error when uploading file: " + err);
				return;
			}
			console.log('Server response: ' + body);
			
			var fileData = null;
			
			var error = null;
			
			try {
				
				r = JSON.parse(body);
				
				if(r.error) {
					error = r.error
				} else {
					
					if(r.temporary == true) {
						
						fileData = r;
						
					} else {
						
						error = 'only temporary response accepted';
						
					}
					
				}
				
			} catch(e) {
				
				error = 'response error: ' + e.message;
				
			}
			
			if(error) {
				
				callback(error);

			} else {
				
				onFileDataResponse(fileData);
				
			}
			
		});
		
	}
	
}


HaleyAPIVitalServiceImpl.prototype.cancelFileUpload = function(haleySession, fileQuestionMessage, callback) {

	
	
	var questionMessage = fileQuestionMessage[0];
	
	//file node URI created, assemble response
	var am = vitaljs.graphObject({type: 'http://vital.ai/ontology/vital-aimp#AnswerMessage'});
	am.URI = this._randomURI();
	
	
	am.set('replyTo', questionMessage.URI);
	am.set('channelURI', questionMessage.get('channelURI'))
	am.set('endpointURI', questionMessage.get('endpointURI'));
	am.set('answerSkipped', true);

	var fa = vitaljs.graphObject({type: 'http://vital.ai/ontology/vital-aimp#FileAnswer'});
	fa.URI = this._randomURI();
	fa.set('fileNodeURI', null)
	
	this.sendMessage(this.haleySessionSingleton, am, [fa], function(error){
		
		if(error) {
			
			var errMsg = "Error when sending file answer skip: " + error;
			
			console.error(errMsg);
			
			callback(errMsg);
			
		} else {
			
			//answer skip accepted
			callback(null);
			
		}
		
	});
	
}


HaleyAPIVitalServiceImpl.s3URLPattern = /^s3\:\/\/([^\/]+)\/(.+)$/;

HaleyAPIVitalServiceImpl.prototype.getFileNodeDownloadURL = function(haleySession, fileNode) {

	var scope = fileNode.get('fileScope');
	
	if(!scope) scope = 'public';
	
	if('PRIVATE' === scope.toUpperCase()) {
			
		return this.getFileNodeURIDownloadURL(haleySession, fileNode.URI);
		
	} else {
		
		//just convert s3 to public https link
		var fileURL = fileNode.get('fileURL');
		var res = HaleyAPIVitalServiceImpl.s3URLPattern.exec(fileURL);
		if(res != null) {
			
			var bucket = res[1];
			var key = res[2];
		
			var keyEscaped = key.replace(new RegExp('%', 'g'), '%25')
			
			return 'https://' + bucket + '.s3.amazonaws.com/' + keyEscaped;
			
		}
		
		return fileURL;
		
	}
	
	
}

/**
 * Returns the download URL for given file node URI
 */
HaleyAPIVitalServiceImpl.prototype.getFileNodeURIDownloadURL = function(haleySession, fileNodeURI) {

	var url = this.saasServerURL + '/filedownload?fileURI=' + encodeURIComponent(fileNodeURI);
	
	if(haleySession.isAuthenticated()) {
		
		url += '&authSessionID=' + encodeURIComponent(this.getAuthSessionID(haleySession));
	    
	} else {
		
		url += '&sessionID=' + encodeURIComponent(this.getSessionID(haleySession));
		
	}
	
	return url;
	
	
}

/**
 * add a listener notified with (error, haleySession, aimpMessage, payload)
 * returns true if added, false if already added
 */
HaleyAPIVitalServiceImpl.prototype.addAIMPMessageSentListener = function(listener) {
	if( this.aimpMessageSentListeners.indexOf(listener) >= 0) return false;
	this.aimpMessageSentListeners.push(listener);
	return true;
}

/**
 * remove an AIMP message sent listener
 * returns true if removed, false if was not added 
 */
HaleyAPIVitalServiceImpl.prototype.removeAIMPMessageSentListener = function(listener) {
	var index = this.aimpMessageSentListeners.indexOf(listener);
	if(index < 0) return false;
	this.aimpMessageSentListeners.splice(index, 1);
	return true;
} 


if(typeof(module) !== 'undefined') {

//	if(typeof(VitalService) === 'undefined') {

		//VitalService = require(__dirname + '/../vitalservice-js/vitalservice-0.2.304.js');
		
//	}
	
//	if(typeof(VitalServiceWebsocketImpl) === 'undefined') {
		
		//VitalServiceWebsocketImpl = require(__dirname + '/../vitalservice-js/vitalservice-0.2.304.js');
		
//	}
	
	
	module.exports = HaleyAPIVitalServiceImpl;
	
}