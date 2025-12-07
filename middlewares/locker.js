// middleware/locker.js

class Locker {
  constructor() {
    this.locks = new Map();
  }

  /**
   * Acquire a lock and run the callback.
   * Automatically releases lock afterwards.
   * @param {string} key
   * @param {function} callback - an async function
   * @param {number} timeoutMs - fail if lock not released in time
   */
  async withLock(key, callback, timeoutMs = 8000) {
    // wait until lock free
    await this._acquire(key, timeoutMs);

    try {
      // run protected code
      return await callback();
    } finally {
      // always unlock
      this._release(key);
    }
  }

  _acquire(key, timeoutMs) {
    return new Promise((resolve, reject) => {
      const start = Date.now();

      const attempt = () => {
        // lock is free → place lock and continue
        if (!this.locks.has(key)) {
          this.locks.set(key, true);
          return resolve();
        }

        // lock timeout
        if (Date.now() - start > timeoutMs) {
          return reject(new Error(`Lock timeout on key: ${key}`));
        }

        // retry every 25ms
        setTimeout(attempt, 25);
      };

      attempt();
    });
  }

  _release(key) {
    this.locks.delete(key);
  }
}

module.exports = new Locker();