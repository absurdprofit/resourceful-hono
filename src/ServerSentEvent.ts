export interface ServerSentEventInit {
  data?: unknown;
  comment?: string;
}

export class ServerSentEvent extends Event {
  override type: string;
  readonly data?: unknown;
  readonly comment?: string;

  constructor(type: string, eventInitDict?: ServerSentEventInit) {
    super(type, { bubbles: false, cancelable: false, composed: false });
    this.type = type;
    this.data = eventInitDict?.data;
    this.comment = eventInitDict?.comment;
  }

  override toString() {
    let event = '';
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