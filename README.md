# What is procrastinate.js?

Ever wanted to do things later and one thing at a time? Well now you can! You can even not do thing if you are already doing one thing.

# Usage

## Basic usage

```javascript
var p = new procrastinate({
	'events': {
		'beforeSave': 1, // No async
		'save': 2, // A little async
		'afterSave': 1 // No async
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

## Use case: autosave form data to server without spamming the server

```javascript
var p = new procrastinate(/* your events */);
p.on(/* your listeners */);

document.query('input, select, textarea').on('change', function() {
	p.doLater(3000); // Only do after 3 sec of inactivity
});
document.query('button.saveButton').on('click', function() {
	p.doNow(true); // Do now, enqueue if necessary.
    // Enqueue means that if something is running it will do after current task is done
});
```

# Install

node
```javascript
var procrastinate = require('procrastinate');
```

browser
```html
<script src="build/procrastinate.min.js"></script>
```