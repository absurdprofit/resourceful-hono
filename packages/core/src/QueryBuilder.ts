type BuilderCall<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => unknown
    ? [K, ...A]
    : never;
}[keyof T];

type QueryBuilderInstance<QB extends object> = {
  [K in keyof QB as QB[K] extends (...args: infer _A) => QB ? K : never]:
    QB[K] extends (...args: infer A) => unknown
      ? (...args: A) => QueryBuilderInstance<QB>
      : never;
} & {
  serialise: () => BuilderCall<QB>[];
}

interface QueryBuilderConstructor {
  new <QB extends object>(): QueryBuilderInstance<QB>;
}

export const QueryBuilder: QueryBuilderConstructor = class <T> {
  private readonly callStack: BuilderCall<T>[] = [];

  constructor() {
    const { callStack } = this;
		const serialise = () => {
      return this.callStack;
    };

    const proxy = new Proxy(this, {
      get(_, key: string) {
				switch (key) {
					case 'serialise':
						return serialise;
					default:
						return (...args: unknown[]) => {
							callStack.push([key, ...args] as BuilderCall<T>);
							return proxy;
						};
				}
      },
    });

		return proxy;
  }
} as unknown as QueryBuilderConstructor;