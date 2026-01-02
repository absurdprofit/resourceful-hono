import type { z } from 'zod';
import { InitialisationError } from '../InitialisationError.ts';

interface EnvironmentServiceOptions {
  initialisationErrorCode: number;
  schema: z.AnyZodObject;
}

export class EnvironmentService {
  private readonly variables;

  constructor(env: object, options: EnvironmentServiceOptions) {
    const result = options.schema.safeParse(env);
    if (result.success) {
      this.variables = result.data;
    } else {
      const { initialisationErrorCode: code } = options;
      const formatted = result.error.format();
      const reformatted = Object
        .entries(formatted)
        .reduce((previous, [key, value]) => {
          if (Array.isArray(value))
            return previous;
          previous[key] = value?._errors ?? [];
          return previous;
        }, {} as Record<string, string[]>);
      throw new InitialisationError(
        'Environment misconfiguration detected.',
        { cause: reformatted, code }
      );
    }
  }

  public get<K extends keyof EnvironmentService['variables']>(key: K): EnvironmentService['variables'][K] {
    return this.variables[key];
  }
}