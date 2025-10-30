type BuilderCall<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => T
    ? [K, ...A]
    : never;
}[keyof T];

type QueryBuilderInstance<T extends object> = {
  [K in keyof T as T[K] extends (...args: infer _A) => T ? K : never]:
    T[K] extends (...args: infer A) => unknown
      ? (...args: A) => QueryBuilderInstance<T>
      : never;
} & {
  serialise: () => BuilderCall<T>[];
}

interface QueryBuilderConstructor {
  new <T extends object>(): QueryBuilderInstance<T>;
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

type Builder<T> = {
  [K in keyof T as T[K] extends (...args: infer _A) => T ? K : never]: T[K];
}
export function WithBuilder<T extends Builder<T>>(
  previousValue: T,
  currentValue: BuilderCall<T>
) {
  const [methodName, ...args] = currentValue;
  return previousValue[methodName](...args);
}