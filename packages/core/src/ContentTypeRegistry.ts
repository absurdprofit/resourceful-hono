import { RegExpRouter } from 'hono/router/reg-exp-router';
import { SmartRouter } from 'hono/router/smart-router';
import { TrieRouter } from 'hono/router/trie-router';
import { ContentTypes, Headers } from './common/enums.ts';
import { GenericHttpError } from './common/errors.ts';
import { createReadableFromIterable, toFormData } from './common/utils.ts';
import { EventSource } from 'eventsource';
import { FIRST_INDEX, LAST_INDEX, SINGLE_ELEMENT_LENGTH } from './common/constants.ts';

export interface ContentTypeHandler {
  encode: (data: unknown, contentType?: string) => BodyInit | null | Promise<BodyInit | null>;
  decode: (resource: Request | Response) => unknown | Promise<unknown>;
}

export class ContentTypeRegistry {
  readonly #router = new SmartRouter<ContentTypeHandler>({
    routers: [new RegExpRouter(), new TrieRouter()],
  });

  public use(method: string, pattern: string | string[], handler: ContentTypeHandler) {
    if (typeof pattern === 'string')
      pattern = [pattern];

    pattern.forEach(pattern => {
      pattern = pattern === '*/*' ? '*' : pattern;
      pattern = pattern.split(';')[0];
      this.#router.add(
        method,
        pattern.replaceAll(':', ';').toLowerCase(),
        handler
      );
    });
  }

  public get(method: string, contentType: string) {
    contentType = contentType.split(';')[0];
    return this.#router.match(
      method,
      contentType.replaceAll(':', ';').toLowerCase()
    )
      .at(FIRST_INDEX)
      ?.at(LAST_INDEX)
      ?.at(FIRST_INDEX) as ContentTypeHandler | undefined;
  }

  public static get default() {
    const router = new ContentTypeRegistry();
    router.use('*', [
      ContentTypes.Json,
      ContentTypes.ProblemDetails,
    ], {
      async decode(resource) {
        const json = await resource.json();
        if (resource.headers.get(Headers.ContentType) === ContentTypes.ProblemDetails)
          return new GenericHttpError(json);
        return json;
      },
      encode(object) {
        return JSON.stringify(object);
      },
    });
    router.use('*', [
      ContentTypes.FormUrlEncoded,
      ContentTypes.MultipartFormData,
    ], {
      decode(resource) {
        return resource
          .formData()
          .then(formData => 
            formData.keys().reduce((object, key) => {
              const values = formData.getAll(key);
              if (values.length === SINGLE_ELEMENT_LENGTH)
                object[key] = values[0];
              else
                object[key] = values;
              return object;
            }, {} as Record<string, FormDataEntryValue | FormDataEntryValue[]>)
          );
      },
      encode(data) {
        return toFormData(data);
      },
    });
    router.use('*', [
      ContentTypes.ServerSentEvent,
      ContentTypes.OctetStream,
    ], {
      decode(resource) {
        if (resource.headers.get(Headers.ContentType)?.startsWith(ContentTypes.ServerSentEvent)) {
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
      encode(data, contentType) {
        if (typeof data === 'function') {
          let stream = createReadableFromIterable(data());
          if (contentType?.startsWith(ContentTypes.ServerSentEvent))
            stream = stream.pipeThrough(new TextEncoderStream());
          return stream;
        }
        if (data instanceof ReadableStream)
          return data;
        throw new TypeError('Only generators or ReadableStreams can be turned into Resource streams');
      },
    });
    router.use('*', [ContentTypes.PlainText], {
      decode(resource) {
        return resource.text();
      },
      encode(data) {
        return String(data);
      },
    });
  
    return router;
  }
}