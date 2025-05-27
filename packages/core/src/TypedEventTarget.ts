interface TypedEventListenerObject<E extends Event> {
  handleEvent(object: E): void;
}
interface TypedEventListener<E extends Event> {
  (evt: E): void;
}
type TypedEventListenerOrEventListenerObject<E extends Event> = TypedEventListener<E> | TypedEventListenerObject<E>;

export class TypedEventTarget<EventMap extends { [K in keyof EventMap]: Event }> extends EventTarget {
  public override addEventListener<K extends keyof EventMap>(type: K, listener: TypedEventListenerOrEventListenerObject<EventMap[K]> | null, options?: boolean | AddEventListenerOptions): void;
  public override addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  public override addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
    return super.addEventListener(type, listener, options);
  }

  public override removeEventListener<K extends keyof EventMap>(type: K, listener: TypedEventListenerOrEventListenerObject<EventMap[K]> | null, options?: EventListenerOptions | boolean): void;
  public override removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
  public override removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) {
    return super.removeEventListener(type, listener, options);
  };
}