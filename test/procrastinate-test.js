var buster = require('buster');
var assert = buster.referee.assert;
var refute = buster.referee.refute;
var sinon = require('sinon');
var deferred = require('deferred');

var procrastinate = require('../src/procrastinate');

sinon.assert.expose(assert);

buster.testCase('procrastinate.js', {
	setUp: function() {
		this.clock = sinon.useFakeTimers();
		this.procrastinateInst = new procrastinate();
	},
	tearDown: function() {
		this.clock.restore();
	},

	"api methods exists": function() {
		assert.isFunction(procrastinate);
		assert.isFunction(this.procrastinateInst.doLater);
		assert.isFunction(this.procrastinateInst.doNow);
		assert.isFunction(this.procrastinateInst.on);
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
		var l1 = sinon.spy();

		this.procrastinateInst.on('beforeDo', l1);
		assert.equals(l1.callCount, 0);
		this.procrastinateInst.doNow();
		assert.calledOnce(l1);
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

		this.clock.tick(100000);

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

		this.clock.tick(1001); // 3 sec later, when after do is done

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

	"// doing should complete before afterDo is called": function() {
		var l1 = sinon.spy();
		var l2 = sinon.spy();

		this.procrastinateInst.on('beforeDo', l1);
		this.procrastinateInst.on('afterDo', l2);
		this.procrastinateInst.on('doing', function() {
			var d = deferred();
			setTimeout(function() {
				d.resolve();
			}, 3000);
			return d.promise;
		});

		this.procrastinateInst.doNow();

		assert.calledOnce(l1);
		assert.equals(l2.callCount, 0);

		this.clock.tick(2000);

		assert.equals(l2.callCount, 0);

		this.clock.tick(3001);

		assert.calledOnce(l2);
	}
});