export interface AsyncLogData {
  payload?: object;
  tags?: string[];
}

export abstract class AsyncLogService {
  public abstract debug(message: string, data?: AsyncLogData): void;
  public abstract info(message: string, data?: AsyncLogData): void;
  public abstract warn(message: string, error?: Error | null, data?: AsyncLogData): void;
  public abstract error(error: Error, data?: AsyncLogData): void;
  public abstract flush(): void;
}