export enum Headers {
  Allow = 'Allow',
  Authorization = 'Authorization',
  TraceId = 'X-Trace-ID',
  ContentType = 'Content-Type',
  ForwardedFor = 'X-Forwarded-For',
  UserAgent = 'User-Agent',
  ResponseTime = 'X-Response-Time',
  Timestamp = 'X-Timestamp'
}

export enum ContentTypes {
  ProblemDetails = 'application/problem+json',
  Json = 'application/json',
  MultipartFormData = 'multipart/form-data',
  FormUrlEncoded = 'application/x-www-form-urlencoded'
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
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  MethodNotAllowed = 405,
  Conflict = 409,
  UnsupportedMediaType = 415,
  DependencyFailed = 424,
  InternalServerError = 500,
  NotImplemented = 501
}