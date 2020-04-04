
const HaleyAPIVitalServiceImpl = require('./haley-js-vitalservice-implementation-0.0.1');

/**
 * Extends haley api implementation with vital
 * @param vitalService
 * @returns
 */
HaleyAPIMockVitalServiceImpl = function(vitalService) {
	if(vitalService.impl.callFunctionHandlers == null) {
		throw "expected mock vitalservice in order to register handlers!";
	}
	HaleyAPIVitalServiceImpl.call(this, vitalService);
	
	this.sendHandlers = {};
	
	var _this = this; 
	var sendHandler = function(){}
	
	vitalService.impl.callFunctionHandlers['haley-send-message'] =  function(params){
		return _this.onMessageSent(params.message);
	}
	vitalService.impl.callFunctionHandlers['haley-send-message-anonymous'] =  function(params){
		return _this.onMessageSent(params.message);
	}

	mockAccount = vitaljs.graphObject({type: 'http://vital.ai/ontology/haley#HaleyAccount', URI: 'mock-account-1'});
	mockAccount.set('name', "Mock Account");
	mockLogin = vitaljs.graphObject({type: 'http://vital.ai/ontology/vital#Login', URI: 'mock:login-1'});
	mockLogin.set('username', "mockuser");
	mockLogin.set('name', 'Mock User');
	mockLogin.set('roleURIs', ['role:ai.haley.role.access.webapp']);
	vitalService.impl.appSessionID = 'Login_' + new Date().getTime();
	vitalService.impl.login = mockLogin;
	vitalService.impl.mockLogin = mockLogin;

	vitalService.impl.callFunctionHandlers['account.get'] = function(){
		var rl = vitaljs.resultList();
		rl.addResult(mockAccount);
		return rl;
	};
	
	const handlers = require('../../../../../haley-service-mock/index');
	handlers.map(item => { 
		this.registerSendMessageHandler(item.id, item.handler)
	});
	
}

HaleyAPIMockVitalServiceImpl.prototype = Object.create(HaleyAPIVitalServiceImpl.prototype);

if(typeof(module) !== 'undefined') {
	module.exports = HaleyAPIMockVitalServiceImpl;
}

HaleyAPIMockVitalServiceImpl.prototype.scheduleSend = function(msgRL) {
	var _this = this;
	//default 10ms
	var timeout = msgRL.timeout != null ? msgRL.timeout : 10;
	setTimeout(function(){
		_this._streamHandler(msgRL);
	}, timeout);
}

HaleyAPIMockVitalServiceImpl.prototype.onMessageSent = function(msgRL){
	
	var _this = this;
	
	var keys = Object.keys(this.sendHandlers);
	
	var srcMsg = msgRL.first();
	
	var c = 0;
	
	for(var i = 0 ; i < keys.length; i++) {
		var key = keys[i];
		var res = this.sendHandlers[key](msgRL);
		if(res != null) {
			if(res._type == 'ai.vital.vitalservice.query.ResultList') {
				var resMsg = res.first();
				if( resMsg.get('requestURI') == null ) {
					resMsg.set('requestURI', srcMsg.URI);
				}
				c++;
				
				this.scheduleSend(res);
				
			} else {
				c += res.length;
				for(var j = 0; j < res.length; j++) {
					var resX = res[j];
					var resMsg = resX.first();
					if( resMsg.get('requestURI') == null ) {
						resMsg.set('requestURI', srcMsg.URI);
					}
					
					this.scheduleSend(resX);
					
				}
				
			}
		}
	}
	
	if(c == 0) {
		console.warn("No mocked responses sent for " + msgRL.first().type, msgRL);
	} else {
		console.info("Sent " + c + " responses for " + msgRL.first().type, msgRL);
	}
	
	
	var rl = vitaljs.resultList();
	rl.addResult(msgRL.first());
	
	return rl;
}

/**
 * Registers handler with given id
 * @param id handler ID
 * @param handlerFunction function that is called with msgRL and should return either a single or a list of messages to receive.
 * Each message can specify optional timeout after which it's sent. No timeout or <= 0 sends immediately
 * @return true if registered, false otherwise
 */
HaleyAPIMockVitalServiceImpl.prototype.registerSendMessageHandler = function(id, handlerFunction) {
	if(!(typeof(id) === 'string')) throw "id has to be a string: " + typeof(id);
	if(!(typeof(handlerFunction) === 'function')) throw "handlerFunction has to be a function: " + typeof(handlerFunction);
	if( this.sendHandlers[id] != null ) {
		console.warn("handler already registered: " + id);
		return false;
	}
	this.sendHandlers[id] = handlerFunction;
}

HaleyAPIMockVitalServiceImpl.prototype.deregisterSendMessageHandler = function(id) {
	if( this.sendHandlers[id] != null ) {
		delete this.sendHandlers[id];
		return true;
	}
	return false;
}