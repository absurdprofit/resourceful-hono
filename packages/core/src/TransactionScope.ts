/**
 * Error thrown when a `TransactionScope` completes without being explicitly marked as complete.
 *
 * Indicates that the transaction was rolled back instead of committed.
 *
 */
export class RollbackError extends Error {
  constructor() {
    super('rollback');
    this.message = 'If you are seeing this error, make sure to call TransactionScope.complete().';
  }
}

/**
 * Options used to configure a `TransactionScope`.
 *
 * @property commit - Function to call when the transaction is successful.
 * @property rollback - Function to call if the transaction fails or is incomplete.
 */
export interface TransactionScopeOptions {
  commit: () => void | Promise<void>;
  rollback: () => void | Promise<void>;
}

/**
 * Manages a transactional context that ensures either a commit or rollback occurs.
 *
 * Should be used with `await using` to automatically trigger commit or rollback logic.
 * Call `complete()` to mark the transaction as successful. Otherwise, rollback is triggered.
 *
 * @example
 * ```ts
 * await using transaction = new TransactionScope({
 *   commit: async () => await db.commit(),
 *   rollback: async () => await db.rollback()
 * });
 *
 * // do work...
 * transaction.complete(); // must be called to avoid rollback
 * ```
 */
export class TransactionScope {
  #complete = false;
  readonly #rollback: () => void | Promise<void>;
  readonly #commit: () => void | Promise<void>;

  constructor(options: TransactionScopeOptions) {
    this.#commit = options.commit;
    this.#rollback = options.rollback;
  }

  /**
   * Marks the transaction scope as complete.
   * @example
   * ```ts
   * await using transaction = new TransactionScope({
   *   commit: async () => await db.commit(),
   *   rollback: async () => await db.rollback()
   * });
   *
   * // do work...
   * transaction.complete(); // must be called to avoid rollback
   */
  public complete = (): void => {
    this.#complete = true;
  };

  public async [Symbol.asyncDispose]() {
    if (this.#complete) {
      await this.#commit();
    } else {
      await this.#rollback();
      throw new RollbackError();
    }
  }
}