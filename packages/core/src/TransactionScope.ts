export class RollbackError extends Error {
  constructor() {
    super('rollback');
    this.message = 'If you are seeing this error, make sure to call TransactionScope.complete().';
  }
}

export interface TransactionScopeOptions {
  commit: () => void | Promise<void>;
  rollback: () => void | Promise<void>;
}

export class TransactionScope {
  #complete = false;
  readonly #rollback: () => void | Promise<void>;
  readonly #commit: () => void | Promise<void>;

  constructor(options: TransactionScopeOptions) {
    this.#commit = options.commit;
    this.#rollback = options.rollback;
  }

  public complete = (): void => {
    this.#complete = true;
  }

  async [Symbol.asyncDispose]() {
    if (this.#complete) {
      await this.#commit();
    } else {
      await this.#rollback();
      throw new RollbackError();
    }
  }
}