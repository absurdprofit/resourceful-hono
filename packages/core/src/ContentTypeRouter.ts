import { SmartRouter } from "hono/router/smart-router";
import { RegExpRouter } from "hono/router/reg-exp-router";

export interface ContentTypeHandler {
  encode: (data: unknown) => BodyInit | null | Promise<BodyInit | null>;
  decode: (resource: Request | Response) => unknown | Promise<unknown>;
}

export class ContentTypeRouter extends RegExpRouter<ContentTypeHandler> {
  readonly #router = new SmartRouter<ContentTypeHandler>({
    routers: [new RegExpRouter()],
  });

  public use(method: string, pattern: string | string[], handler: ContentTypeHandler) {
    if (typeof pattern === 'string')
      pattern = [pattern];

    pattern.forEach(pattern => {
      pattern = pattern === '*/*' ? '*' : pattern;
      this.#router.add(method, pattern.replaceAll(':', ';'), handler);
    });
  }

  public get(method: string, contentType: string) {
    contentType = contentType.split(';')[0];
    return this.#router.match(
      method,
      contentType.replaceAll(':', ';')
    ).at(0)?.at(-1)?.at(0) as ContentTypeHandler | undefined;
  }
}