import { SmartRouter } from "hono/router/smart-router";
import { RegExpRouter } from "hono/router/reg-exp-router";
import { TrieRouter } from "hono/router/trie-router";
import { ContentTypes } from "./common/enums.ts";
import { parseBody } from "hono/utils/body";
import { toFormData } from "./common/utils.ts";

export interface ContentTypeHandler {
  encode: (object: unknown, init: ResponseInit) => Response | Promise<Response>;
  decode: (request: Request) => object | Promise<unknown>;
}

export class ContentTypeRouter {
  readonly #router = new SmartRouter<ContentTypeHandler>({
    routers: [new RegExpRouter(), new TrieRouter()],
  });

  constructor() {
    this.#registerDefaultContentTypes();
  }

  public use(pattern: string | string[], handler: ContentTypeHandler) {
    if (typeof pattern === 'string')
      pattern = [pattern];

    pattern.forEach(pattern => {
      this.#router.add('', pattern.replaceAll(':', ';'), handler);
    });
  }

  public get(contentType: string) {
    return this.#router.match(
      '',
      contentType.replaceAll(':', ';')
    ).at(0)?.at(-1)?.at(0) as ContentTypeHandler | undefined;
  }

  #registerDefaultContentTypes() {
    this.use([ContentTypes.Json], {
      decode(request) {
        return request.json();
      },
      encode(object, init) {
        return Response.json(object, init);
      },
    });
    this.use([
      ContentTypes.FormUrlEncoded,
      ContentTypes.MultipartFormData
    ], {
      decode(request) {
        return parseBody(request);
      },
      encode(object, init) {
        return new Response(
          toFormData(object),
          init
        );
      },
    });
  }
}