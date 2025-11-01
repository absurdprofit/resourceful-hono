export enum Headers {
  Allow = 'allow',
  Authorization = 'authorization',
  CacheControl = 'cache-control',
  Connection = 'connection',
  Traceparent = 'traceparent',
  Location = 'location',
  ContentType = 'content-type',
  ContentLength = 'content-length',
  UserAgent = 'user-agent',
  Date = 'date',
  ServerTiming = 'server-timing',
  Link = 'link',
}

export enum ContentTypes {
  ProblemDetails = 'application/problem+json',
  Json = 'application/json',
  OctetStream = 'application/octet-stream',
  MultipartFormData = 'multipart/form-data',
  FormUrlEncoded = 'application/x-www-form-urlencoded',
  ServerSentEvent = 'text/event-stream',
  PlainText = 'text/plain'
}

export enum RequestMethod {
  Get = 'GET',
  Delete = 'DELETE',
  Head = 'HEAD',
  Options = 'OPTIONS',
  Patch = 'PATCH',
  Post = 'POST',
  Put = 'PUT',
}

export enum HttpStatusCodes {
  Ok = 200,
  Created = 201,
  Accepted = 202,
  NoContent = 204,
  MultipleChoices = 300,
  Found = 302,
  SeeOther = 303,
  TemporaryRedirect = 307,
  PermanentRedirect = 308,
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  MethodNotAllowed = 405,
  Conflict = 409,
  UnsupportedMediaType = 415,
  UnprocessableContentError = 422,
  DependencyFailed = 424,
  InternalServerError = 500,
  NotImplemented = 501,
  ServiceUnavailable = 503
}