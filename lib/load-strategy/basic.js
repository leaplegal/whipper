"use-strict";
var joi = require('joi');
var whipperUtil = require('../util');

var optionsSchema = joi.compile({

  /**
   * The minimum number of workers that will be maintained.
   */
  minWorkers: joi.number()
    .integer()
    .min(1)
    .default(1),

  /**
   * The maximum number of workers that will be maintained.
   */
  maxWorkers: joi.number()
    .integer()
    .min(joi.ref('minWorkers'))
    .default(require('os').cpus().length)
});

/**
 *
 * @param pool
 * @param options
 * @constructor
 */
function BasicLoadStrategy(pool, emitter, options) {
  options = whipperUtil.validateOptions(options, optionsSchema);

  this._pool = pool;
  this._emitter = emitter;
  this._options = options;
}

/**
 *
 * @param def
 * @private
 */
BasicLoadStrategy.prototype._selectAvailableWorker = function(def) {
  var worker = this._pool.idleWorker() || this._pool.busyWorker();
  def.resolve(worker);
};

/**
 *
 * @param def
 * @private
 */
BasicLoadStrategy.prototype._awaitAvailableWorker = function(def) {
  this._emitter.once("worker:pool:available", function(worker) {
    def.resolve(worker);
  });
};


/**
 *
 * @param def
 * @private
 */
BasicLoadStrategy.prototype._addWorker = function(def) {
  this._pool.addWorker().then(function(worker) {
    def.resolve(worker);
  }).catch(function(err) {
    def.reject(err);
  });
};

/**
 *
 * @return {boolean}
 */
BasicLoadStrategy.prototype.atCapacity = function() {
  return this._pool.availableWorkerCount() === 0 &&
      this._pool.workerCount() >= this._options.maxWorkers;
};

/**
 *
 * @return {Promise}
 */
BasicLoadStrategy.prototype.selectWorker = function() {
  return new Promise(function(resolve, reject) {
    var def = {
      resolve: resolve,
      reject: reject
    };

    this._pool.ensureMinimumWorkers(this._options.minWorkers).then(function() {
      if (this._pool.availableWorkerCount() === 0) {
        if (this._pool.workerCount() >= this._options.maxWorkers) {
          this._awaitAvailableWorker(def);
        } else {
          this._addWorker(def);
        }
      } else {
        this._selectAvailableWorker(def);
      }
    }.bind(this)).catch(function(err) {
      reject(err);
    });
  }.bind(this));
};

module.exports = BasicLoadStrategy;
