# What is procrastinate.js?

[![Build Status](https://travis-ci.org/mqchen/procrastinate.js.svg?branch=master)](https://travis-ci.org/mqchen/procrastinate.js)
[![Coverage Status](https://coveralls.io/repos/mqchen/procrastinate.js/badge.svg)](https://coveralls.io/r/mqchen/procrastinate.js)

Ever wanted to do things later and one only thing at a time? Well now you can! You can even not do the thing if you are already doing one thing.

# Usage

## Basic usage

```javascript
var p = new procrastinate({
	'events': {
		'beforeSave': 1, // No async
		'save': 2, // A little async
		'afterSave': 100 // Very async
	}
});

var log = [];

p.on('beforeSave', function() { log.push('Preparing to save') });
p.on('beforeSave', function() {
	var d = deferred();
	setTimeout(function() {
		// Wait a little before we start...
		log.push('Done waiting');
		d.resolve();
	}, 1000);
	return d.promise;
});
var save = function() {
	var d = deferred();
	setTimeout(function() {
		log.push('Save half-way');
		setTimeout(function() {
			log.push('Save completed');
			d.resolve();
		}, 1000);
	}, 1000);
	return d.promise;
};
p.on('save', save);
p.on('save', save);
p.on('save', save);
p.on('afterSave', function() {  log.push('Done saving, phew') });

// Call it
p.doNow();
```

`log` should contain:

    Preparing to save
    Done waiting
    Save half-way
    Save half-way
    Save completed
    Save completed
    Save half-way
    Save completed
    Done saving, phew

## Use case: autosave form to server without spamming the server

```javascript
var p = new procrastinate(/* your events */);
p.on(/* your listeners */);

$('input, select, textarea').on('change', function() {
	p.doLater(3000); // Only do after 3 sec of inactivity
	// If 3 sec delay happens to expire when it is already saving it will be ignored
	// since enqueue is not set to true
});
$('.saveButton').on('click', function() {
	p.doNow(true); // Do now, enqueue if necessary.
    // Enqueue means that if something is running it will do after current task is done
});
```

# Install

**node**

	npm install --save procrastinate-queue

(The name "procrastinate" was actually taken...)

**browser**
```html
<script src="build/browser/procrastinate.min.js"></script>
```

# Methods

### new procrastinate(customOptions)

Initialize with options that declare your event flow/order and max concurrency for each event.

Example:
```javascript
var p = new procrastinate({
	'events': {
    	'validate': 1, 'beforeSave': 1, 'save': 2, 'afterSave': 10
    }
});
```
The events will be executed in the specified order. For example, `beforeSave` will run after all `validate` events have finished. Additionally, the listeneres to both `validate` and `beforeSave` will run sequentially. `save` will allow 2 listners to run simultaneously while `afterSave` will allow 10.

### on(listener)

Add event listeners to your events. The listeners will be executed in the order they are added.

Both regular functions and deferred functions are supported.

Example:

```javascript
p.on('save', function() {  /* Do something syncronously */ });
p.on('save', function() {  
	var d = deferred(); // Use: https://www.npmjs.com/package/deferred
    setTimeout(function() {
    	d.resolve();
    }, 1000);
    return d.promise();
});
```

### doNow(enqueue = false)

Execute the event chain now. This method returns a promise which will be resolved once the entire event chain has completed.

If `enqueue` is false or undefined, and if there is already another event chain ongoing, this will do nothing, and the returned promise will resolve immediately.

Set `enqueue` to true to execute the event chain once the ongoing event chain has completed.

### doLater(timeout, enqueue = false)

Execute the event chain when the timeout has expired. However, if doLater is called before the previous timeout has expired, it will cancel the previous doLater. This method returns a promise that resolves when the deferred event chain completes. (It will not resolve if it cleared. This behaviour might change in a future version.)

Set `enqueue` to true to execute the doLater after any ongoing event chain has completed.

A doNow clears any unenqueued doLater. To prevent your doLater from being cleared by a doNow set `enqueue` to true.

### isDoing()

Returns true if an event chain is currently executing.

### getDoing()

Get the promise for the ongoing event chain. If there is no ongoing event chain this will return an immediately resolved promise.

### abort()

Calling this method while an event chain is ongoing will prevent the next event in the chain from executing. It will not abort the ongoing event because events might be running in parallell. 