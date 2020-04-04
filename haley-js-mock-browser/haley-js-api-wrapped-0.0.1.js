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
HaleyWrappedAPI = function(implementation, syncdomains, callback, logger) {

	this.HALEY_API = new HaleyAPI(implementation, syncdomains, callback, logger);

	HALEY_API = this;

	this.PAYLOAD_LIMIT = 50000;

	this.mappingHandler = {};
}

HaleyWrappedAPI.prototype.setLogger = function(logger){
	this.HALEY_API.setLogger(logger);
}

HaleyWrappedAPI.prototype.getLogger = function() {
	return this.HALEY_API.getLogger()
}

/**
 * Authenticates haley session or throws exception if already authenticated or auth error occured
 */
HaleyWrappedAPI.prototype.authenticateSession = function(haleySession, username, password, callback) {
	this.HALEY_API.authenticateSession(haleySession, username, password, callback);
}

/**
 * Authenticates haley session or throws exception if already authenticated or auth error occured
 */
HaleyWrappedAPI.prototype.authenticateSessionWithAccountID = function(haleySession, username, password, accountID, callback) {
	this.HALEY_API.authenticateSessionWithAccountID(haleySession, username, password, accountID, callback);
}


HaleyWrappedAPI.prototype.close = function(callback) {
	this.HALEY_API.close(callback);
}

HaleyWrappedAPI.prototype.closeAllSessions = function(callback) {
	this.HALEY_API.closeAllSessions(callback);
}

HaleyWrappedAPI.prototype.closeSession = function(haleySession, callback) {
	this.HALEY_API.closeSession(haleySession, callback)
}


/**
 * Deregisters given callback based on function equality. request, types and default callback. 
 * @param haleySession
 * @param callback
 * @returns true if a callback was removed, false if not found
 */
HaleyWrappedAPI.prototype.deregisterCallback = function(haleySession, callback) {
	return this.HALEY_API.deregisterCallback(haleySession, callback);
}


/**
 * Returns current default callback for this session
 * @returns current callback
 */
HaleyWrappedAPI.prototype.getDefaultCallback = function(haleySession) {
	return this.HALEY_API.getDefaultCallback(haleySession);
}



//getActiveThreadCount()
HaleyWrappedAPI.prototype.getSessions = function() {
	return this.HALEY_API.getSessions();
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
HaleyWrappedAPI.prototype.listCallbacks = function(haleySession) {
	return this.HALEY_API.listCallbacks(haleySession);
}



/**
 * @param haleySession
 * @param callback a closure( error, List<Channel>)
 */
HaleyWrappedAPI.prototype.listChannels = function(haleySession, callback) {
	this.HALEY_API.listChannels(haleySession, callback);
}


/**
 * In some implementations the session may be already authenticated
 */
HaleyWrappedAPI.prototype.openSession = function(callback) {
	this.HALEY_API.openSession(callback);
}


/**
 * Registers a message type callback
 * @param haleySession
 * @param classURIorList
 * @param subclasses (boolean)
 * @param callback a closure (ResultList message)
 * @return true if registered, false if already registered
 */
HaleyWrappedAPI.prototype.registerCallback = function(haleySession, classURIorList, subclasses, callback) {
	return this.HALEY_API.registerCallback(haleySession, classURIorList, subclasses, callback);
}

/**
 * Registers default (fallback) callback
 * @param haleySession
 * @param callback, null value deregisters default callback (ResultList message)
 * @return true if this is a new or different callback, false if this handler is already registered
 */
HaleyWrappedAPI.prototype.registerDefaultCallback = function(haleySession, callback) {
	return this.HALEY_API.registerDefaultCallback(haleySession, callback);
}

/**
 * Registers a request callback
 * @param haleySession
 * @param aimpMessage
 * @param callback a closure (ResultList message)
 * @return true if this is a new or different callback, false if this handler is already registered
 */
HaleyWrappedAPI.prototype.registerRequestCallback = function(haleySession, aimpMessage, callback) {
	return this.HALEY_API.registerRequestCallback(haleySession, aimpMessage, callback);
}



/**
 * sends a message. The callback 
 * @param haleySession
 * @param aimpMessage
 * @param graphObjectsList
 * @param callback - gets notified if the message was sent successfully - null error - or not
 */
HaleyWrappedAPI.prototype.sendMessage = function(haleySession, aimpMessage, graphObjectsList, callback) {
	this.HALEY_API.sendMessage(haleySession, aimpMessage, graphObjectsList, callback);
}

/**
 * wrapped the requestCallback to handle partial Message result return. 
 * redirect to call splitLargePayloadAndSendMessageWithRequestCallback if the length of graphObjectsList exceed the PAYLOAD_LIMITE set on this panel.
 * @param haleySession
 * @param aimpMessage 
 * @param graphObjectsList
 * @param callback - gets notified if the message was sent successfully - null error - or not
 * @param requestCallback - the callback that is registered for this requestURI 
 * @return true if this is a new or different callback, false if this handler is already registered
 */
HaleyWrappedAPI.prototype.sendMessageWithRequestCallback = function(haleySession, aimpMessage, graphObjectsList, callback, requestCallback) {

	if(!this.mappingHandler[aimpMessage.URI]) {
		this.mappingHandler[aimpMessage.URI] = this.requestCallbackReducer(requestCallback);
	}

	if(graphObjectsList.length <= this.PAYLOAD_LIMIT) {
		return this.HALEY_API.sendMessageWithRequestCallback(haleySession, aimpMessage, graphObjectsList, callback, this.mappingHandler[aimpMessage.URI]);
	}

	return this.splitLargePayloadAndSendMessageWithRequestCallback(haleySession, aimpMessage, graphObjectsList, callback, requestCallback);

}


/**
 * Wrapped the requestCallback with some closures.  
 * @param  function requestCallback 
 * @return function function return will replace the original requestCallback, and call the orginal callback after all the partial message received.
 */
HaleyWrappedAPI.prototype.requestCallbackReducer = function(requestCallback) {

	var rRL = vitaljs.resultList();
	var messageMap = null;  // will be initial as an array, use for checking whether a partial message received or not.

	return function(msgRL) {
		var msg = msgRL.first();

		if(!msg.get('partialResult')) {

			return requestCallback(msgRL);

		} else {

			var total = msg.get('partialResultTotalMessageCount') || 1;
			var count = msg.get('partialResultMessageCount') || 1;

			console.log('partialResultMessageCount: ' + count + ' received');

			if(!messageMap) {
				messageMap = new Array(Number(total)).fill(false);
			}

			messageMap[count-1] = true;

			msgRL.iterator().forEach( function(element, index) {
				rRL.addResult(element);
			});

			for(var i = 0; i < total; i++) {
				if(!messageMap[i]) {
					return ;
				}
			}

			console.log('All Partial Messages Received');

			return requestCallback(rRL);

		}

	}
}


/**
 * split payload objects into several groups with each group has the length smaller than the PAYLOAD_LIMIT set on this panel.
 * Send requests to the server and combined all the message return. If error on either of the message sent, then call callback.
 * if no error message received, and all the requests replied with an 'ok' status, call the requestCallback.
 * @param  object  haleySession
 * @param  object  aimpMessage
 * @param  array   graphObjectsList large Payload array which will be splited.
 * @param  function callback        will be called if error message receive on one of the requested sent.
 * @param  funciotn  requestCallback  will be called if all message sent successfully
 * @return {[type]}  true;
 */
HaleyWrappedAPI.prototype.splitLargePayloadAndSendMessageWithRequestCallback = function(haleySession, aimpMessage, graphObjectsList, callback, requestCallback) {

	var numberOfGroups = Math.ceil(graphObjectsList.length / this.PAYLOAD_LIMIT);  // calculate number of request is going to call.
	var isErrorCallbackCalled = false;  // record whether there is an error when making request. setting to true whenever error happend.
	var returnMsgRL = null;  // the first returning message receivec.
	var requestURI = null;   // this value will set to all the request message, so that the server will have the identifier to check the belonging of a partial.

	var mapPartialRecieved = Array.apply(false, Array(Number(numberOfGroups)));    

	// Error handler for splited request. record errorMessage Received and call callback.
	var onError = function(error) {
		if(error) {
			isErrorCallbackCalled = true;
			callback(error);
		}
	}

	// Message Handler when a message is successfully send. keep recording which request is this message return. parameter i is the identifier of the request.
	var onSuccess = function(i) {

		return function(msgRL) {
			if(!returnMsgRL) {
				returnMsgRL = msgRL;
			}

			if(isErrorCallbackCalled) {
				return false;
			}

			mapPartialRecieved[i] = true;

			for(var j = 0; j < numberOfGroups; j++) {
				if(!mapPartialRecieved[j]) {
					return false;
				}
			}

			console.log('All the Partial Message Send Successfully');

			return requestCallback(returnMsgRL);
		}
	}

	// split the graphList. and send request.
	for(var i = 0; i < numberOfGroups; i++) {
		var end = i === numberOfGroups - 1? graphObjectsList.length: (i+1) * this.PAYLOAD_LIMIT;
		var payload = graphObjectsList.slice(i * this.PAYLOAD_LIMIT, end);
		
		var msg = CommonHelperFunction.cloneVitalObject(aimpMessage);
		msg.URI = CommonHelperFunction.createVitalObject(aimpMessage.type).URI;

		requestURI = i === 0? msg.URI: requestURI;
		msg.set('partialResultTotalMessageCount', numberOfGroups);
		msg.set('partialResultMessageCount', i+1);
		msg.set('partialResultTotalPayloadCount', graphObjectsList.length)
		msg.set('partialResultPayloadCount', payload.length);
		msg.set('partialResult', true);
		msg.set('requestURI', requestURI);
		console.log("PARTIAL MESSAGE COUNT: " + i.toString() + " SENT");

		this.HALEY_API.sendMessageWithRequestCallback(haleySession, msg, payload, onError, onSuccess(i));

	}

	return true;

}


HaleyWrappedAPI.prototype.unauthenticateSession = function(haleySession, callback) {
	this.HALEY_API.unauthenticateSession(haleySession, callback);
}


/**
 * Adds reconnect listener that gets notified on reconnect event.
 * @return true if new listener, false if already registered.
 */
HaleyWrappedAPI.prototype.addReconnectListener = function(reconnectListener) {
	return this.HALEY_API.addReconnectListener(reconnectListener);
}

/**
 * Removes reconnect listener.
 * @return true if listener found, false otherwise.
 */
HaleyWrappedAPI.prototype.removeReconnectListener = function(reconnectListener) {
	return this.HALEY_API.removeReconnectListener(reconnectListener);
}


/**
 * callback called with String error, List<DomainModel>
 */
HaleyWrappedAPI.prototype.listServerDomainModels = function(callback) {
	return this.HALEY_API.listServerDomainModels(callback);
}

/**
 * callback called with String error
 */
HaleyWrappedAPI.prototype.validateDomainModels = function(failIfListElementsDifferent, callback) {
	
	var _this = this.HALEY_API;
	
	this.HALEY_API.listServerDomainModels(function(error, models){
		
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
			_this.logger.error(e);
			callback("Internal error: " + e);
		}
		
	});
	
}

/**
 * Takes care of file upload in response to a File Question
 * @param haleySession
 * @param fileQuestionMessage [QuestionMessage, FileQuestion]
 * @param fileObject, an object 
 * 	{ 
 * 		file: <from file inputfile>,
 * 		accountURIs: <list of additional accountsURIs to be added to file node>,
 *      fileNodeClass: optional fileNodeClass, default: 'http://vital.ai/ontology/vital#FileNode',
 *      parentNodeURI: optional parent of the filenode, defaults to accountURI,
 *      progressListener: optional progress listener that is called with (loaded, total) bytes
 *  }
 *  selected in some form
 * @param callback (error, fileNode)
 */
HaleyWrappedAPI.prototype.uploadFileInBrowser = function(haleySession, fileQuestionMessage, fileObject, callback) {
	this.HALEY_API.uploadFileInBrowser(haleySession, fileQuestionMessage, fileObject, callback);
}

/**
 * Takes care of file upload in response to a File Question in cordova
 * @param haleySession
 * @param fileQuestionMessage [QuestionMessage, FileQuestion]
 * @param fileObject, an object 
 * 	{ 
 * 		file: <from file inputfile>,
 * 		accountURIs: <list of additional accountsURIs to be added to file node>,
 *      fileNodeClass: optional fileNodeClass, default: 'http://vital.ai/ontology/vital#FileNode',
 *      parentNodeURI: optional parent of the filenode, defaults to accountURI,
 *      progressListener: optional progress listener that is called with (loaded, total) bytes
 *  }
 *  selected in some form
 * @param callback (error, fileNode)
 */
HaleyWrappedAPI.prototype.uploadFileInCordova = function(haleySession, fileQuestionMessage, fileObject, callback) {
	this.HALEY_API.uploadFileInCordova(haleySession, fileQuestionMessage, fileObject, callback);
}

/**
 * Uploads file in non-browser (nodejs) environment in response to a File Question
 * @param haleySession
 * @param fileQuestionMessage [QuestionMessage, FileQuestion]
 * @param fileObject, an object 
 * 	{ 
 * 		filePath: pathToLocalFile,
 * 		accountURIs: <list of additional accountsURIs to be added to file node>,
 *      fileNodeClass: optional fileNodeClass, default: 'http://vital.ai/ontology/vital#FileNode',
 *      parentNodeURI: optional parent of the filenode, defaults to accountURI
 *  }
 *  selected in some form
 * @param callback (error, fileNode)
 */
HaleyWrappedAPI.prototype.uploadFile = function(haleySession, fileQuestionMessage, fileObject, callback) {
	this.HALEY_API.uploadFile(haleySession, fileQuestionMessage, fileObject, callback);
}

/**
 * Cancels a spawned file upload
 * @param haleySession
 * @param fileQuestionMessage
 * @param callback
 */
HaleyWrappedAPI.prototype.cancelFileUpload = function(haleySession, fileQuestionMessage, callback) {
	this.HALEY_API.cancelFileUpload(haleySession, fileQuestionMessage, callback);
}


/**
 * Returns the download URL for given file node. Private URLs contain sessionID.
 */
HaleyWrappedAPI.prototype.getFileNodeDownloadURL = function(haleySession, fileNode) {
	return this.HALEY_API.getFileNodeDownloadURL(haleySession, fileNode);
}

/**
 * Returns the download URL for given file node URI
 */
HaleyWrappedAPI.prototype.getFileNodeURIDownloadURL = function(haleySession, fileNodeURI) {
	return this.HALEY_API.getFileNodeURIDownloadURL(haleySession, fileNodeURI);
}


/**
 * add a listener notified with (error, haleySession, aimpMessage, payload)
 * returns true if added, false if already added
 */
HaleyWrappedAPI.prototype.addAIMPMessageSentListener = function(listener) {
	return this.HALEY_API.addAIMPMessageSentListener(listener);
}

/**
 * remove an AIMP message sent listener
 * returns true if removed, false if was not added 
 */
HaleyWrappedAPI.prototype.removeAIMPMessageSentListener = function(listener) {
	return this.HALEY_API.removeAIMPMessageSentListener(listener);
} 


/**
 * False by default. When enabled the client attempts to re-authenticate if current session was expired/not found.
 */
HaleyWrappedAPI.prototype.setCredentialsCacheEnabled = function(enabled) {
	this.HALEY_API.credentialsCacheEnabled = enabled;
}

HaleyWrappedAPI.prototype.isCredentialsCacheEnabled = function() {
	return this.HALEY_API.credentialsCacheEnabled;
}

//nodejs specific
if(typeof(module) !== 'undefined') {
//	module.exports = {
//		HaleySession: HaleySession,
//		HaleyWrappedAPI: HaleyWrappedAPI
//	}; 
	module.exports = HaleyWrappedAPI;
}