var deferred = require('deferred');
var queue = require('deferred-queue');
var extend = require('extend');

var procrastinate = function(customOptions) {
	this.options = {
		'events': {} // key = event name, value = concurrency
	};
	extend(true, this.options, customOptions);

	this.listeners = {};
	Object.keys(this.options.events).map(function(event) {
		this.listeners[event] = [];
	}.bind(this));

	this._queue = queue();
	this._doingPromise = null;
	this._laterTimer;
	this._laterEnqueue = false;
	this._shouldAbort = false;
};

procrastinate.prototype._triggerEvent = function(event, args) {
	return deferred.map(this.listeners[event], deferred.gate(function(listener) {
		return listener.apply(this, args);
	}.bind(this), this.options.events[event]));
};

procrastinate.prototype.doLater = function(delay, enqueue) {
	clearTimeout(this._laterTimer);
	this._laterEnqueue = enqueue;
	this._laterTimer = setTimeout(function() {
		this.doNow(enqueue);
	}.bind(this), delay);
};

procrastinate.prototype._do = function() {
	var d = deferred();

	var task = function(cb) {
		this._doingPromise = d.promise;
		deferred.map(Object.keys(this.listeners), deferred.gate(function(event) {
			return !this._shouldAbort && this._triggerEvent(event);
		}.bind(this), 1))
		.done(function(result) {
			d.resolve(result);
			this._doingPromise = null;
			this._shouldAbort = false;
			cb(null);
		}.bind(this));
	}.bind(this);

	this._queue.push(task);
	return d.promise;
};

procrastinate.prototype.doNow = function(enqueue) {
	enqueue = enqueue === undefined ? true : enqueue;

	if(!this._laterEnqueue) clearTimeout(this._laterTimer);

	if(this.isDoing && !enqueue) return deferred(1);
	return this._do();
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

procrastinate.prototype.abort = function() {
	if(this.isDoing()) this._shouldAbort = true;
};

module.exports = procrastinate;