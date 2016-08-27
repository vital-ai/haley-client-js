var USERNAME = 'xxx';
var PASSWORD = 'xxx';


$(function(){
	
	$('#do-test').click(startTest);
	
});

var haleyAPI = null;

var thisSession = null;

function handleError(error) {
	if(error) {
		console.error(error);
		alert(error);
		return;
	}
}
function startTest() {
	
	console.log('Starting test, first start the service');
	
	VITAL_LOGGING = true

	var APP_ID = 'haley';

	//with auth
	var ENDPOINT = 'endpoint.' + APP_ID;
	
	var evenbusPrefix = '';
	
	var EVENTBUS_URL = window.location.protocol + '//' + window.location.hostname + ':' + window.location.port + evenbusPrefix +'/eventbus';
	
	
	
	var _vitalservice = new VitalService(ENDPOINT, EVENTBUS_URL, function(){
		
		console.log('connected to endpoint, sessionID: ' + _vitalservice.impl.sessionID);
		
		var impl = new HaleyAPIVitalServiceImpl(_vitalservice);
		
		new HaleyAPI(impl, false, function(error, instance){
			
			if(handleError(error)) return;
			
			haleyAPI = instance;
			
			console.log("haley api ready for action");

			onHaleyAPIReady();
			
		});
		
	}, function(error){
		
		alert('couldn\'t connect to endpoint -' + error);
		
	});
	
	
}

function printSession(haleySession) {
	
	var auth = haleySession.isAuthenticated();
	
	var s = 'ID: ' + haleySession.getSessionID() + ' authenticated ? ' + auth + ' ';
	
	if(auth) {
		s += " auth session id: " + haleySession.getAuthSessionID() + " account: " + haleySession.getAuthAccount().get('username');
	}
	
	return s;
	
}

function onHaleyAPIReady() {
	
	console.log("current sessions: ", haleyAPI.getSessions());
	
	haleyAPI.openSession(function(error, haleySession){
		if(handleError(error)) return;
		
		console.log("session opened", printSession(haleySession));
	
		thisSession = haleySession;
		
		onSessionOpened();
	});
	
}

function onSessionOpened() {
	
	if(thisSession.isAuthenticated()) {
		
		console.log('already authenticated, unauth it now');
		
		haleyAPI.unauthenticateSession(thisSession, function(error){
			
			if(handleError(error)) return;
			
			onSessionOpenedAndTested();
			
		});
		
	} else {
		onSessionOpenedAndTested();
	}
}

var h1 = function(msgX){
	console.log("#1 GOT MSG " + msgX.first().type);
};

var h2 = function(msgX){
	console.log("#2 GOT MSG " + msgX.first().type);
};

function onSessionOpenedAndTested() {
	
	haleyAPI.authenticateSession(thisSession, USERNAME, PASSWORD, function(error, user){
		
		if(handleError(error)) return;
		
		console.log("auth success", user);
		console.log("session after auth", printSession(thisSession));
		
		console.log("registering handlers");
		
		if( ! haleyAPI.registerCallback(thisSession, 'http://vital.ai/ontology/vital-aimp#HaleyMessage', true, h1) ) alert("Error, should register");
		
		if( haleyAPI.registerCallback(thisSession, 'http://vital.ai/ontology/vital-aimp#HaleyMessage', true, h1) ) alert("Shouldn't register twice!");
		
		if( ! haleyAPI.registerCallback(thisSession, ['http://vital.ai/ontology/vital-aimp#HaleyArticleMessage', 'http://vital.ai/ontology/vital-aimp#HaleyStatusMessage'], false, h2) ) alert("Error, should register");
		
		haleyAPI.registerDefaultCallback(thisSession, function(msgX){
			
			console.log("DEFAULT CALLBACK GOT " + msgX.first().type);
			
		});
		
		
		console.log("current handlers list", haleyAPI.listCallbacks(thisSession));
		
		listChannels();
		
	});

	
}


function listChannels() {
	
	haleyAPI.listChannels(thisSession, function(error, channelsRL){
		
		if(handleError(error)) return;
		
		console.log('channels response: ', channelsRL);
		
		var channels = channelsRL.iterator('http://vital.ai/ontology/vital-aimp#Channel');
		
		if(channels.length < 1) {
			handleError("Channels list is empty");
			return;
		}
		
		console.log("channels list", channels);
		
		doSendTextMessage();
		
	});
	
}

function doSendTextMessage() {

	//send something now
	var aimpMessage = vitaljs.graphObject({type: 'http://vital.ai/ontology/vital-aimp#UserTextMessage'});
	aimpMessage.URI = 'urn:1';
	aimpMessage.set('text', 'hello');
	haleyAPI.sendMessage(thisSession, aimpMessage, [], function(error){
		if(handleError(error)) return;
		
		console.log('msg sent');
		
		setTimeout(function(){
			
			onMessageSent();
			
		}, 1000);
		
		
	});
	
}

function onMessageSent() {
	
	
	if( haleyAPI.deregisterCallback(thisSession, h1) == false) alert("Should deregister");
	if( haleyAPI.deregisterCallback(thisSession, h1) == true) alert("Shouldn't deregister - already deregistered");
	
	console.log("now the default handler should take over the message");
	
	//send something now
	var aimpMessage = vitaljs.graphObject({type: 'http://vital.ai/ontology/vital-aimp#UserTextMessage'});
	aimpMessage.URI = 'urn:2';
	aimpMessage.set('text', 'hello');
	haleyAPI.sendMessage(thisSession, aimpMessage, [], function(error){
		if(handleError(error)) return;
		
		console.log('msg 2 sent');
		
		setTimeout(function(){
			
			testRequestCallback();
			
		}, 1000);
		
		
	});

	
}

function requestCallback(msgX) {
	console.log("REQUEST CALLBACK GOT MSG " + msgX.first().type);
}

function testRequestCallback() {
	
	
	console.log("testing request callback");
	
	//send something now
	var aimpMessage = vitaljs.graphObject({type: 'http://vital.ai/ontology/vital-aimp#UserTextMessage'});
	aimpMessage.URI = 'urn:3';
	aimpMessage.set('text', 'hello');
	haleyAPI.sendMessageWithRequestCallback(thisSession, aimpMessage, [], function(error){
		if(handleError(error)) return;
		
		console.log('msg 3 sent');
		
		setTimeout(function(){
			
			closeSession();
			
		}, 1000);
		
		
	}, requestCallback);
	
}

function closeSession() {
	
	haleyAPI.closeSession(thisSession, function(error){
		
		if(handleError(error));
		
		console.log('session closed');
		
		console.log('current sessions:', haleyAPI.getSessions());
		
	});
	
}




