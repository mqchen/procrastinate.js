# What is procrastinate.js?

Ever wanted to do things later and one thing at a time? Well now you can! You can even not do thing if you are already doing one thing.

# Usage
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
	p.on('afterSave', function() {  log.push('Done saving, phew') });

    // Call it
	p.doNow();

`log` should contain:

    Preparing to save
    Done waiting
    Save half-way
    Save half-way
    Save completed
    Save completed
    Done saving, phew

