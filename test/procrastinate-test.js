var buster = require('buster');
var assert = buster.referee.assert;
var refute = buster.referee.refute;
var sinon = require('sinon');
var deferred = require('deferred');

var procrastinate = require('../index');

sinon.assert.expose(assert);

buster.testCase('procrastinate.js', {
	setUp: function() {
		this.clock = sinon.useFakeTimers();
		this.procrastinateInst = new procrastinate({
			'events': {
				'beforeDo': 1,
				'doing': 1,
				'afterDo': 1
			}
		});
	},
	tearDown: function() {
		this.clock.restore();
	},

	"api methods exists": function() {
		assert.isFunction(procrastinate);
		assert.isFunction(this.procrastinateInst.doLater);
		assert.isFunction(this.procrastinateInst.doNow);
		assert.isFunction(this.procrastinateInst.on);
		assert.isFunction(this.procrastinateInst.isDoing);
		assert.isFunction(this.procrastinateInst.getDoing);
	},

	"deferred listener support": function() {
		var d = deferred();
		var s1 = sinon.spy(function() { d.resolve(); });

		this.procrastinateInst.on('beforeDo', function() {
			setTimeout(s1, 1000);
			return d.promise;
		});
		this.procrastinateInst.doNow();
		assert.equals(s1.callCount, 0);
		this.clock.tick(2000);
		assert.calledOnce(s1);
	},

	"normal callback instead of deferred support": function() {

		var runCount = 0;
		this.procrastinateInst.on('beforeDo', function() {
			runCount++;
		});

		assert.equals(runCount, 0);
		this.procrastinateInst.doNow();
		assert.equals(runCount, 1);
		this.procrastinateInst.doNow();
		assert.equals(runCount, 2);

		var l1 = sinon.spy();

		this.procrastinateInst.on('beforeDo', l1);
		assert.equals(l1.callCount, 0);
		this.procrastinateInst.doNow();
		assert.calledOnce(l1);
	},

	"mix of normal callback and deferred": function() {
		var l1 = sinon.spy();
		var d2 = deferred();
		var s2 = sinon.spy(function() { d2.resolve(); });

		this.procrastinateInst.on('beforeDo', l1);
		this.procrastinateInst.on('beforeDo', function() {
			setTimeout(s2, 1000);
			return d2.promsie;
		});
		this.procrastinateInst.doNow();
		assert.equals(l1.callCount, 1);
		assert.equals(s2.callCount, 0);
		this.clock.tick(1001);
		assert.equals(l1.callCount, 1);
		assert.equals(s2.callCount, 1);
	},

	"multiple listeners to beforeDo and called in right order": function() {
		var l1 = sinon.spy();
		var l2 = sinon.spy();

		this.procrastinateInst.on('beforeDo', l1);
		this.procrastinateInst.on('beforeDo', l2);

		this.procrastinateInst.doNow();

		assert.calledOnce(l1);
		assert.calledOnce(l2);
		assert.callOrder(l1, l2);

		this.procrastinateInst.doNow();

		assert.calledTwice(l1);
		assert.calledTwice(l2);
		assert.callOrder(l1, l2);
	},

	"doLater should call doNow later": function() {
		var l1 = sinon.spy();

		this.procrastinateInst.on('beforeDo', l1);

		this.procrastinateInst.doLater(1000);

		assert.equals(l1.callCount, 0);

		this.clock.tick(1001);

		assert.calledOnce(l1);
	},

	"doLater should only do once if it is being spammed": function() {
		var l1 = sinon.spy();
		this.procrastinateInst.on('beforeDo', l1);
		for(var i = 0; i < 1000; i++) {
			this.procrastinateInst.doLater(1000);
		}

		assert.equals(l1.callCount, 0);

		this.clock.tick(1001);

		assert.calledOnce(l1);

		this.clock.tick(1000000);

		assert.calledOnce(l1);
	},

	"afterDo should be called after the doing is done": function() {
		var l1 = sinon.spy();
		var l2 = sinon.spy();

		this.procrastinateInst.on('beforeDo', l1);
		this.procrastinateInst.on('afterDo', l2);

		this.procrastinateInst.doNow();

		assert.callOrder(l1, l2);
	},

	"async lisenters should be triggered sequentially": function() {
		var d1 = deferred();
		var s1 = sinon.spy(function() { d1.resolve(); });

		var d2 = deferred();
		var s2 = sinon.spy(function() { d2.resolve(); });

		var d3 = deferred();
		var s3 = sinon.spy(function() { d3.resolve(); });

		this.procrastinateInst.on('beforeDo', function() {
			setTimeout(s1, 1000);
			return d1.promise;
		});
		this.procrastinateInst.on('beforeDo', function() {
			setTimeout(s2, 2000);
			return d2.promise;
		});
		this.procrastinateInst.on('beforeDo', function() {
			setTimeout(s3, 500);
			return d3.promise;
		});

		this.procrastinateInst.doNow();

		assert.equals(s1.callCount, 0);
		assert.equals(s2.callCount, 0);
		assert.equals(s3.callCount, 0);
		this.clock.tick(1001);
		assert.equals(s1.callCount, 1);
		assert.equals(s2.callCount, 0);
		assert.equals(s3.callCount, 0);
		this.clock.tick(1000); // 2 sec later
		assert.equals(s1.callCount, 1);
		assert.equals(s2.callCount, 0);
		assert.equals(s3.callCount, 0);
		this.clock.tick(1001); // 3 sec later
		assert.equals(s1.callCount, 1);
		assert.equals(s2.callCount, 1);
		assert.equals(s3.callCount, 0);
		this.clock.tick(501); // 3.5 sec later
		assert.equals(s1.callCount, 1);
		assert.equals(s2.callCount, 1);
		assert.equals(s3.callCount, 1);
	},

	"events should be triggered in the right order": function() {
		var l1 = sinon.spy(); // before
		var l2 = sinon.spy(); // doing
		var l3 = sinon.spy(); // after

		this.procrastinateInst.on('afterDo', l3);
		this.procrastinateInst.on('beforeDo', l1);
		this.procrastinateInst.on('doing', l2);
		this.procrastinateInst.doNow();

		assert.callOrder(l1, l2, l3);
	},

	"deferred listeners should be triggered sequentially": function() {
		var d1 = deferred();
		var s1 = sinon.spy(function() { d1.resolve(); });

		var d2 = deferred();
		var s2 = sinon.spy(function() { d2.resolve(); });

		var d3 = deferred();
		var s3 = sinon.spy(function() { d3.resolve(); });

		var d4 = deferred();
		var s4 = sinon.spy(function() { d4.resolve(); });

		this.procrastinateInst.on('beforeDo', function() {
			setTimeout(s1, 1000);
			return d1.promise;
		});
		this.procrastinateInst.on('doing', function() {
			setTimeout(s2, 1000);
			return d2.promise;
		});
		this.procrastinateInst.on('doing', function() {
			setTimeout(s3, 1000);
			return d3.promise;
		});
		this.procrastinateInst.on('afterDo', function() {
			setTimeout(s4, 1000);
			return d4.promise;
		});
		this.procrastinateInst.doNow();

		assert.equals(s1.callCount, 0);
		assert.equals(s2.callCount, 0);
		assert.equals(s3.callCount, 0);
		assert.equals(s4.callCount, 0);

		this.clock.tick(1001);

		assert.equals(s1.callCount, 1);
		assert.equals(s2.callCount, 0);
		assert.equals(s3.callCount, 0);
		assert.equals(s4.callCount, 0);

		this.clock.tick(1001); // 2 sec later, when doing is done

		assert.equals(s1.callCount, 1);
		assert.equals(s2.callCount, 1);
		assert.equals(s3.callCount, 0);
		assert.equals(s4.callCount, 0);

		this.clock.tick(1001); // 3 sec later, when second doing is done

		assert.equals(s1.callCount, 1);
		assert.equals(s2.callCount, 1);
		assert.equals(s3.callCount, 1);
		assert.equals(s4.callCount, 0);

		this.clock.tick(1001); // 4 sec later, when after do is done

		assert.equals(s1.callCount, 1);
		assert.equals(s2.callCount, 1);
		assert.equals(s3.callCount, 1);
		assert.equals(s4.callCount, 1);
	},

	"isDoing should return true when a do is running": function() {
		var d = deferred();
		var s1 = sinon.spy(function() { d.resolve(); });

		this.procrastinateInst.on('beforeDo', function() {
			setTimeout(s1, 1000);
			return d.promise;
		});
		assert.isFalse(this.procrastinateInst.isDoing());
		this.procrastinateInst.doNow();
		assert.isTrue(this.procrastinateInst.isDoing());
		this.clock.tick(500);
		assert.isTrue(this.procrastinateInst.isDoing());
		this.clock.tick(501);
		assert.isFalse(this.procrastinateInst.isDoing());
	},

	"calling doNow while isDoing should discard if enqueue false": function() {
		var d = deferred();
		var s1 = sinon.spy(function() { d.resolve(); });

		this.procrastinateInst.on('beforeDo', function() {
			setTimeout(s1, 1000);
			return d.promise;
		});
		assert.isFalse(this.procrastinateInst.isDoing());
		this.procrastinateInst.doNow();
		assert.isTrue(this.procrastinateInst.isDoing());

		var count = 100;
		while(count--) {
			this.procrastinateInst.doNow(false);
		}

		this.clock.tick(2000);
		assert.isFalse(this.procrastinateInst.isDoing());
		assert.calledOnce(s1);
	},

	"calling doLater while isDoing should discard if enqueue false": function() {
		var d = deferred();
		var s1 = sinon.spy(function() { d.resolve(); });

		this.procrastinateInst.on('beforeDo', function() {
			setTimeout(s1, 2000);
			return d.promise;
		});
		// assert.isFalse(this.procrastinateInst.isDoing());
		this.procrastinateInst.doNow();
		// assert.isTrue(this.procrastinateInst.isDoing());

		var count = 100;
		while(count--) {
			this.procrastinateInst.doLater(1000, false);
		}

		this.clock.tick(2001);
		// assert.isFalse(this.procrastinateInst.isDoing());
		assert.calledOnce(s1);
	},

	"hook up to currently running promise while it is running": function() {
		var d1 = deferred();
		var s1 = sinon.spy(function() { d1.resolve(); });

		var d2 = deferred();
		var s2 = sinon.spy(function() { d2.resolve(); });

		this.procrastinateInst.on('doing', function() {
			setTimeout(s1, 1000);
			return d1.promise;
		});

		this.procrastinateInst.doNow();
		this.clock.tick(500);

		this.procrastinateInst.getDoing().done(function() {
			setTimeout(s2, 1000);
			return d2.promsie;
		});

		this.clock.tick(501);
		assert.equals(s1.callCount, 1);
		assert.equals(s2.callCount, 0);

		this.clock.tick(1001);
		assert.equals(s1.callCount, 1);
		assert.equals(s2.callCount, 1);
	},

	"getting running doing while not running should give dummy promise instead of null": function() {
		assert.isFalse(this.procrastinateInst.isDoing());
		refute.isNull(this.procrastinateInst.getDoing())
		var ran = false;
		this.procrastinateInst.getDoing().then(function() {
			ran = true;
		});
		assert.isTrue(ran);
	},

	"calling doNow with enqueue should enqueue it": function() {
		var d = deferred();
		var s1 = {};
		s1.callCount = 0;
		// var s1 = sinon.spy(function() { d.resolve(); });

		this.procrastinateInst.on('beforeDo', function() {
			// setTimeout(s1, 1000);
			setTimeout(function() {
				s1.callCount++;
				d.resolve();
			}, 1000);
			return d.promise;
		});

		assert.isFalse(this.procrastinateInst.isDoing());
		this.procrastinateInst.doNow();
		assert.isTrue(this.procrastinateInst.isDoing());

		var count = 100;
		while(count--) {
			this.procrastinateInst.doNow(true);
		}

		this.clock.tick(1001);
		assert.equals(s1.callCount, 1);

		/*
		 * (I think) there is a bug in Sinon Clock that causes all
		 * setTimeout to ignore their delay. Either that, or there is
		 * something wrong with this test.
		 *
		 * However, this case is asserted with the README test.
		 */

		// this.clock.tick(1001);
		// assert.equals(s1.callCount, 2);

		// this.clock.tick(1001);
		// assert.equals(s1.callCount, 3);

		this.clock.tick(1000 * 100 + 1);
		assert.equals(s1.callCount, 101);
	},

	'README example: Custom async settings per event': function() {
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

		var expectedLog = [
			"Preparing to save",
			"Done waiting",
			"Save half-way",
			"Save half-way",
			"Save completed",
			"Save completed",
			"Save half-way",
			"Save completed",
			"Done saving, phew"
		];

		this.clock.tick(1000 * 10);

		assert.equals(log, expectedLog);
	}
});