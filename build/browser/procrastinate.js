(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
},{"deferred":27,"deferred-queue":2,"extend":84}],2:[function(require,module,exports){
"use strict";

var events = require ("events");
var util = require ("util");

module.exports = function (){
	return new DeferredQueue ();
};

var EMPTY = 0;
var PAUSED = 1;
var EXECUTING = 2;
var ERROR = 3;

var DeferredQueue = function (){
	events.EventEmitter.call (this);
	this._tasks = [];
	this._state = EMPTY;
};

util.inherits (DeferredQueue, events.EventEmitter);

DeferredQueue.prototype._execute = function (){
	if (this._state !== EXECUTING) return;
	
	if (!this._tasks.length){
		this._state = EMPTY;
		return;
	}
	
	this._preventDefault = false;
	var e = this._tasks.shift ();
	
	if (e.task.length){
		var me = this;
		e.task.call (this, function (error){
			if (error){
				me._state = ERROR;
				if (e.cb) e.cb.call (me, error);
				if (!me._preventDefault){
					me.emit ("error", error);
				}
			}else{
				if (e.cb) e.cb.apply (me, arguments);
				me._execute ();
			}
		});
	}else{
		try{
			var v = e.task.call (this);
		}catch (error){
			this._state = ERROR;
			if (e.cb) e.cb.call (this, error);
			if (!this._preventDefault){
				this.emit ("error", error);
			}
		}
		
		if (this._state === ERROR) return;
		
		if (e.cb) e.cb.call (this, null, v);
		//The queue is always empty at this point except when it is paused and new
		//tasks are pushed
		this._execute ();
	}
};

DeferredQueue.prototype.pause = function (){
	this._state = PAUSED;
};

DeferredQueue.prototype.pending = function (){
	return this._tasks.length;
};

DeferredQueue.prototype.preventDefault = function (){
	this._preventDefault = true;
};

DeferredQueue.prototype.push = function (task, cb){
	if (this._state === ERROR) return;
	this._tasks.push ({ task: task, cb: cb });
	//If the queue is paused the push auto-executes it again
	if (this._state === EMPTY){
		this._state = EXECUTING;
		this._execute ();
	}
	return this;
};

DeferredQueue.prototype.resume = function (){
	if (this._state === PAUSED){
		this._state = EXECUTING;
		this._execute ();
	}
};

DeferredQueue.prototype.unshift = function (task, cb){
	if (this._state === ERROR) return;
	this._tasks.unshift ({ task: task, cb: cb });
	//If the queue is paused the unshift auto-executes it again
	if (this._state === EMPTY){
		this._state = EXECUTING;
		this._execute ();
	}
	return this;
};
},{"events":85,"util":89}],3:[function(require,module,exports){
'use strict';

var callable   = require('es5-ext/object/valid-callable')
  , d          = require('d')
  , isCallable = require('es5-ext/object/is-callable')
  , ee         = require('event-emitter')
  , isPromise  = require('./is-promise')

  , create = Object.create, defineProperty = Object.defineProperty
  , deferred, resolve, reject;

module.exports = exports = function (name, unres, onres, res) {
	name = String(name);
	(callable(res) && ((onres == null) || callable(onres)) && callable(unres));
	defineProperty(exports._unresolved, name, d(unres));
	exports._onresolve[name] = onres;
	defineProperty(exports._resolved, name, d(res));
	exports._names.push(name);
};

exports._names = ['done', 'then', 'valueOf'];

exports._unresolved = ee(create(Function.prototype, {
	then: d(function (win, fail) {
		var def;
		if (!this.pending) this.pending = [];
		def = deferred();
		this.pending.push('then', [win, fail, def.resolve, def.reject]);
		return def.promise;
	}),
	done: d(function (win, fail) {
		((win == null) || callable(win));
		((fail == null) || callable(fail));
		if (!this.pending) this.pending = [];
		this.pending.push('done', arguments);
	}),
	resolved: d(false),
	returnsPromise: d(true),
	valueOf: d(function () { return this; })
}));

exports._onresolve = {
	then: function (win, fail, resolve, reject) {
		var value, cb = this.failed ? fail : win;
		if (cb == null) {
			if (this.failed) reject(this.value);
			else resolve(this.value);
			return;
		}
		if (isCallable(cb)) {
			if (isPromise(cb)) {
				if (cb.resolved) {
					if (cb.failed) reject(cb.value);
					else resolve(cb.value);
					return;
				}
				cb.done(resolve, reject);
				return;
			}
			try { value = cb(this.value); } catch (e) {
				reject(e);
				return;
			}
			resolve(value);
			return;
		}
		resolve(cb);
	},
	done: function (win, fail) {
		if (this.failed) {
			if (fail) {
				fail(this.value);
				return;
			}
			throw this.value;
		}
		if (win) win(this.value);
	}
};

exports._resolved = ee(create(Function.prototype, {
	then: d(function (win, fail) {
		var value, cb = this.failed ? fail : win;
		if (cb == null) return this;
		if (isCallable(cb)) {
			if (isPromise(cb)) return cb;
			try { value = cb(this.value); } catch (e) { return reject(e); }
			return resolve(value);
		}
		return resolve(cb);
	}),
	done: d(function (win, fail) {
		((win == null) || callable(win));
		((fail == null) || callable(fail));
		if (this.failed) {
			if (fail) {
				fail(this.value);
				return;
			}
			throw this.value;
		}
		if (win) win(this.value);
	}),
	resolved: d(true),
	returnsPromise: d(true),
	valueOf: d(function () { return this.value; })
}));

deferred = require('./deferred');
resolve = deferred.resolve;
reject = deferred.reject;
deferred.extend = exports;

},{"./deferred":5,"./is-promise":29,"d":31,"es5-ext/object/is-callable":61,"es5-ext/object/valid-callable":68,"event-emitter":79}],4:[function(require,module,exports){
// Assimilate eventual foreign promise

'use strict';

var isObject  = require('es5-ext/object/is-object')
  , isPromise = require('./is-promise')
  , deferred  = require('./deferred')
  , nextTick  = require('next-tick')

  , getPrototypeOf = Object.getPrototypeOf;

module.exports = function self(value) {
	var then, done, def, resolve, reject;
	if (!value) return value;
	try {
		then = value.then;
	} catch (e) {
		return value;
	}
	if (typeof then !== 'function') return value;
	if (isPromise(value)) return value;
	if (!isObject(value)) return value;
	if (!getPrototypeOf(value)) return value;
	try {
		done = value.done;
	} catch (ignore) {}
	def = deferred();
	resolve = function (value) { def.resolve(self(value)); };
	reject = function (value) { def.reject(value); };
	if (typeof done === 'function') {
		try {
			done.call(value, resolve, reject);
		} catch (e) {
			return def.reject(e);
		}
		return def.promise;
	}
	try {
		then.call(value, function (value) { nextTick(function () {
			resolve(value);
		}); }, function (value) { nextTick(function () {
			reject(value);
		}); });
	} catch (e) {
		return def.reject(e);
	}
	return def.promise;
};

},{"./deferred":5,"./is-promise":29,"es5-ext/object/is-object":62,"next-tick":81}],5:[function(require,module,exports){
// Returns function that returns deferred or promise object.
//
// 1. If invoked without arguments then deferred object is returned
//    Deferred object consist of promise (unresolved) function and resolve
//    function through which we resolve promise
// 2. If invoked with one argument then promise is returned which resolved value
//    is given argument. Argument may be any value (even undefined),
//    if it's promise then same promise is returned
// 3. If invoked with more than one arguments then promise that resolves with
//    array of all resolved arguments is returned.

'use strict';

var isError    = require('es5-ext/error/is-error')
  , noop       = require('es5-ext/function/noop')
  , isPromise  = require('./is-promise')

  , every = Array.prototype.every, push = Array.prototype.push

  , Deferred, createDeferred, count = 0, timeout, extendShim, ext
  , protoSupported = Boolean(isPromise.__proto__)
  , resolve, assimilate;

extendShim = function (promise) {
	ext._names.forEach(function (name) {
		promise[name] = function () {
			return promise.__proto__[name].apply(promise, arguments);
		};
	});
	promise.returnsPromise = true;
	promise.resolved = promise.__proto__.resolved;
};

resolve = function (value, failed) {
	var promise = function (win, fail) { return promise.then(win, fail); };
	promise.value = value;
	promise.failed = failed;
	promise.__proto__ = ext._resolved;
	if (!protoSupported) { extendShim(promise); }
	if (createDeferred._profile) createDeferred._profile(true);
	return promise;
};

Deferred = function () {
	var promise = function (win, fail) { return promise.then(win, fail); };
	if (!count) timeout = setTimeout(noop, 1e9);
	++count;
	if (createDeferred._monitor) promise.monitor = createDeferred._monitor();
	promise.__proto__ = ext._unresolved;
	if (!protoSupported) extendShim(promise);
	(createDeferred._profile && createDeferred._profile());
	this.promise = promise;
	this.resolve = this.resolve.bind(this);
	this.reject = this.reject.bind(this);
};

Deferred.prototype = {
	resolved: false,
	_settle: function (value) {
		var i, name, data;
		this.promise.value = value;
		this.promise.__proto__ = ext._resolved;
		if (!protoSupported) this.promise.resolved = true;
		if (this.promise.dependencies) {
			this.promise.dependencies.forEach(function self(dPromise) {
				dPromise.value = value;
				dPromise.failed = this.failed;
				dPromise.__proto__ = ext._resolved;
				if (!protoSupported) dPromise.resolved = true;
				delete dPromise.pending;
				if (dPromise.dependencies) {
					dPromise.dependencies.forEach(self, this);
					delete dPromise.dependencies;
				}
			}, this.promise);
			delete this.promise.dependencies;
		}
		if ((data = this.promise.pending)) {
			for (i = 0; (name = data[i]); ++i) {
				ext._onresolve[name].apply(this.promise, data[++i]);
			}
			delete this.promise.pending;
		}
		return this.promise;
	},
	resolve: function (value) {
		if (this.resolved) return this.promise;
		this.resolved = true;
		if (!--count) clearTimeout(timeout);
		if (this.promise.monitor) clearTimeout(this.promise.monitor);
		value = assimilate(value);
		if (isPromise(value)) {
			if (!value.resolved) {
				if (!value.dependencies) {
					value.dependencies = [];
				}
				value.dependencies.push(this.promise);
				if (this.promise.pending) {
					if (value.pending) {
						push.apply(value.pending, this.promise.pending);
						this.promise.pending = value.pending;
						if (this.promise.dependencies) {
							this.promise.dependencies.forEach(function self(dPromise) {
								dPromise.pending = value.pending;
								if (dPromise.dependencies) {
									dPromise.dependencies.forEach(self);
								}
							});
						}
					} else {
						value.pending = this.promise.pending;
					}
				} else if (value.pending) {
					this.promise.pending = value.pending;
				} else {
					this.promise.pending = value.pending = [];
				}
				return this.promise;
			}
			this.promise.failed = value.failed;
			value = value.value;
		}
		return this._settle(value);
	},
	reject: function (error) {
		if (this.resolved) return this.promise;
		this.resolved = true;
		if (!--count) clearTimeout(timeout);
		if (this.promise.monitor) clearTimeout(this.promise.monitor);
		this.promise.failed = true;
		return this._settle(error);
	}
};

module.exports = createDeferred = function (value) {
	var l = arguments.length, d, waiting, initialized, result;
	if (!l) return new Deferred();
	if (l > 1) {
		d = new Deferred();
		waiting = 0;
		result = new Array(l);
		every.call(arguments, function (value, index) {
			value = assimilate(value);
			if (!isPromise(value)) {
				result[index] = value;
				return true;
			}
			if (value.resolved) {
				if (value.failed) {
					d.reject(value.value);
					return false;
				}
				result[index] = value.value;
				return true;
			}
			++waiting;
			value.done(function (value) {
				result[index] = value;
				if (!--waiting && initialized) d.resolve(result);
			}, d.reject);
			return true;
		});
		initialized = true;
		if (!waiting) d.resolve(result);
		return d.promise;
	}
	value = assimilate(value);
	if (isPromise(value)) return value;
	return resolve(value, isError(value));
};

createDeferred.Deferred = Deferred;
createDeferred.reject = function (value) { return resolve(value, true); };
createDeferred.resolve = function (value) {
	value = assimilate(value);
	if (isPromise(value)) return value;
	return resolve(value, false);
};
ext = require('./_ext');
assimilate = require('./assimilate');

},{"./_ext":3,"./assimilate":4,"./is-promise":29,"es5-ext/error/is-error":39,"es5-ext/function/noop":45}],6:[function(require,module,exports){
'use strict';

var arrayOf    = require('es5-ext/array/of')
  , deferred   = require('../deferred')
  , isPromise  = require('../is-promise')
  , assimilate = require('../assimilate')

  , push = Array.prototype.push, slice = Array.prototype.slice;

module.exports = function (args, length) {
	var i, l, arg;
	if ((length != null) && (args.length !== length)) {
		args = slice.call(args, 0, length);
		if (args.length < length) {
			push.apply(args, new Array(length - args.length));
		}
	}
	for (i = 0, l = args.length; i < l; ++i) {
		arg = assimilate(args[i]);
		if (isPromise(arg)) {
			if (!arg.resolved) {
				if (l > 1) return deferred.apply(null, args);
				return arg(arrayOf);
			}
			if (arg.failed) return arg;
			args[i] = arg.value;
		}
	}
	return args;
};

},{"../assimilate":4,"../deferred":5,"../is-promise":29,"es5-ext/array/of":35}],7:[function(require,module,exports){
// Promise aware Array's map

'use strict';

var assign     = require('es5-ext/object/assign')
  , value      = require('es5-ext/object/valid-value')
  , callable   = require('es5-ext/object/valid-callable')
  , deferred   = require('../../deferred')
  , isPromise  = require('../../is-promise')
  , assimilate = require('../../assimilate')

  , every = Array.prototype.every
  , call = Function.prototype.call

  , DMap;

DMap = function (list, cb, context) {
	this.list = list;
	this.cb = cb;
	this.context = context;
	this.result = new Array(list.length >>> 0);

	assign(this, deferred());
	every.call(list, this.process, this);
	if (!this.waiting) return this.resolve(this.result);
	this.initialized = true;

	return this.promise;
};

DMap.prototype = {
	waiting: 0,
	initialized: false,
	process: function (value, index) {
		++this.waiting;
		value = assimilate(value);
		if (isPromise(value)) {
			if (!value.resolved) {
				value.done(this.processCb.bind(this, index), this.reject);
				return true;
			}
			if (value.failed) {
				this.reject(value.value);
				return false;
			}
			value = value.value;
		}
		return this.processCb(index, value);
	},
	processCb: function (index, value) {
		if (this.promise.resolved) return false;
		if (this.cb) {
			try {
				value = call.call(this.cb, this.context, value, index, this.list);
			} catch (e) {
				this.reject(e);
				return false;
			}
			value = assimilate(value);
			if (isPromise(value)) {
				if (!value.resolved) {
					value.done(this.processValue.bind(this, index), this.reject);
					return true;
				}
				if (value.failed) {
					this.reject(value.value);
					return false;
				}
				value = value.value;
			}
		}
		this.processValue(index, value);
		return true;
	},
	processValue: function (index, value) {
		if (this.promise.resolved) return;
		this.result[index] = value;
		if (!--this.waiting && this.initialized) this.resolve(this.result);
	}
};

module.exports = function (cb/*, thisArg*/) {
	value(this);
	((cb == null) || callable(cb));

	return new DMap(this, cb, arguments[1]);
};

},{"../../assimilate":4,"../../deferred":5,"../../is-promise":29,"es5-ext/object/assign":57,"es5-ext/object/valid-callable":68,"es5-ext/object/valid-value":70}],8:[function(require,module,exports){
// Promise aware Array's reduce

'use strict';

var assign     = require('es5-ext/object/assign')
  , value      = require('es5-ext/object/valid-value')
  , callable   = require('es5-ext/object/valid-callable')
  , deferred   = require('../../deferred')
  , isPromise  = require('../../is-promise')
  , assimilate = require('../../assimilate')

  , call = Function.prototype.call
  , hasOwnProperty = Object.prototype.hasOwnProperty
  , resolve = deferred.resolve
  , Reduce;

Reduce = function (list, cb, initial, initialized) {
	this.list = list;
	this.cb = cb;
	this.initialized = initialized;
	this.length = list.length >>> 0;

	initial = assimilate(initial);
	if (isPromise(initial)) {
		if (!initial.resolved) {
			assign(this, deferred());
			initial.done(function (initial) {
				this.value = initial;
				this.init();
			}.bind(this), this.reject);
			return this.promise;
		}
		this.value = initial.value;
		if (initial.failed) return initial;
	} else {
		this.value = initial;
	}

	return this.init();
};

Reduce.prototype = {
	current: 0,
	state: false,
	init: function () {
		while (this.current < this.length) {
			if (hasOwnProperty.call(this.list, this.current)) break;
			++this.current;
		}
		if (this.current === this.length) {
			if (!this.initialized) {
				throw new Error("Reduce of empty array with no initial value");
			}
			return this.resolve ? this.resolve(this.value) : resolve(this.value);
		}
		if (!this.promise) assign(this, deferred());
		this.processCb = this.processCb.bind(this);
		this.processValue = this.processValue.bind(this);
		this.continue();
		return this.promise;
	},
	continue: function () {
		var result;
		while (!this.state) {
			result = this.process();
			if (this.state !== 'cb') break;
			result = this.processCb(result);
			if (this.state !== 'value') break;
			this.processValue(result);
		}
	},
	process: function () {
		var value = assimilate(this.list[this.current]);
		if (isPromise(value)) {
			if (!value.resolved) {
				value.done(function (result) {
					result = this.processCb(result);
					if (this.state !== 'value') return;
					this.processValue(result);
					if (!this.state) this.continue();
				}.bind(this), this.reject);
				return;
			}
			if (value.failed) {
				this.reject(value.value);
				return;
			}
			value = value.value;
		}
		this.state = 'cb';
		return value;
	},
	processCb: function (value) {
		if (!this.initialized) {
			this.initialized = true;
			this.state = 'value';
			return value;
		}
		if (this.cb) {
			try {
				value = call.call(this.cb, undefined, this.value, value, this.current,
					this.list);
			} catch (e) {
				this.reject(e);
				return;
			}
			value = assimilate(value);
			if (isPromise(value)) {
				if (!value.resolved) {
					value.done(function (result) {
						this.state = 'value';
						this.processValue(result);
						if (!this.state) this.continue();
					}.bind(this), this.reject);
					return;
				}
				if (value.failed) {
					this.reject(value.value);
					return;
				}
				value = value.value;
			}
		}
		this.state = 'value';
		return value;
	},
	processValue: function (value) {
		this.value = value;
		while (++this.current < this.length) {
			if (hasOwnProperty.call(this.list, this.current)) {
				this.state = false;
				return;
			}
		}
		this.resolve(this.value);
	}
};

module.exports = function (cb/*, initial*/) {
	value(this);
	((cb == null) || callable(cb));

	return new Reduce(this, cb, arguments[1], arguments.length > 1);
};

},{"../../assimilate":4,"../../deferred":5,"../../is-promise":29,"es5-ext/object/assign":57,"es5-ext/object/valid-callable":68,"es5-ext/object/valid-value":70}],9:[function(require,module,exports){
// Promise aware Array's some

'use strict';

var assign     = require('es5-ext/object/assign')
  , value      = require('es5-ext/object/valid-value')
  , callable   = require('es5-ext/object/valid-callable')
  , deferred   = require('../../deferred')
  , isPromise  = require('../../is-promise')
  , assimilate = require('../../assimilate')

  , call = Function.prototype.call
  , resolve = deferred.resolve
  , Some;

Some = function (list, cb, context) {
	this.list = list;
	this.cb = cb;
	this.context = context;
	this.length = list.length >>> 0;

	while (this.current < this.length) {
		if (this.current in list) {
			assign(this, deferred());
			this.processCb = this.processCb.bind(this);
			this.processValue = this.processValue.bind(this);
			this.process();
			return this.promise;
		}
		++this.current;
	}
	return resolve(false);
};

Some.prototype = {
	current: 0,
	process: function () {
		var value = assimilate(this.list[this.current]);
		if (isPromise(value)) {
			if (!value.resolved) {
				value.done(this.processCb, this.reject);
				return;
			}
			if (value.failed) {
				this.reject(value.value);
				return;
			}
			value = value.value;
		}
		this.processCb(value);
	},
	processCb: function (value) {
		if (this.cb) {
			try {
				value = call.call(this.cb, this.context, value, this.current,
					this.list);
			} catch (e) {
				this.reject(e);
				return;
			}
			value = assimilate(value);
			if (isPromise(value)) {
				if (!value.resolved) {
					value.done(this.processValue, this.reject);
					return;
				}
				if (value.failed) {
					this.reject(value.value);
					return;
				}
				value = value.value;
			}
		}
		this.processValue(value);
	},
	processValue: function (value) {
		if (value) {
			this.resolve(true);
			return;
		}
		while (++this.current < this.length) {
			if (this.current in this.list) {
				this.process();
				return;
			}
		}
		this.resolve(false);
	}
};

module.exports = function (cb/*, thisArg*/) {
	value(this);
	((cb == null) || callable(cb));

	return new Some(this, cb, arguments[1]);
};

},{"../../assimilate":4,"../../deferred":5,"../../is-promise":29,"es5-ext/object/assign":57,"es5-ext/object/valid-callable":68,"es5-ext/object/valid-value":70}],10:[function(require,module,exports){
// Call asynchronous function

'use strict';

var toArray          = require('es5-ext/array/to-array')
  , callable         = require('es5-ext/object/valid-callable')
  , deferred         = require('../../deferred')
  , isPromise        = require('../../is-promise')
  , processArguments = require('../_process-arguments')

  , slice = Array.prototype.slice, apply = Function.prototype.apply

  , applyFn, callAsync;

applyFn = function (fn, args, def) {
	args = toArray(args);
	apply.call(fn,  this, args.concat(function (error, result) {
		if (error == null) {
			def.resolve((arguments.length > 2) ? slice.call(arguments, 1) : result);
		} else {
			def.reject(error);
		}
	}));
};

callAsync = function (fn, length, context, args) {
	var def;
	args = processArguments(args, length);
	if (isPromise(args)) {
		if (args.failed) return args;
		def = deferred();
		args.done(function (args) {
			if (fn.returnsPromise) return apply.call(fn, context, args);
			try {
				applyFn.call(context, fn, args, def);
			} catch (e) { def.reject(e); }
		}, def.reject);
		return def.promise;
	}
	if (fn.returnsPromise) return apply.call(fn, context, args);
	def = deferred();
	try {
		applyFn.call(context, fn, args, def);
	} catch (e) {
		def.reject(e);
		throw e;
	}
	return def.promise;
};

module.exports = exports = function (context/*, …args*/) {
	return callAsync(callable(this), null, context, slice.call(arguments, 1));
};

Object.defineProperty(exports, '_base', { configurable: true,
	enumerable: false, writable: true, value: callAsync });

},{"../../deferred":5,"../../is-promise":29,"../_process-arguments":6,"es5-ext/array/to-array":38,"es5-ext/object/valid-callable":68}],11:[function(require,module,exports){
// Delay function execution, return promise for delayed function result

'use strict';

var apply    = Function.prototype.apply
  , callable = require('es5-ext/object/valid-callable')
  , deferred = require('../../deferred')

  , delayed;

delayed = function (fn, args, resolve, reject) {
	var value;
	try {
		value = apply.call(fn, this, args);
	} catch (e) {
		reject(e);
		return;
	}
	resolve(value);
};

module.exports = function (timeout) {
	var fn, result;
	fn = callable(this);
	result = function () {
		var def = deferred();
		setTimeout(delayed.bind(this, fn, arguments, def.resolve, def.reject),
			timeout);
		return def.promise;
	};
	result.returnsPromise = true;
	return result;
};

},{"../../deferred":5,"es5-ext/object/valid-callable":68}],12:[function(require,module,exports){
// Limit number of concurrent function executions (to cLimit number).
// Limited calls are queued. Optionaly maximum queue length can also be
// controlled with qLimit value, any calls that would reach over that limit
// would be discarded (its promise would resolve with "Too many calls" error)

'use strict';

var toPosInt   = require('es5-ext/number/to-pos-integer')
  , callable   = require('es5-ext/object/valid-callable')
  , eeUnify    = require('event-emitter/unify')
  , deferred   = require('../../deferred')
  , isPromise  = require('../../is-promise')
  , assimilate = require('../../assimilate')

  , resolve = deferred.resolve, reject = deferred.reject
  , apply = Function.prototype.apply, max = Math.max
  , gateReject;

require('../promise/finally');

gateReject = function () {
	var e = new Error("Too many calls");
	e.type = 'deferred-gate-rejected';
	return reject(e);
};

module.exports = function (cLimit, qLimit) {
	var fn, count, decrement, unload, queue, run, result;
	fn = callable(this);
	cLimit = max(toPosInt(cLimit), 1);
	qLimit = ((qLimit == null) || isNaN(qLimit)) ? Infinity : toPosInt(qLimit);
	count = 0;
	queue = [];

	run = function (thisArg, args, def) {
		var r;
		try {
			r = apply.call(fn, thisArg, args);
		} catch (e) {
			if (!def) return reject(e);
			def.reject(e);
			unload();
			return;
		}
		r = assimilate(r);
		if (isPromise(r)) {
			if (def) eeUnify(def.promise, r);
			if (!r.resolved) {
				++count;
				if (def) def.resolve(r);
				return r.finally(decrement);
			}
			r = r.value;
		}
		if (!def) return resolve(r);
		def.resolve(r);
		unload();
	};

	decrement = function () {
		--count;
		unload();
	};

	unload = function () {
		var data;
		if ((data = queue.shift())) run.apply(null, data);
	};

	result = function () {
		var def;
		if (count >= cLimit) {
			if (queue.length < qLimit) {
				def = deferred();
				queue.push([this, arguments, def]);
				return def.promise;
			}
			return gateReject();
		}
		return run(this, arguments);
	};
	result.returnsPromise = true;
	return result;
};

},{"../../assimilate":4,"../../deferred":5,"../../is-promise":29,"../promise/finally":19,"es5-ext/number/to-pos-integer":55,"es5-ext/object/valid-callable":68,"event-emitter/unify":80}],13:[function(require,module,exports){
// Promisify synchronous function

'use strict';

var callable         = require('es5-ext/object/valid-callable')
  , deferred         = require('../../deferred')
  , isPromise        = require('../../is-promise')
  , processArguments = require('../_process-arguments')

  , apply = Function.prototype.apply

  , applyFn;

applyFn = function (fn, args, resolve, reject) {
	var value;
	try {
		value = apply.call(fn, this, args);
	} catch (e) {
		reject(e);
		return;
	}
	resolve(value);
};

module.exports = function (length) {
	var fn, result;
	fn = callable(this);
	if (fn.returnsPromise) return fn;
	if (length != null) length = length >>> 0;
	result = function () {
		var args, def;
		args = processArguments(arguments, length);

		if (isPromise(args)) {
			if (args.failed) return args;
			def = deferred();
			args.done(function (args) {
				applyFn.call(this, fn, args, def.resolve, def.reject);
			}.bind(this), def.reject);
		} else {
			def = deferred();
			applyFn.call(this, fn, args, def.resolve, def.reject);
		}

		return def.promise;
	};
	result.returnsPromise = true;
	return result;
};

},{"../../deferred":5,"../../is-promise":29,"../_process-arguments":6,"es5-ext/object/valid-callable":68}],14:[function(require,module,exports){
// Promisify asynchronous function

'use strict';

var callable  = require('es5-ext/object/valid-callable')
  , callAsync = require('./call-async')._base;

module.exports = function (length) {
	var fn, result;
	fn = callable(this);
	if (fn.returnsPromise) return fn;
	if (length != null) length = length >>> 0;
	result = function () { return callAsync(fn, length, this, arguments); };
	result.returnsPromise = true;
	return result;
};

},{"./call-async":10,"es5-ext/object/valid-callable":68}],15:[function(require,module,exports){
// Used by promise extensions that are based on array extensions.

'use strict';

var callable = require('es5-ext/object/valid-callable')
  , deferred = require('../../deferred')

  , reject = deferred.reject;

module.exports = function (name, ext) {
	deferred.extend(name, function (cb) {
		var def;
		((cb == null) || callable(cb));
		if (!this.pending) this.pending = [];
		def = deferred();
		this.pending.push(name, [arguments, def.resolve, def.reject]);
		return def.promise;
	}, function (args, resolve, reject) {
		var result;
		if (this.failed) {
			reject(this.value);
			return;
		}
		try {
			result = ext.apply(this.value, args);
		} catch (e) {
			reject(e);
			return;
		}
		resolve(result);
	}, function (cb) {
		((cb == null) || callable(cb));
		if (this.failed) return this;
		try {
			return ext.apply(this.value, arguments);
		} catch (e) {
			return reject(e);
		}
	});
};

},{"../../deferred":5,"es5-ext/object/valid-callable":68}],16:[function(require,module,exports){
// 'aside' - Promise extension
//
// promise.aside(win, fail)
//
// Works in analogous way as promise function itself (or `then`)
// but instead of adding promise to promise chain it returns context promise and
// lets callback carry on with other processing logic

'use strict';

var callable = require('es5-ext/object/valid-callable')
  , deferred = require('../../deferred');

deferred.extend('aside', function (win, fail) {
	((win == null) || callable(win));
	((fail == null) || callable(fail));
	if (win || fail) {
		if (!this.pending) {
			this.pending = [];
		}
		this.pending.push('aside', arguments);
	}
	return this;
}, function (win, fail) {
	var cb = this.failed ? fail : win;
	if (cb) {
		cb(this.value);
	}
}, function (win, fail) {
	var cb;
	((win == null) || callable(win));
	((fail == null) || callable(fail));
	cb = this.failed ? fail : win;
	if (cb) {
		cb(this.value);
	}
	return this;
});

},{"../../deferred":5,"es5-ext/object/valid-callable":68}],17:[function(require,module,exports){
// 'catch' - Promise extension
//
// promise.catch(cb)
//
// Same as `then` but accepts only onFail callback

'use strict';

var isCallable = require('es5-ext/object/is-callable')
  , validValue = require('es5-ext/object/valid-value')
  , deferred   = require('../../deferred')
  , isPromise  = require('../../is-promise')

  , resolve = deferred.resolve, reject = deferred.reject;

deferred.extend('catch', function (cb) {
	var def;
	validValue(cb);
	if (!this.pending) this.pending = [];
	def = deferred();
	this.pending.push('catch', [cb, def.resolve, def.reject]);
	return def.promise;
}, function (cb, resolve, reject) {
	var value;
	if (!this.failed) {
		resolve(this.value);
		return;
	}
	if (isCallable(cb)) {
		if (isPromise(cb)) {
			if (cb.resolved) {
				if (cb.failed) reject(cb.value);
				else resolve(cb.value);
			} else {
				cb.done(resolve, reject);
			}
			return;
		}
		try { value = cb(this.value); } catch (e) {
			reject(e);
			return;
		}
		resolve(value);
		return;
	}
	resolve(cb);
}, function (cb) {
	var value;
	validValue(cb);
	if (!this.failed) return this;
	if (isCallable(cb)) {
		if (isPromise(cb)) return cb;
		try { value = cb(this.value); } catch (e) {
			return reject(e);
		}
		return resolve(value);
	}
	return resolve(cb);
});

},{"../../deferred":5,"../../is-promise":29,"es5-ext/object/is-callable":61,"es5-ext/object/valid-value":70}],18:[function(require,module,exports){
// 'cb' - Promise extension
//
// promise.cb(cb)
//
// Handles asynchronous function style callback (which is run in next event loop
// the earliest). Returns self promise. Callback is optional.
//
// Useful when we want to configure typical asynchronous function which logic is
// internally configured with promises.
//
// Extension can be used as follows:
//
// var foo = function (arg1, arg2, cb) {
//     var d = deferred();
//     // ... implementation
//     return d.promise.cb(cb);
// };
//
// `cb` extension returns promise and handles eventual callback (optional)

'use strict';

var callable   = require('es5-ext/object/valid-callable')
  , nextTick   = require('next-tick')
  , deferred   = require('../../deferred');

deferred.extend('cb', function (cb) {
	if (cb == null) return this;
	callable(cb);
	nextTick(function () {
		if (this.resolved) {
			if (this.failed) cb(this.value);
			else cb(null, this.value);
		} else {
			if (!this.pending) this.pending = [];
			this.pending.push('cb', [cb]);
		}
	}.bind(this));
	return this;
}, function (cb) {
	if (this.failed) cb(this.value);
	else cb(null, this.value);
}, function (cb) {
	if (cb == null) return this;
	callable(cb);
	nextTick(function () {
		if (this.failed) cb(this.value);
		else cb(null, this.value);
	}.bind(this));
	return this;
});

},{"../../deferred":5,"es5-ext/object/valid-callable":68,"next-tick":81}],19:[function(require,module,exports){
// 'finally' - Promise extension
//
// promise.finally(cb)
//
// Called on promise resolution returns same promise, doesn't pass any values to
// provided callback

'use strict';

var callable = require('es5-ext/object/valid-callable')
  , deferred = require('../../deferred');

deferred.extend('finally', function (cb) {
	callable(cb);
	if (!this.pending) this.pending = [];
	this.pending.push('finally', arguments);
	return this;
}, function (cb) { cb(); }, function (cb) {
	callable(cb)();
	return this;
});

},{"../../deferred":5,"es5-ext/object/valid-callable":68}],20:[function(require,module,exports){
// 'get' - Promise extension
//
// promise.get(name)
//
// Resolves with property of resolved object

'use strict';

var value    = require('es5-ext/object/valid-value')
  , deferred = require('../../deferred')

  , reduce = Array.prototype.reduce
  , resolve = deferred.resolve, reject = deferred.reject;

deferred.extend('get', function (/*…name*/) {
	var def;
	if (!this.pending) this.pending = [];
	def = deferred();
	this.pending.push('get', [arguments, def.resolve, def.reject]);
	return def.promise;

}, function (args, resolve, reject) {
	var result;
	if (this.failed) reject(this.value);
	try {
		result = reduce.call(args, function (obj, key) {
			return value(obj)[String(key)];
		}, this.value);
	} catch (e) {
		reject(e);
		return;
	}
	resolve(result);
}, function (/*…name*/) {
	var result;
	if (this.failed) return this;
	try {
		result = reduce.call(arguments, function (obj, key) {
			return value(obj)[String(key)];
		}, this.value);
	} catch (e) {
		return reject(e);
	}
	return resolve(result);
});

},{"../../deferred":5,"es5-ext/object/valid-value":70}],21:[function(require,module,exports){
// 'invokeAsync' - Promise extension
//
// promise.invokeAsync(name[, arg0[, arg1[, ...]]])
//
// On resolved object calls asynchronous method that takes callback
// (Node.js style).
// Do not pass callback, it's handled by internal implementation.
// 'name' can be method name or method itself.

'use strict';

var toArray          = require('es5-ext/array/to-array')
  , isCallable       = require('es5-ext/object/is-callable')
  , deferred         = require('../../deferred')
  , isPromise        = require('../../is-promise')
  , processArguments = require('../_process-arguments')

  , slice = Array.prototype.slice, apply = Function.prototype.apply
  , reject = deferred.reject

  , applyFn;

applyFn = function (fn, args, resolve, reject) {
	var result;
	if (fn.returnsPromise) {
		try {
			result = apply.call(fn, this, args);
		} catch (e) {
			reject(e);
			return;
		}
		return resolve(result);
	}
	args = toArray(args).concat(function (error, result) {
		if (error == null) {
			resolve((arguments.length > 2) ? slice.call(arguments, 1) : result);
		} else {
			reject(error);
		}
	});
	try {
		apply.call(fn, this, args);
	} catch (e2) {
		reject(e2);
	}
};

deferred.extend('invokeAsync', function (method/*, …args*/) {
	var def;
	if (!this.pending) this.pending = [];
	def = deferred();
	this.pending.push('invokeAsync', [arguments, def.resolve, def.reject]);
	return def.promise;
}, function (args, resolve, reject) {
	var fn;
	if (this.failed) {
		reject(this.value);
		return;
	}

	if (this.value == null) {
		reject(new TypeError("Cannot use null or undefined"));
		return;
	}

	fn = args[0];
	if (!isCallable(fn)) {
		fn = String(fn);
		if (!isCallable(this.value[fn])) {
			reject(new TypeError(fn + " is not a function"));
			return;
		}
		fn = this.value[fn];
	}

	args = processArguments(slice.call(args, 1));
	if (isPromise(args)) {
		if (args.failed) {
			reject(args.value);
			return;
		}
		args.done(function (args) {
			applyFn.call(this, fn, args, resolve, reject);
		}.bind(this.value), reject);
	} else {
		applyFn.call(this.value, fn, args, resolve, reject);
	}
}, function (method/*, …args*/) {
	var args, def;
	if (this.failed) return this;

	if (this.value == null) {
		return reject(new TypeError("Cannot use null or undefined"));
	}

	if (!isCallable(method)) {
		method = String(method);
		if (!isCallable(this.value[method])) {
			return reject(new TypeError(method + " is not a function"));
		}
		method = this.value[method];
	}

	args = processArguments(slice.call(arguments, 1));
	if (isPromise(args)) {
		if (args.failed) return args;
		def = deferred();
		args.done(function (args) {
			applyFn.call(this, method, args, def.resolve, def.reject);
		}.bind(this.value), def.reject);
	} else if (!method.returnsPromise) {
		def = deferred();
		applyFn.call(this.value, method, args, def.resolve, def.reject);
	} else {
		return applyFn.call(this.value, method, args, deferred, reject);
	}
	return def.promise;
});

},{"../../deferred":5,"../../is-promise":29,"../_process-arguments":6,"es5-ext/array/to-array":38,"es5-ext/object/is-callable":61}],22:[function(require,module,exports){
// 'invoke' - Promise extension
//
// promise.invoke(name[, arg0[, arg1[, ...]]])
//
// On resolved object calls method that returns immediately.
// 'name' can be method name or method itself.

'use strict';

var isCallable       = require('es5-ext/object/is-callable')
  , deferred         = require('../../deferred')
  , isPromise        = require('../../is-promise')
  , processArguments = require('../_process-arguments')

  , slice = Array.prototype.slice, apply = Function.prototype.apply
  , reject = deferred.reject
  , applyFn;

applyFn = function (fn, args, resolve, reject) {
	var value;
	try {
		value = apply.call(fn, this, args);
	} catch (e) {
		return reject(e);
	}
	return resolve(value);
};

deferred.extend('invoke', function (method/*, …args*/) {
	var def;
	if (!this.pending) this.pending = [];
	def = deferred();
	this.pending.push('invoke', [arguments, def.resolve, def.reject]);
	return def.promise;
}, function (args, resolve, reject) {
	var fn;
	if (this.failed) {
		reject(this.value);
		return;
	}

	if (this.value == null) {
		reject(new TypeError("Cannot use null or undefined"));
		return;
	}

	fn = args[0];
	if (!isCallable(fn)) {
		fn = String(fn);
		if (!isCallable(this.value[fn])) {
			reject(new TypeError(fn + " is not a function"));
			return;
		}
		fn = this.value[fn];
	}

	args = processArguments(slice.call(args, 1));
	if (isPromise(args)) {
		if (args.failed) {
			reject(args.value);
			return;
		}
		args.done(function (args) {
			applyFn.call(this, fn, args, resolve, reject);
		}.bind(this.value), reject);
	} else {
		applyFn.call(this.value, fn, args, resolve, reject);
	}
}, function (method/*, …args*/) {
	var args, def;
	if (this.failed) return this;

	if (this.value == null) {
		return reject(new TypeError("Cannot use null or undefined"));
	}

	if (!isCallable(method)) {
		method = String(method);
		if (!isCallable(this.value[method])) {
			return reject(new TypeError(method + " is not a function"));
		}
		method = this.value[method];
	}

	args = processArguments(slice.call(arguments, 1));
	if (isPromise(args)) {
		if (args.failed) return args;
		def = deferred();
		args.done(function (args) {
			applyFn.call(this, method, args, def.resolve, def.reject);
		}.bind(this.value), def.reject);
		return def.promise;
	}
	return applyFn.call(this.value, method, args, deferred, reject);
});

},{"../../deferred":5,"../../is-promise":29,"../_process-arguments":6,"es5-ext/object/is-callable":61}],23:[function(require,module,exports){
// 'map' - Promise extension
//
// promise.map(fn[, thisArg[, concurrentLimit]])
//
// Promise aware map for array-like results

'use strict';

require('./_array')('map', require('../array/map'));

},{"../array/map":7,"./_array":15}],24:[function(require,module,exports){
// 'reduce' - Promise extension
//
// promise.reduce(fn[, initial])
//
// Promise aware reduce for array-like results

'use strict';

require('./_array')('reduce', require('../array/reduce'));

},{"../array/reduce":8,"./_array":15}],25:[function(require,module,exports){
// 'some' - Promise extension
//
// promise.some(fn[, thisArg])
//
// Promise aware some for array-like results

'use strict';

require('./_array')('some', require('../array/some'));

},{"../array/some":9,"./_array":15}],26:[function(require,module,exports){
// 'spread' - Promise extensions
//
// promise.spread(onsuccess, onerror)
//
// Matches eventual list result onto function arguments,
// otherwise works same as 'then' (promise function itself)

'use strict';

var spread     = require('es5-ext/function/#/spread')
  , callable   = require('es5-ext/object/valid-callable')
  , isCallable = require('es5-ext/object/is-callable')
  , isPromise  = require('../../is-promise')
  , deferred   = require('../../deferred')

  , resolve = deferred.resolve, reject = deferred.reject;

deferred.extend('spread', function (win, fail) {
	var def;
	((win == null) || callable(win));
	if (!win && (fail == null)) return this;
	if (!this.pending) this.pending = [];
	def = deferred();
	this.pending.push('spread', [win, fail, def.resolve, def.reject]);
	return def.promise;
}, function (win, fail, resolve, reject) {
	var cb, value;
	cb = this.failed ? fail : win;
	if (cb == null) {
		if (this.failed) reject(this.value);
		else resolve(this.value);
	}
	if (isCallable(cb)) {
		if (isPromise(cb)) {
			if (cb.resolved) {
				if (cb.failed) reject(cb.value);
				else resolve(cb.value);
			} else {
				cb.done(resolve, reject);
			}
			return;
		}
		if (!this.failed) cb = spread.call(cb);
		try {
			value = cb(this.value);
		} catch (e) {
			reject(e);
			return;
		}
		resolve(value);
	} else {
		resolve(cb);
	}
}, function (win, fail) {
	var cb, value;
	cb = this.failed ? fail : win;
	if (cb == null) return this;
	if (isCallable(cb)) {
		if (isPromise(cb)) return cb;
		if (!this.failed) cb = spread.call(cb);
		try {
			value = cb(this.value);
		} catch (e) {
			return reject(e);
		}
		return resolve(value);
	}
	return resolve(cb);
});

},{"../../deferred":5,"../../is-promise":29,"es5-ext/function/#/spread":41,"es5-ext/object/is-callable":61,"es5-ext/object/valid-callable":68}],27:[function(require,module,exports){
// This construct deferred with all needed goodies that are being exported
// when we import 'deferred' by main name.
// All available promise extensions are also initialized.

'use strict';

var call   = Function.prototype.call
  , assign = require('es5-ext/object/assign');

module.exports = assign(require('./deferred'), {
	invokeAsync:   require('./invoke-async'),
	isPromise:     require('./is-promise'),
	validPromise:  require('./valid-promise'),
	callAsync:     call.bind(require('./ext/function/call-async')),
	delay:         call.bind(require('./ext/function/delay')),
	gate:          call.bind(require('./ext/function/gate')),
	monitor:       require('./monitor'),
	promisify:     call.bind(require('./ext/function/promisify')),
	promisifySync: call.bind(require('./ext/function/promisify-sync')),
	map:           call.bind(require('./ext/array/map')),
	reduce:        call.bind(require('./ext/array/reduce')),
	some:          call.bind(require('./ext/array/some'))
}, require('./profiler'));

require('./ext/promise/aside');
require('./ext/promise/catch');
require('./ext/promise/cb');
require('./ext/promise/finally');
require('./ext/promise/get');
require('./ext/promise/invoke');
require('./ext/promise/invoke-async');
require('./ext/promise/map');
require('./ext/promise/spread');
require('./ext/promise/some');
require('./ext/promise/reduce');

},{"./deferred":5,"./ext/array/map":7,"./ext/array/reduce":8,"./ext/array/some":9,"./ext/function/call-async":10,"./ext/function/delay":11,"./ext/function/gate":12,"./ext/function/promisify":14,"./ext/function/promisify-sync":13,"./ext/promise/aside":16,"./ext/promise/catch":17,"./ext/promise/cb":18,"./ext/promise/finally":19,"./ext/promise/get":20,"./ext/promise/invoke":22,"./ext/promise/invoke-async":21,"./ext/promise/map":23,"./ext/promise/reduce":24,"./ext/promise/some":25,"./ext/promise/spread":26,"./invoke-async":28,"./is-promise":29,"./monitor":30,"./profiler":82,"./valid-promise":83,"es5-ext/object/assign":57}],28:[function(require,module,exports){
// Invoke asynchronous function

'use strict';

var isCallable = require('es5-ext/object/is-callable')
  , callable   = require('es5-ext/object/valid-callable')
  , value      = require('es5-ext/object/valid-value')
  , callAsync  = require('./ext/function/call-async')._base

  , slice = Array.prototype.slice;

module.exports = function (obj, fn/*, …args*/) {
	value(obj);
	if (!isCallable(fn)) fn = callable(obj[fn]);
	return callAsync(fn, null, obj, slice.call(arguments, 2));
};

},{"./ext/function/call-async":10,"es5-ext/object/is-callable":61,"es5-ext/object/valid-callable":68,"es5-ext/object/valid-value":70}],29:[function(require,module,exports){
// Whether given object is a promise

'use strict';

module.exports = function (o) {
	return (typeof o === 'function') && (typeof o.then === 'function') && (o.end !== o.done);
};

},{}],30:[function(require,module,exports){
// Run if you want to monitor unresolved promises (in properly working
// application there should be no promises that are never resolved)

'use strict';

var max        = Math.max
  , callable   = require('es5-ext/object/valid-callable')
  , isCallable = require('es5-ext/object/is-callable')
  , toPosInt   = require('es5-ext/number/to-pos-integer')
  , deferred   = require('./deferred');

exports = module.exports = function (timeout, cb) {
	if (timeout === false) {
		// Cancel monitor
		delete deferred._monitor;
		delete exports.timeout;
		delete exports.callback;
		return;
	}
	exports.timeout = timeout = max(toPosInt(timeout) || 5000, 50);
	if (cb == null) {
		if ((typeof console !== 'undefined') && console &&
				isCallable(console.error)) {
			cb = function (e) {
				console.error(((e.stack && e.stack.toString()) ||
					"Unresolved promise: no stack available"));
			};
		}
	} else {
		callable(cb);
	}
	exports.callback = cb;

	deferred._monitor = function () {
		var e = new Error("Unresolved promise");
		return setTimeout(function () {
			if (cb) cb(e);
		}, timeout);
	};
};

},{"./deferred":5,"es5-ext/number/to-pos-integer":55,"es5-ext/object/is-callable":61,"es5-ext/object/valid-callable":68}],31:[function(require,module,exports){
'use strict';

var assign        = require('es5-ext/object/assign')
  , normalizeOpts = require('es5-ext/object/normalize-options')
  , isCallable    = require('es5-ext/object/is-callable')
  , contains      = require('es5-ext/string/#/contains')

  , d;

d = module.exports = function (dscr, value/*, options*/) {
	var c, e, w, options, desc;
	if ((arguments.length < 2) || (typeof dscr !== 'string')) {
		options = value;
		value = dscr;
		dscr = null;
	} else {
		options = arguments[2];
	}
	if (dscr == null) {
		c = w = true;
		e = false;
	} else {
		c = contains.call(dscr, 'c');
		e = contains.call(dscr, 'e');
		w = contains.call(dscr, 'w');
	}

	desc = { value: value, configurable: c, enumerable: e, writable: w };
	return !options ? desc : assign(normalizeOpts(options), desc);
};

d.gs = function (dscr, get, set/*, options*/) {
	var c, e, options, desc;
	if (typeof dscr !== 'string') {
		options = set;
		set = get;
		get = dscr;
		dscr = null;
	} else {
		options = arguments[3];
	}
	if (get == null) {
		get = undefined;
	} else if (!isCallable(get)) {
		options = get;
		get = set = undefined;
	} else if (set == null) {
		set = undefined;
	} else if (!isCallable(set)) {
		options = set;
		set = undefined;
	}
	if (dscr == null) {
		c = true;
		e = false;
	} else {
		c = contains.call(dscr, 'c');
		e = contains.call(dscr, 'e');
	}

	desc = { get: get, set: set, configurable: c, enumerable: e };
	return !options ? desc : assign(normalizeOpts(options), desc);
};

},{"es5-ext/object/assign":57,"es5-ext/object/is-callable":61,"es5-ext/object/normalize-options":67,"es5-ext/string/#/contains":71}],32:[function(require,module,exports){
'use strict';

module.exports = require('./is-implemented')()
	? Array.from
	: require('./shim');

},{"./is-implemented":33,"./shim":34}],33:[function(require,module,exports){
'use strict';

module.exports = function () {
	var from = Array.from, arr, result;
	if (typeof from !== 'function') return false;
	arr = ['raz', 'dwa'];
	result = from(arr);
	return Boolean(result && (result !== arr) && (result[1] === 'dwa'));
};

},{}],34:[function(require,module,exports){
'use strict';

var iteratorSymbol = require('es6-symbol').iterator
  , isArguments    = require('../../function/is-arguments')
  , isFunction     = require('../../function/is-function')
  , toPosInt       = require('../../number/to-pos-integer')
  , callable       = require('../../object/valid-callable')
  , validValue     = require('../../object/valid-value')
  , isString       = require('../../string/is-string')

  , isArray = Array.isArray, call = Function.prototype.call
  , desc = { configurable: true, enumerable: true, writable: true, value: null }
  , defineProperty = Object.defineProperty;

module.exports = function (arrayLike/*, mapFn, thisArg*/) {
	var mapFn = arguments[1], thisArg = arguments[2], Constructor, i, j, arr, l, code, iterator
	  , result, getIterator, value;

	arrayLike = Object(validValue(arrayLike));

	if (mapFn != null) callable(mapFn);
	if (!this || (this === Array) || !isFunction(this)) {
		// Result: Plain array
		if (!mapFn) {
			if (isArguments(arrayLike)) {
				// Source: Arguments
				l = arrayLike.length;
				if (l !== 1) return Array.apply(null, arrayLike);
				arr = new Array(1);
				arr[0] = arrayLike[0];
				return arr;
			}
			if (isArray(arrayLike)) {
				// Source: Array
				arr = new Array(l = arrayLike.length);
				for (i = 0; i < l; ++i) arr[i] = arrayLike[i];
				return arr;
			}
		}
		arr = [];
	} else {
		// Result: Non plain array
		Constructor = this;
	}

	if (!isArray(arrayLike)) {
		if ((getIterator = arrayLike[iteratorSymbol]) !== undefined) {
			// Source: Iterator
			iterator = callable(getIterator).call(arrayLike);
			if (Constructor) arr = new Constructor();
			result = iterator.next();
			i = 0;
			while (!result.done) {
				value = mapFn ? call.call(mapFn, thisArg, result.value, i) : result.value;
				if (!Constructor) {
					arr[i] = value;
				} else {
					desc.value = value;
					defineProperty(arr, i, desc);
				}
				result = iterator.next();
				++i;
			}
			l = i;
		} else if (isString(arrayLike)) {
			// Source: String
			l = arrayLike.length;
			if (Constructor) arr = new Constructor();
			for (i = 0, j = 0; i < l; ++i) {
				value = arrayLike[i];
				if ((i + 1) < l) {
					code = value.charCodeAt(0);
					if ((code >= 0xD800) && (code <= 0xDBFF)) value += arrayLike[++i];
				}
				value = mapFn ? call.call(mapFn, thisArg, value, j) : value;
				if (!Constructor) {
					arr[j] = value;
				} else {
					desc.value = value;
					defineProperty(arr, j, desc);
				}
				++j;
			}
			l = j;
		}
	}
	if (l === undefined) {
		// Source: array or array-like
		l = toPosInt(arrayLike.length);
		if (Constructor) arr = new Constructor(l);
		for (i = 0; i < l; ++i) {
			value = mapFn ? call.call(mapFn, thisArg, arrayLike[i], i) : arrayLike[i];
			if (!Constructor) {
				arr[i] = value;
			} else {
				desc.value = value;
				defineProperty(arr, i, desc);
			}
		}
	}
	if (Constructor) {
		desc.value = null;
		arr.length = l;
	}
	return arr;
};

},{"../../function/is-arguments":43,"../../function/is-function":44,"../../number/to-pos-integer":55,"../../object/valid-callable":68,"../../object/valid-value":70,"../../string/is-string":78,"es6-symbol":49}],35:[function(require,module,exports){
'use strict';

module.exports = require('./is-implemented')()
	? Array.of
	: require('./shim');

},{"./is-implemented":36,"./shim":37}],36:[function(require,module,exports){
'use strict';

module.exports = function () {
	var of = Array.of, result;
	if (typeof of !== 'function') return false;
	result = of('foo', 'bar');
	return Boolean(result && (result[1] === 'bar'));
};

},{}],37:[function(require,module,exports){
'use strict';

var isFunction = require('../../function/is-function')

  , slice = Array.prototype.slice, defineProperty = Object.defineProperty
  , desc = { configurable: true, enumerable: true, writable: true, value: null };

module.exports = function (/*…items*/) {
	var result, i, l;
	if (!this || (this === Array) || !isFunction(this)) return slice.call(arguments);
	result = new this(l = arguments.length);
	for (i = 0; i < l; ++i) {
		desc.value = arguments[i];
		defineProperty(result, i, desc);
	}
	desc.value = null;
	result.length = l;
	return result;
};

},{"../../function/is-function":44}],38:[function(require,module,exports){
'use strict';

var from = require('./from')

  , isArray = Array.isArray;

module.exports = function (arrayLike) {
	return isArray(arrayLike) ? arrayLike : from(arrayLike);
};

},{"./from":32}],39:[function(require,module,exports){
'use strict';

var toString = Object.prototype.toString

  , id = toString.call(new Error());

module.exports = function (x) {
	return (x && ((x instanceof Error) || (toString.call(x)) === id)) || false;
};

},{}],40:[function(require,module,exports){
'use strict';

var callable     = require('../../object/valid-callable')
  , aFrom        = require('../../array/from')
  , defineLength = require('../_define-length')

  , apply = Function.prototype.apply;

module.exports = function (/*…args*/) {
	var fn = callable(this)
	  , args = aFrom(arguments);

	return defineLength(function () {
		return apply.call(fn, this, args.concat(aFrom(arguments)));
	}, fn.length - args.length);
};

},{"../../array/from":32,"../../object/valid-callable":68,"../_define-length":42}],41:[function(require,module,exports){
'use strict';

var callable = require('../../object/valid-callable')

  , apply = Function.prototype.apply;

module.exports = function () {
	var fn = callable(this);
	return function (args) { return apply.call(fn, this, args); };
};

},{"../../object/valid-callable":68}],42:[function(require,module,exports){
'use strict';

var toPosInt = require('../number/to-pos-integer')

  , test = function (a, b) {}, desc, defineProperty
  , generate, mixin;

try {
	Object.defineProperty(test, 'length', { configurable: true, writable: false,
		enumerable: false, value: 1 });
} catch (ignore) {}

if (test.length === 1) {
	// ES6
	desc = { configurable: true, writable: false, enumerable: false };
	defineProperty = Object.defineProperty;
	module.exports = function (fn, length) {
		length = toPosInt(length);
		if (fn.length === length) return fn;
		desc.value = length;
		return defineProperty(fn, 'length', desc);
	};
} else {
	mixin = require('../object/mixin');
	generate = (function () {
		var cache = [];
		return function (l) {
			var args, i = 0;
			if (cache[l]) return cache[l];
			args = [];
			while (l--) args.push('a' + (++i).toString(36));
			return new Function('fn', 'return function (' + args.join(', ') +
				') { return fn.apply(this, arguments); };');
		};
	}());
	module.exports = function (src, length) {
		var target;
		length = toPosInt(length);
		if (src.length === length) return src;
		target = generate(length)(src);
		try { mixin(target, src); } catch (ignore) {}
		return target;
	};
}

},{"../number/to-pos-integer":55,"../object/mixin":66}],43:[function(require,module,exports){
'use strict';

var toString = Object.prototype.toString

  , id = toString.call((function () { return arguments; }()));

module.exports = function (x) { return (toString.call(x) === id); };

},{}],44:[function(require,module,exports){
'use strict';

var toString = Object.prototype.toString

  , id = toString.call(require('./noop'));

module.exports = function (f) {
	return (typeof f === "function") && (toString.call(f) === id);
};

},{"./noop":45}],45:[function(require,module,exports){
'use strict';

module.exports = function () {};

},{}],46:[function(require,module,exports){
'use strict';

module.exports = require('./is-implemented')()
	? Math.sign
	: require('./shim');

},{"./is-implemented":47,"./shim":48}],47:[function(require,module,exports){
'use strict';

module.exports = function () {
	var sign = Math.sign;
	if (typeof sign !== 'function') return false;
	return ((sign(10) === 1) && (sign(-20) === -1));
};

},{}],48:[function(require,module,exports){
'use strict';

module.exports = function (value) {
	value = Number(value);
	if (isNaN(value) || (value === 0)) return value;
	return (value > 0) ? 1 : -1;
};

},{}],49:[function(require,module,exports){
'use strict';

module.exports = require('./is-implemented')() ? Symbol : require('./polyfill');

},{"./is-implemented":50,"./polyfill":52}],50:[function(require,module,exports){
'use strict';

module.exports = function () {
	var symbol;
	if (typeof Symbol !== 'function') return false;
	symbol = Symbol('test symbol');
	try { String(symbol); } catch (e) { return false; }
	if (typeof Symbol.iterator === 'symbol') return true;

	// Return 'true' for polyfills
	if (typeof Symbol.isConcatSpreadable !== 'object') return false;
	if (typeof Symbol.iterator !== 'object') return false;
	if (typeof Symbol.toPrimitive !== 'object') return false;
	if (typeof Symbol.toStringTag !== 'object') return false;
	if (typeof Symbol.unscopables !== 'object') return false;

	return true;
};

},{}],51:[function(require,module,exports){
'use strict';

module.exports = function (x) {
	return (x && ((typeof x === 'symbol') || (x['@@toStringTag'] === 'Symbol'))) || false;
};

},{}],52:[function(require,module,exports){
'use strict';

var d              = require('d')
  , validateSymbol = require('./validate-symbol')

  , create = Object.create, defineProperties = Object.defineProperties
  , defineProperty = Object.defineProperty, objPrototype = Object.prototype
  , Symbol, HiddenSymbol, globalSymbols = create(null);

var generateName = (function () {
	var created = create(null);
	return function (desc) {
		var postfix = 0, name;
		while (created[desc + (postfix || '')]) ++postfix;
		desc += (postfix || '');
		created[desc] = true;
		name = '@@' + desc;
		defineProperty(objPrototype, name, d.gs(null, function (value) {
			defineProperty(this, name, d(value));
		}));
		return name;
	};
}());

HiddenSymbol = function Symbol(description) {
	if (this instanceof HiddenSymbol) throw new TypeError('TypeError: Symbol is not a constructor');
	return Symbol(description);
};
module.exports = Symbol = function Symbol(description) {
	var symbol;
	if (this instanceof Symbol) throw new TypeError('TypeError: Symbol is not a constructor');
	symbol = create(HiddenSymbol.prototype);
	description = (description === undefined ? '' : String(description));
	return defineProperties(symbol, {
		__description__: d('', description),
		__name__: d('', generateName(description))
	});
};
defineProperties(Symbol, {
	for: d(function (key) {
		if (globalSymbols[key]) return globalSymbols[key];
		return (globalSymbols[key] = Symbol(String(key)));
	}),
	keyFor: d(function (s) {
		var key;
		validateSymbol(s);
		for (key in globalSymbols) if (globalSymbols[key] === s) return key;
	}),
	hasInstance: d('', Symbol('hasInstance')),
	isConcatSpreadable: d('', Symbol('isConcatSpreadable')),
	iterator: d('', Symbol('iterator')),
	match: d('', Symbol('match')),
	replace: d('', Symbol('replace')),
	search: d('', Symbol('search')),
	species: d('', Symbol('species')),
	split: d('', Symbol('split')),
	toPrimitive: d('', Symbol('toPrimitive')),
	toStringTag: d('', Symbol('toStringTag')),
	unscopables: d('', Symbol('unscopables'))
});
defineProperties(HiddenSymbol.prototype, {
	constructor: d(Symbol),
	toString: d('', function () { return this.__name__; })
});

defineProperties(Symbol.prototype, {
	toString: d(function () { return 'Symbol (' + validateSymbol(this).__description__ + ')'; }),
	valueOf: d(function () { return validateSymbol(this); })
});
defineProperty(Symbol.prototype, Symbol.toPrimitive, d('',
	function () { return validateSymbol(this); }));
defineProperty(Symbol.prototype, Symbol.toStringTag, d('c', 'Symbol'));

defineProperty(HiddenSymbol.prototype, Symbol.toPrimitive,
	d('c', Symbol.prototype[Symbol.toPrimitive]));
defineProperty(HiddenSymbol.prototype, Symbol.toStringTag,
	d('c', Symbol.prototype[Symbol.toStringTag]));

},{"./validate-symbol":53,"d":31}],53:[function(require,module,exports){
'use strict';

var isSymbol = require('./is-symbol');

module.exports = function (value) {
	if (!isSymbol(value)) throw new TypeError(value + " is not a symbol");
	return value;
};

},{"./is-symbol":51}],54:[function(require,module,exports){
'use strict';

var sign = require('../math/sign')

  , abs = Math.abs, floor = Math.floor;

module.exports = function (value) {
	if (isNaN(value)) return 0;
	value = Number(value);
	if ((value === 0) || !isFinite(value)) return value;
	return sign(value) * floor(abs(value));
};

},{"../math/sign":46}],55:[function(require,module,exports){
'use strict';

var toInteger = require('./to-integer')

  , max = Math.max;

module.exports = function (value) { return max(0, toInteger(value)); };

},{"./to-integer":54}],56:[function(require,module,exports){
// Internal method, used by iteration functions.
// Calls a function for each key-value pair found in object
// Optionally takes compareFn to iterate object in specific order

'use strict';

var isCallable = require('./is-callable')
  , callable   = require('./valid-callable')
  , value      = require('./valid-value')

  , call = Function.prototype.call, keys = Object.keys
  , propertyIsEnumerable = Object.prototype.propertyIsEnumerable;

module.exports = function (method, defVal) {
	return function (obj, cb/*, thisArg, compareFn*/) {
		var list, thisArg = arguments[2], compareFn = arguments[3];
		obj = Object(value(obj));
		callable(cb);

		list = keys(obj);
		if (compareFn) {
			list.sort(isCallable(compareFn) ? compareFn.bind(obj) : undefined);
		}
		return list[method](function (key, index) {
			if (!propertyIsEnumerable.call(obj, key)) return defVal;
			return call.call(cb, thisArg, obj[key], key, obj, index);
		});
	};
};

},{"./is-callable":61,"./valid-callable":68,"./valid-value":70}],57:[function(require,module,exports){
'use strict';

module.exports = require('./is-implemented')()
	? Object.assign
	: require('./shim');

},{"./is-implemented":58,"./shim":59}],58:[function(require,module,exports){
'use strict';

module.exports = function () {
	var assign = Object.assign, obj;
	if (typeof assign !== 'function') return false;
	obj = { foo: 'raz' };
	assign(obj, { bar: 'dwa' }, { trzy: 'trzy' });
	return (obj.foo + obj.bar + obj.trzy) === 'razdwatrzy';
};

},{}],59:[function(require,module,exports){
'use strict';

var keys  = require('../keys')
  , value = require('../valid-value')

  , max = Math.max;

module.exports = function (dest, src/*, …srcn*/) {
	var error, i, l = max(arguments.length, 2), assign;
	dest = Object(value(dest));
	assign = function (key) {
		try { dest[key] = src[key]; } catch (e) {
			if (!error) error = e;
		}
	};
	for (i = 1; i < l; ++i) {
		src = arguments[i];
		keys(src).forEach(assign);
	}
	if (error !== undefined) throw error;
	return dest;
};

},{"../keys":63,"../valid-value":70}],60:[function(require,module,exports){
'use strict';

module.exports = require('./_iterate')('forEach');

},{"./_iterate":56}],61:[function(require,module,exports){
// Deprecated

'use strict';

module.exports = function (obj) { return typeof obj === 'function'; };

},{}],62:[function(require,module,exports){
'use strict';

var map = { function: true, object: true };

module.exports = function (x) {
	return ((x != null) && map[typeof x]) || false;
};

},{}],63:[function(require,module,exports){
'use strict';

module.exports = require('./is-implemented')()
	? Object.keys
	: require('./shim');

},{"./is-implemented":64,"./shim":65}],64:[function(require,module,exports){
'use strict';

module.exports = function () {
	try {
		Object.keys('primitive');
		return true;
	} catch (e) { return false; }
};

},{}],65:[function(require,module,exports){
'use strict';

var keys = Object.keys;

module.exports = function (object) {
	return keys(object == null ? object : Object(object));
};

},{}],66:[function(require,module,exports){
'use strict';

var value = require('./valid-value')

  , defineProperty = Object.defineProperty
  , getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
  , getOwnPropertyNames = Object.getOwnPropertyNames;

module.exports = function (target, source) {
	var error;
	target = Object(value(target));
	getOwnPropertyNames(Object(value(source))).forEach(function (name) {
		try {
			defineProperty(target, name, getOwnPropertyDescriptor(source, name));
		} catch (e) { error = e; }
	});
	if (error !== undefined) throw error;
	return target;
};

},{"./valid-value":70}],67:[function(require,module,exports){
'use strict';

var forEach = Array.prototype.forEach, create = Object.create;

var process = function (src, obj) {
	var key;
	for (key in src) obj[key] = src[key];
};

module.exports = function (options/*, …options*/) {
	var result = create(null);
	forEach.call(arguments, function (options) {
		if (options == null) return;
		process(Object(options), result);
	});
	return result;
};

},{}],68:[function(require,module,exports){
'use strict';

module.exports = function (fn) {
	if (typeof fn !== 'function') throw new TypeError(fn + " is not a function");
	return fn;
};

},{}],69:[function(require,module,exports){
'use strict';

var isObject = require('./is-object');

module.exports = function (value) {
	if (!isObject(value)) throw new TypeError(value + " is not an Object");
	return value;
};

},{"./is-object":62}],70:[function(require,module,exports){
'use strict';

module.exports = function (value) {
	if (value == null) throw new TypeError("Cannot use null or undefined");
	return value;
};

},{}],71:[function(require,module,exports){
'use strict';

module.exports = require('./is-implemented')()
	? String.prototype.contains
	: require('./shim');

},{"./is-implemented":72,"./shim":73}],72:[function(require,module,exports){
'use strict';

var str = 'razdwatrzy';

module.exports = function () {
	if (typeof str.contains !== 'function') return false;
	return ((str.contains('dwa') === true) && (str.contains('foo') === false));
};

},{}],73:[function(require,module,exports){
'use strict';

var indexOf = String.prototype.indexOf;

module.exports = function (searchString/*, position*/) {
	return indexOf.call(this, searchString, arguments[1]) > -1;
};

},{}],74:[function(require,module,exports){
'use strict';

var toInteger = require('../../number/to-integer')
  , value     = require('../../object/valid-value')
  , repeat    = require('./repeat')

  , abs = Math.abs, max = Math.max;

module.exports = function (fill/*, length*/) {
	var self = String(value(this))
	  , sLength = self.length
	  , length = arguments[1];

	length = isNaN(length) ? 1 : toInteger(length);
	fill = repeat.call(String(fill), abs(length));
	if (length >= 0) return fill.slice(0, max(0, length - sLength)) + self;
	return self + (((sLength + length) >= 0) ? '' : fill.slice(length + sLength));
};

},{"../../number/to-integer":54,"../../object/valid-value":70,"./repeat":75}],75:[function(require,module,exports){
'use strict';

module.exports = require('./is-implemented')()
	? String.prototype.repeat
	: require('./shim');

},{"./is-implemented":76,"./shim":77}],76:[function(require,module,exports){
'use strict';

var str = 'foo';

module.exports = function () {
	if (typeof str.repeat !== 'function') return false;
	return (str.repeat(2) === 'foofoo');
};

},{}],77:[function(require,module,exports){
// Thanks: http://www.2ality.com/2014/01/efficient-string-repeat.html

'use strict';

var value     = require('../../../object/valid-value')
  , toInteger = require('../../../number/to-integer');

module.exports = function (count) {
	var str = String(value(this)), result;
	count = toInteger(count);
	if (count < 0) throw new RangeError("Count must be >= 0");
	if (!isFinite(count)) throw new RangeError("Count must be < ∞");
	result = '';
	if (!count) return result;
	while (true) {
		if (count & 1) result += str;
		count >>>= 1;
		if (count <= 0) break;
		str += str;
	}
	return result;
};

},{"../../../number/to-integer":54,"../../../object/valid-value":70}],78:[function(require,module,exports){
'use strict';

var toString = Object.prototype.toString

  , id = toString.call('');

module.exports = function (x) {
	return (typeof x === 'string') || (x && (typeof x === 'object') &&
		((x instanceof String) || (toString.call(x) === id))) || false;
};

},{}],79:[function(require,module,exports){
'use strict';

var d        = require('d')
  , callable = require('es5-ext/object/valid-callable')

  , apply = Function.prototype.apply, call = Function.prototype.call
  , create = Object.create, defineProperty = Object.defineProperty
  , defineProperties = Object.defineProperties
  , hasOwnProperty = Object.prototype.hasOwnProperty
  , descriptor = { configurable: true, enumerable: false, writable: true }

  , on, once, off, emit, methods, descriptors, base;

on = function (type, listener) {
	var data;

	callable(listener);

	if (!hasOwnProperty.call(this, '__ee__')) {
		data = descriptor.value = create(null);
		defineProperty(this, '__ee__', descriptor);
		descriptor.value = null;
	} else {
		data = this.__ee__;
	}
	if (!data[type]) data[type] = listener;
	else if (typeof data[type] === 'object') data[type].push(listener);
	else data[type] = [data[type], listener];

	return this;
};

once = function (type, listener) {
	var once, self;

	callable(listener);
	self = this;
	on.call(this, type, once = function () {
		off.call(self, type, once);
		apply.call(listener, this, arguments);
	});

	once.__eeOnceListener__ = listener;
	return this;
};

off = function (type, listener) {
	var data, listeners, candidate, i;

	callable(listener);

	if (!hasOwnProperty.call(this, '__ee__')) return this;
	data = this.__ee__;
	if (!data[type]) return this;
	listeners = data[type];

	if (typeof listeners === 'object') {
		for (i = 0; (candidate = listeners[i]); ++i) {
			if ((candidate === listener) ||
					(candidate.__eeOnceListener__ === listener)) {
				if (listeners.length === 2) data[type] = listeners[i ? 0 : 1];
				else listeners.splice(i, 1);
			}
		}
	} else {
		if ((listeners === listener) ||
				(listeners.__eeOnceListener__ === listener)) {
			delete data[type];
		}
	}

	return this;
};

emit = function (type) {
	var i, l, listener, listeners, args;

	if (!hasOwnProperty.call(this, '__ee__')) return;
	listeners = this.__ee__[type];
	if (!listeners) return;

	if (typeof listeners === 'object') {
		l = arguments.length;
		args = new Array(l - 1);
		for (i = 1; i < l; ++i) args[i - 1] = arguments[i];

		listeners = listeners.slice();
		for (i = 0; (listener = listeners[i]); ++i) {
			apply.call(listener, this, args);
		}
	} else {
		switch (arguments.length) {
		case 1:
			call.call(listeners, this);
			break;
		case 2:
			call.call(listeners, this, arguments[1]);
			break;
		case 3:
			call.call(listeners, this, arguments[1], arguments[2]);
			break;
		default:
			l = arguments.length;
			args = new Array(l - 1);
			for (i = 1; i < l; ++i) {
				args[i - 1] = arguments[i];
			}
			apply.call(listeners, this, args);
		}
	}
};

methods = {
	on: on,
	once: once,
	off: off,
	emit: emit
};

descriptors = {
	on: d(on),
	once: d(once),
	off: d(off),
	emit: d(emit)
};

base = defineProperties({}, descriptors);

module.exports = exports = function (o) {
	return (o == null) ? create(base) : defineProperties(Object(o), descriptors);
};
exports.methods = methods;

},{"d":31,"es5-ext/object/valid-callable":68}],80:[function(require,module,exports){
'use strict';

var forEach    = require('es5-ext/object/for-each')
  , validValue = require('es5-ext/object/valid-object')

  , push = Array.prototype.apply, defineProperty = Object.defineProperty
  , create = Object.create, hasOwnProperty = Object.prototype.hasOwnProperty
  , d = { configurable: true, enumerable: false, writable: true };

module.exports = function (e1, e2) {
	var data;
	(validValue(e1) && validValue(e2));
	if (!hasOwnProperty.call(e1, '__ee__')) {
		if (!hasOwnProperty.call(e2, '__ee__')) {
			d.value = create(null);
			defineProperty(e1, '__ee__', d);
			defineProperty(e2, '__ee__', d);
			d.value = null;
			return;
		}
		d.value = e2.__ee__;
		defineProperty(e1, '__ee__', d);
		d.value = null;
		return;
	}
	data = d.value = e1.__ee__;
	if (!hasOwnProperty.call(e2, '__ee__')) {
		defineProperty(e2, '__ee__', d);
		d.value = null;
		return;
	}
	if (data === e2.__ee__) return;
	forEach(e2.__ee__, function (listener, name) {
		if (!data[name]) {
			data[name] = listener;
			return;
		}
		if (typeof data[name] === 'object') {
			if (typeof listener === 'object') push.apply(data[name], listener);
			else data[name].push(listener);
		} else if (typeof listener === 'object') {
			listener.unshift(data[name]);
			data[name] = listener;
		} else {
			data[name] = [data[name], listener];
		}
	});
	defineProperty(e2, '__ee__', d);
	d.value = null;
};

},{"es5-ext/object/for-each":60,"es5-ext/object/valid-object":69}],81:[function(require,module,exports){
(function (process){
'use strict';

var callable, byObserver;

callable = function (fn) {
	if (typeof fn !== 'function') throw new TypeError(fn + " is not a function");
	return fn;
};

byObserver = function (Observer) {
	var node = document.createTextNode(''), queue, i = 0;
	new Observer(function () {
		var data;
		if (!queue) return;
		data = queue;
		queue = null;
		if (typeof data === 'function') {
			data();
			return;
		}
		data.forEach(function (fn) { fn(); });
	}).observe(node, { characterData: true });
	return function (fn) {
		callable(fn);
		if (queue) {
			if (typeof queue === 'function') queue = [queue, fn];
			else queue.push(fn);
			return;
		}
		queue = fn;
		node.data = (i = ++i % 2);
	};
};

module.exports = (function () {
	// Node.js
	if ((typeof process !== 'undefined') && process &&
			(typeof process.nextTick === 'function')) {
		return process.nextTick;
	}

	// MutationObserver=
	if ((typeof document === 'object') && document) {
		if (typeof MutationObserver === 'function') {
			return byObserver(MutationObserver);
		}
		if (typeof WebKitMutationObserver === 'function') {
			return byObserver(WebKitMutationObserver);
		}
	}

	// W3C Draft
	// http://dvcs.w3.org/hg/webperf/raw-file/tip/specs/setImmediate/Overview.html
	if (typeof setImmediate === 'function') {
		return function (cb) { setImmediate(callable(cb)); };
	}

	// Wide available standard
	if (typeof setTimeout === 'function') {
		return function (cb) { setTimeout(callable(cb), 0); };
	}

	return null;
}());

}).call(this,require('_process'))
},{"_process":87}],82:[function(require,module,exports){
'use strict';

var partial  = require('es5-ext/function/#/partial')
  , forEach  = require('es5-ext/object/for-each')
  , pad      = require('es5-ext/string/#/pad')
  , deferred = require('./deferred')

  , resolved, rStats, unresolved, uStats, profile;

exports.profile = function () {
	resolved = 0;
	rStats = {};
	unresolved = 0;
	uStats = {};
	deferred._profile = profile;
};

profile = function (isResolved) {
	var stack, data;

	if (isResolved) {
		++resolved;
		data = rStats;
	} else {
		++unresolved;
		data = uStats;
	}

	stack = (new Error()).stack;
	if (!stack.split('\n').slice(3).some(function (line) {
			if ((line.search(/[\/\\]deferred[\/\\]/) === -1) &&
					(line.search(/[\/\\]es5-ext[\/\\]/) === -1) &&
					(line.indexOf(' (native)') === -1)) {
				line = line.replace(/\n/g, "\\n").trim();
				if (!data[line]) {
					data[line] = { count: 0 };
				}
				++data[line].count;
				return true;
			}
		})) {
		if (!data.unknown) {
			data.unknown = { count: 0, stack: stack };
		}
		++data.unknown.count;
	}
};

exports.profileEnd = function () {
	var total, lpad, log = '';

	if (!deferred._profile) {
		throw new Error("Deferred profiler was not initialized");
	}
	delete deferred._profile;

	log += "------------------------------------------------------------\n";
	log += "Deferred usage statistics:\n\n";

	total = String(resolved + unresolved);
	lpad = partial.call(pad, " ", total.length);
	log += total + " Total promises initialized\n";
	log += lpad.call(unresolved) + " Initialized as Unresolved\n";
	log += lpad.call(resolved) + " Initialized as Resolved\n";

	if (unresolved) {
		log += "\nUnresolved promises were initialized at:\n";
		forEach(uStats, function (data, name) {
			log += lpad.call(data.count) + " " + name + "\n";
		}, null, function (a, b) {
			return this[b].count - this[a].count;
		});
	}

	if (resolved) {
		log += "\nResolved promises were initialized at:\n";
		forEach(rStats, function (data, name) {
			log += lpad.call(data.count) + " " + name + "\n";
		}, null, function (a, b) {
			return this[b].count - this[a].count;
		});
	}
	log += "------------------------------------------------------------\n";

	return {
		log: log,
		resolved: { count: resolved, stats: rStats },
		unresolved: { count: unresolved, stats: uStats }
	};
};

},{"./deferred":5,"es5-ext/function/#/partial":40,"es5-ext/object/for-each":60,"es5-ext/string/#/pad":74}],83:[function(require,module,exports){
'use strict';

var isPromise = require('./is-promise');

module.exports = function (x) {
	if (!isPromise(x)) {
		throw new TypeError(x + " is not a promise object");
	}
	return x;
};

},{"./is-promise":29}],84:[function(require,module,exports){
var hasOwn = Object.prototype.hasOwnProperty;
var toStr = Object.prototype.toString;
var undefined;

var isArray = function isArray(arr) {
	if (typeof Array.isArray === 'function') {
		return Array.isArray(arr);
	}

	return toStr.call(arr) === '[object Array]';
};

var isPlainObject = function isPlainObject(obj) {
	'use strict';
	if (!obj || toStr.call(obj) !== '[object Object]') {
		return false;
	}

	var has_own_constructor = hasOwn.call(obj, 'constructor');
	var has_is_property_of_method = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
	if (obj.constructor && !has_own_constructor && !has_is_property_of_method) {
		return false;
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	var key;
	for (key in obj) {}

	return key === undefined || hasOwn.call(obj, key);
};

module.exports = function extend() {
	'use strict';
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0],
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if (typeof target === 'boolean') {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	} else if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
		target = {};
	}

	for (; i < length; ++i) {
		options = arguments[i];
		// Only deal with non-null/undefined values
		if (options != null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];

				// Prevent never-ending loop
				if (target === copy) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)))) {
					if (copyIsArray) {
						copyIsArray = false;
						clone = src && isArray(src) ? src : [];
					} else {
						clone = src && isPlainObject(src) ? src : {};
					}

					// Never move original objects, clone them
					target[name] = extend(deep, clone, copy);

				// Don't bring in undefined values
				} else if (copy !== undefined) {
					target[name] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};


},{}],85:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],86:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],87:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;

function drainQueue() {
    if (draining) {
        return;
    }
    draining = true;
    var currentQueue;
    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        var i = -1;
        while (++i < len) {
            currentQueue[i]();
        }
        len = queue.length;
    }
    draining = false;
}
process.nextTick = function (fun) {
    queue.push(fun);
    if (!draining) {
        setTimeout(drainQueue, 0);
    }
};

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],88:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],89:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":88,"_process":87,"inherits":86}]},{},[1]);
