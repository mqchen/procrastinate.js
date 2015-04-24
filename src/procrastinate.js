var deferred = require('deferred');

var procrastinate = function() {
	this.options = {
		'maxConcurrency': {
			'beforeDo' : 1,
			'afterDo' : 1,
			'doing' : 1
		}
	};

	this.listeners = {
		'beforeDo' : [],
		'afterDo' : [],
		'doing' : []
	};

	this.laterTimer;
};

procrastinate.prototype._triggerEvent = function(event, args) {
	return deferred.map(this.listeners[event], deferred.gate(function(listener) {
		// if(!deferred.isPromise(listener)) { // « Does not even work on promises from the library!
		if(listener.hasOwnProperty('then')) {
			listener = function(args) {
				listener.apply(this, args);
				return deferred(1).promise;
			}.bind(this);
		}
		return listener.apply(this, args);
	}.bind(this), this.options.maxConcurrency[event]));
};

procrastinate.prototype.doLater = function(delay) {
	clearTimeout(this.laterTimer);
	this.laterTimer = setTimeout(function() {
		this.doNow();
	}.bind(this), delay);
};

procrastinate.prototype.doNow = function() {
	return deferred.map(['beforeDo', 'doing', 'afterDo'], deferred.gate(function(event) {
		return this._triggerEvent(event);
	}.bind(this), 1));
};

procrastinate.prototype.on = function(event, listener) {
	this.listeners[event].push(listener);
};

module.exports = procrastinate;