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
      this.#router.add(
        method,
        pattern.toLowerCase(),
        handler
      );
    });
  }

  public get(method: string, contentType: string) {
    // Remove any parameters from the content type (e.g. charset)
    const semicolonIndex = contentType.indexOf(';');
    if (semicolonIndex !== LAST_INDEX) 
      contentType = contentType.slice(FIRST_INDEX, semicolonIndex);
    return this.#router.match(
      method,
      contentType.toLowerCase()
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
      ContentTypes.OctetStream,
    ], {
      decode(resource) {
        return resource.body;
      },
      encode(data) {
        if (typeof data === 'function')
          return createReadableFromIterable(data());
        else if (data instanceof ReadableStream)
          return data;
        throw new TypeError('Only generators or ReadableStreams can be turned into Resource streams');
      },
    });
    router.use('*', [
      ContentTypes.ServerSentEvent,
    ], {
      decode(resource) {
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
      },
      encode(data) {
        if (typeof data === 'function') {
          return createReadableFromIterable(data())
            .pipeThrough(new TextEncoderStream());
        }
        throw new TypeError('Only generators can be turned into Server Sent Event streams');
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