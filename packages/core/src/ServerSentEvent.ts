/**
 * Initialization options for a `ServerSentEvent`.
 *
 * @property data - The payload of the event. Will be JSON serialized if not a string.
 * @property comment - Optional comment line (`: comment`) sent before the event.
 * @property id - Optional event ID for `Last-Event-ID` tracking.
 */
export interface ServerSentEventInit<T> {
  data?: T;
  comment?: string;
  id?: number;
}

/**
 * Represents a single Server-Sent Event (SSE) formatted for transmission to a client.
 *
 * Extends the native `Event` class and provides a `toString()` method
 * that formats the event according to the SSE spec (RFC 8599).
 *
 * @extends {Event}
 *
 * @example
 * ```ts
 * const event = new ServerSentEvent('message', {
 *   data: { user: 'nate' },
 *   id: 42,
 *   comment: 'heartbeat'
 * });
 *
 * return Result(200, function* () { yield event; });
 * ```
 */
export class ServerSentEvent<T> extends Event {
  public readonly data?: T;
  public readonly comment?: string;
  public readonly id?: number;

  constructor(type: string, eventInitDict?: ServerSentEventInit<T>) {
    super(type, { bubbles: false, cancelable: false, composed: false });
    this.id = eventInitDict?.id;
    this.data = eventInitDict?.data;
    this.comment = eventInitDict?.comment;
  }

  public override toString(): string {
    let event = '';
    if (this.id)
      event += `id: ${this.id}\n`;
    if (this.type)
      event += `event: ${this.type}\n`;
    if (this.data)
      event += `data: ${JSON.stringify(this.data)}\n`;
    if (this.comment)
      event += `: ${this.comment}`;

    event += '\n\n';
    return event;
  }

  public static from<T>(data: T, eventType = 'message', id?: number, comment?: string) {
    return new ServerSentEvent<T>(eventType, { data, id, comment });
  }
}