export interface ServerSentEventInit {
  data?: unknown;
  comment?: string;
  id?: number;
}

export class ServerSentEvent extends Event {
  readonly data?: unknown;
  readonly comment?: string;
  readonly id?: number;

  constructor(type: string, eventInitDict?: ServerSentEventInit) {
    super(type, { bubbles: false, cancelable: false, composed: false });
    this.id = eventInitDict?.id;
    this.data = eventInitDict?.data;
    this.comment = eventInitDict?.comment;
  }

  override toString(): string {
    let event = '';
    if (this.id)
      event += `id: ${this.id}\n`;
    if (this.type)
      event += `event: ${this.type}\n`;
    if (this.data)
      event += `data: ${typeof this.data === "string" ? this.data : JSON.stringify(this.data)}\n`
    if (this.comment)
      event += `: ${this.comment}`;

    event += '\n\n';
    return event;
  }
}