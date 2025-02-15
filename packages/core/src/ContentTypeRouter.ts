import { SmartRouter } from "hono/router/smart-router";
import { RegExpRouter } from "hono/router/reg-exp-router";
import { TrieRouter } from "hono/router/trie-router";
import { ContentTypes, Headers } from "./common/enums.ts";
import { createReadableFromIterable, toFormData } from "./common/utils.ts";
import { EventSource } from "eventsource";
import { GenericHttpError } from "./common/errors.ts";

export interface ContentTypeHandler {
  encode: (data: unknown) => BodyInit | null | Promise<BodyInit | null>;
  decode: (resource: Request | Response) => unknown | Promise<unknown>;
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
    this.use(ContentTypes.Json, {
      decode(resource) {
        return resource.json();
      },
      encode(object) {
        return JSON.stringify(object);
      },
    });
    this.use(ContentTypes.ProblemDetails, {
      async decode(resource) {
        return new GenericHttpError(await resource.json());
      },
      encode(data) {
        return JSON.stringify(data);
      },
    });
    this.use([
      ContentTypes.FormUrlEncoded,
      ContentTypes.MultipartFormData
    ], {
      decode(resource) {
        return resource
          .formData()
          .then(formData => 
            Object.fromEntries(formData.entries())
          );
      },
      encode(data) {
        return toFormData(data);
      },
    });
    this.use('*-stream', {
      decode(resource) {
        if (resource.headers.get(Headers.ContentType) === ContentTypes.ServerSentEvent) {
          let response;
          if (resource instanceof Request)
            response = new Response(
              resource.body,
              { headers: resource.headers }
            );
          else
            response = resource;

          return new EventSource(
            resource.url,
            { fetch: () => Promise.resolve(response) }
          );
        } else {
          return resource.body;
        }
      },
      encode(data) {
        if (typeof data === 'function') {
          return createReadableFromIterable(data());
        }
        if (data instanceof ReadableStream)
          return data;
        throw new TypeError('Only generators or ReadableStreams can be turned into Resource streams');
      },
    });
  }
}