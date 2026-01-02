interface InitialisationErrorOptions extends ErrorOptions {
  code: number;
}

export class InitialisationError extends Error {
  public readonly code: number;

  constructor(message: string, options: InitialisationErrorOptions) {
    super(message, options);

    this.code = options.code;
  }
}