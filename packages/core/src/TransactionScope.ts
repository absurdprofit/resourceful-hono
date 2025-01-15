export interface TransactionScopeOptions {
  parent?: TransactionScope;
  commit: () => void | Promise<void>;
  rollback: () => void | Promise<void>;
}

export abstract class TransactionScope {
  readonly #scopes = new Set<TransactionScope>();
  #complete = false;
  readonly #rollback: () => void | Promise<void>;
  readonly #commit: () => void | Promise<void>;

  constructor(options: TransactionScopeOptions) {
    this.#commit = options.commit;
    this.#rollback = options.rollback;
    if (options.parent)
      options.parent.#scopes.add(this);
  }

  public complete = () => {
    this.#complete = true;
  }

  async [Symbol.asyncDispose]() {
    if (this.#complete) {
      await this.#commit();
    } else {
      await this.#rollback();
    }
  }
}