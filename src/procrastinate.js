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
		'doing' : [],
		'afterDo' : []
	};

	this._doingPromise = null;
	this._laterTimer;
};

procrastinate.prototype._triggerEvent = function(event, args) {
	return deferred.map(this.listeners[event], deferred.gate(function(listener) {
		return listener.apply(this, args);
	}.bind(this), this.options.maxConcurrency[event]));
};

procrastinate.prototype.doLater = function(delay, enqueue) {
	clearTimeout(this._laterTimer);
	this._laterTimer = setTimeout(function() {
		this.doNow(enqueue);
	}.bind(this), delay);
};

procrastinate.prototype.doNow = function(enqueue) {
	enqueue = enqueue === undefined ? true : enqueue;
	var d = deferred();

	if(this.isDoing()) {
		if(!enqueue) return deferred(1);
		this._doingPromise(function() {
			// console.log("Enqueued run.")
			return this.doNow();
		});
	}
	else {
		this._doingPromise = d.promise;
	}

	deferred.map(Object.keys(this.listeners), deferred.gate(function(event) {
		return this._triggerEvent(event);
	}.bind(this), 1)).then(function() {
		this._doingPromise = null;
		d.resolve();
	}.bind(this));

	return d.promise;
};

procrastinate.prototype.on = function(event, listener) {
	this.listeners[event].push(listener);
};

procrastinate.prototype.isDoing = function() {
	return !!this._doingPromise;
};
procrastinate.prototype.getDoing = function() {
	return this._doingPromise || deferred(1);
};

module.exports = procrastinate;