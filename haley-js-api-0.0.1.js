/**
 * Represents a haley session, two states authenticated / not authenticated
 * @param implementation
 * @returns
 */
HaleySession = function(implementation){
	//haley session maintains its state
	this.impl = implementation;
	//default channel URI for output messages
	this.defaultChannelURI = null;
	//default endpoint URI for output messages
	this.defaultEndpointURI = null;
	//default userID for output messages
	//only used in with anonymous sessions 
	this.defaultUserID = null;
	//default userName for output messages
	this.defaultUserName = null;
}

HaleySession.prototype.isAuthenticated = function() {
	return this.impl.isAuthenticated(this);
}

HaleySession.prototype.getAuthSessionID = function() {
	return this.impl.getAuthSessionID(this);
}

HaleySession.prototype.getSessionID = function() {
	return this.impl.getSessionID(this);
}

/**
 * returns current auth account (login) used to authenticate
 */
HaleySession.prototype.getAuthAccount = function() {
	return this.impl.getAuthAccount(this);
}



/**
 * 
 * all callbacks have node.js style params: ( error , results... )
 * 
 * @param implementation
 * @param syncdomains
 * @returns
 */
HaleyAPI = function(implementation, syncdomains, callback) {
	this.impl = implementation;
	if(syncdomains) {
		throw "syncdomains not supported yet";
	}
	var _this = this;
	this.impl.initialize(syncdomains, function(error){
		
		if(error) {
			callback(error);
			return;
		}
		
		callback(null, _this);
		
	});
}


/**
 * Authenticates haley session or throws exception if already authenticated or auth error occured
 */
HaleyAPI.prototype.authenticateSession = function(haleySession, username, password, callback) {
	this.impl.authenticateSession(haleySession, username, password, callback);
}


HaleyAPI.prototype.closeAllSessions = function(callback) {
	this.impl.closeAllSessions(callback);
}

HaleyAPI.prototype.closeSession = function(haleySession, callack) {
	this.impl.closeSession(haleySession, callack);
}


/**
 * Deregisters given callback based on function equality. request, types and default callback. 
 * @param haleySession
 * @param callback
 * @returns true if a callback was removed, false if not found
 */
HaleyAPI.prototype.deregisterCallback = function(haleySession, callback) {
	return this.impl.deregisterCallback(haleySession, callback);
}


/**
 * Returns current default callback for this session
 * @returns current callback
 */
HaleyAPI.prototype.getDefaultCallback = function(haleySession) {
	return this.impl.getDefaultCallback(haleySession);
}


//downloadBinary(HaleySession, String, Channel)
//downloadBinary(HaleySession, String, Channel, HaleyCallback)
//getActiveThreadCount()
HaleyAPI.prototype.getSessions = function() {
	return this.impl.getSessions();
}

//isQuiescent()


/**
 * Returns a list of current typed callbacks. List element: 
 * { type: 'request', 'type', 'default'
 * 	 //for 'type'
 *   primaryURIs: [],
 *   classesURIs: [],
 *   callback: function,
 *   //for 'request'
 *   requestURI: string
 * }
 */
HaleyAPI.prototype.listCallbacks = function(haleySession) {
	return this.impl.listCallbacks(haleySession);
}



/**
 * @param haleySession
 * @param callback a closure( error, List<Channel>)
 */
HaleyAPI.prototype.listChannels = function(haleySession, callback) {
	this.impl.listChannels(haleySession, callback);
}


/**
 * In some implementations the session may be already authenticated
 */
HaleyAPI.prototype.openSession = function(callback) {
	this.impl.openSession(callback);
}


/**
 * Registers a message type callback
 * @param haleySession
 * @param classURIorList
 * @param subclasses (boolean)
 * @param callback a closure (ResultList message)
 * @return true if registered, false if already registered
 */
HaleyAPI.prototype.registerCallback = function(haleySession, classURIorList, subclasses, callback) {
	return this.impl.registerCallback(haleySession, classURIorList, subclasses, callback);
}

/**
 * Registers default (fallback) callback
 * @param haleySession
 * @param callback, null value deregisters default callback (ResultList message)
 * @return true if this is a new or different callback, false if this handler is already registered
 */
HaleyAPI.prototype.registerDefaultCallback = function(haleySession, callback) {
	return this.impl.registerDefaultCallback(haleySession, callback);
}

/**
 * Registers a request callback
 * @param haleySession
 * @param aimpMessage
 * @param callback a closure (ResultList message)
 * @return true if this is a new or different callback, false if this handler is already registered
 */
HaleyAPI.prototype.registerRequestCallback = function(haleySession, aimpMessage, callback) {
	return this.impl.registerRequestCallback(haleySession, aimpMessage, callback);
}



/**
 * sends a message. The callback 
 * @param haleySession
 * @param aimpMessage
 * @param graphObjectsList
 * @param callback - gets notified if the message was sent successfully - null error - or not
 */
HaleyAPI.prototype.sendMessage = function(haleySession, aimpMessage, graphObjectsList, callback) {
	this.impl.sendMessage(haleySession, aimpMessage, graphObjectsList, callback);
}

/**
 * sends a message with associated requestCallback
 * @param haleySession
 * @param aimpMessage 
 * @param graphObjectsList
 * @param callback - gets notified if the message was sent successfully - null error - or not
 * @param requestCallback - the callback that is registered for this requestURI 
 * @return true if this is a new or different callback, false if this handler is already registered
 */
HaleyAPI.prototype.sendMessageWithRequestCallback = function(haleySession, aimpMessage, graphObjectsList, callback, requestCallback) {
	return this.impl.sendMessageWithRequestCallback(haleySession, aimpMessage, graphObjectsList, callback, requestCallback);
}

HaleyAPI.prototype.unauthenticateSession = function(haleySession, callback) {
	this.impl.unauthenticateSession(haleySession, callback);
}


/**
 * Adds reconnect listener that gets notified on reconnect event.
 * @return true if new listener, false if already registered.
 */
HaleyAPI.prototype.addReconnectListener = function(reconnectListener) {
	return this.impl.addReconnectListener(reconnectListener);
}

/**
 * Removes reconnect listener.
 * @return true if listener found, false otherwise.
 */
HaleyAPI.prototype.removeReconnectListener = function(reconnectListener) {
	return this.impl.removeReconnectListener(reconnectListener);
}


/**
 * callback called with String error, List<DomainModel>
 */
HaleyAPI.prototype.listServerDomainModels = function(callback) {
	return this.impl.listServerDomainModels(callback);
}

/**
 * callback called with String error
 */
HaleyAPI.prototype.validateDomainModels = function(failIfListElementsDifferent, callback) {
	
	this.listServerDomainModels(function(error, models){
		
		try {
			
			if(error) {
				callback("Error when listing server domain models: " + error);
				return;
			}
		
			
			var localDomains = {};
			var serverDomains = {};
			
			
			for(var i = 0 ; i < models.length; i++) {
				var dm = models[i];
				serverDomains[dm.URI] = dm;
			}
			
			var localDomainsList = [];
			
			for(var i = 0 ; i < VitalServiceJson.SINGLETON.dynamicDomains.length; i++) {
				var ld = VitalServiceJson.SINGLETON.dynamicDomains[i];
				var dm = vitaljs.graphObject({type: 'http://vital.ai/ontology/vital-core#DomainModel', URI: ld.domainURI});
				dm.set('name', ld.name);
				dm.set('domainOWLHash', ld.domainOWLHash);
				dm.set('versionInfo', ld.version);
				localDomains[dm.URI] = dm;
				localDomainsList.push(dm);
			}
			
			if(failIfListElementsDifferent) {
				
				var localURIs = Object.keys(localDomains);
				var serverURIs = Object.keys(serverDomains);
				
				//remove all
//				localURIs.removeAll(serverURIs)
				for(var i = 0; i < serverURIs.length; i++) {
					var su = serverURIs[i];
					var index = localURIs.indexOf(su);
					if(index >= 0) {
						localURIs.splice(index, 1);
					}
				}
				
				if(localURIs.length > 0) {
					callback("The following domains are loaded only locally: " + localURIs.join(", "));
					return 
				}
				
				localURIs = Object.keys(localDomains);
//				serverURIs.removeAll(localURIs)
				for(var i = 0 ; i < localURIs.length; i++) {
					var lu = localURIs[i];
					var index = serverURIs.indexOf(lu);
					if(index >= 0) {
						serverURIs.splice(index, 1);
					}
				}
				
				if(serverURIs.length > 0) {
					callback("The following domains are loaded only on the server: " + serverURIs.join(", "));
					return 
				}
				 
			}
			
			
			var differentDomains = [];
			
			for(var i = 0 ; i < localDomainsList.length; i++) {
				
				var localDomain = localDomainsList[i];
				
				var serverDomain = serverDomains[localDomain.URI];
				
				if(!failIfListElementsDifferent && serverDomain == null) {
					continue;
				}

				var hash1 = localDomain.get('domainOWLHash');
				var hash2 = serverDomain.get('domainOWLHash');
				var v1 = localDomain.get('versionInfo');
				var v2 = serverDomain.get('versionInfo');

				if(hash1 != null && hash1 != hash2) {
					differentDomains.push(localDomain.URI + " local hash: " + hash1 + " remote hash: " + hash2);
					continue;
				}			

				if(v1 != null && v1 != v2) {
					differentDomains.push(localDomain.URI + " local version: " + v1 + " remote version: " + v2);
					continue;
				}		
				
				
			}
			
			if(differentDomains.length > 0) {
				callback("Different domains detected [" + differentDomains.length + "]: " + differentDomains.join(", "));
				return;
			}
			
			callback(null);
			
		} catch(e) {
			console.error(e);
			callback("Internal error: " + e);
		}
		
	});
	
}

//uploadBinary(HaleySession, Channel)
//uploadBinary(HaleySession, Channel, HaleyCallback)

//nodejs specific
if(typeof(module) !== 'undefined') {
//	module.exports = {
//		HaleySession: HaleySession,
//		HaleyAPI: HaleyAPI
//	}; 
	module.exports = HaleyAPI;
}