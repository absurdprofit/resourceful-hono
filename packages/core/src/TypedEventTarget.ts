interface TypedEventListenerObject<E extends Event> {
  handleEvent(object: E): void;
}
interface TypedEventListener<E extends Event> {
  (evt: E): void;
}
type TypedEventListenerOrEventListenerObject<E extends Event> = TypedEventListener<E> | TypedEventListenerObject<E>;

export class TypedEventTarget<EventMap extends { [K in keyof EventMap]: Event }> extends EventTarget {
  override addEventListener<K extends keyof EventMap>(type: K, listener: TypedEventListenerOrEventListenerObject<EventMap[K]> | null, options?: boolean | AddEventListenerOptions): void;
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
    return super.addEventListener(type, listener, options);
  }

  override removeEventListener<K extends keyof EventMap>(type: K, listener: TypedEventListenerOrEventListenerObject<EventMap[K]> | null, options?: EventListenerOptions | boolean): void;
  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) {
    return super.removeEventListener(type, listener, options);
  };
}