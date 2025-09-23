// import { Hono } from 'hono';
// import { Application, Inject, Resource, Result } from './index.ts';
// import { FromBody } from './common/decorators.ts';
// import { z } from 'zod';

// Deno.bench('Result', async () => {
//   await Result(200, 1);
// });

// const contentType = Math.random() > 0.5 ? 'application/json' : 'text/plain';
// Deno.bench('contentTypes.get', () => {
//   Resource
//     .contentTypes
//     .get(contentType ?? '');
// });

// const app = Application.instance;

// class TestResource extends Resource {
//   private static count = 0;
//   GET() {
//     return Result(200, { count: ++TestResource.count });
//   }

//   POST(@FromBody(z.object({ name: z.string() })) body: { name: string }) {
//     return Result(201, { name: body.name });
//   }

// 	DELETE() {}
// }

// app.registerResources([TestResource]);

// class TestService {
// 	hello() {
// 		return 'hello';
// 	}
// }

// class Test {
// 	@Inject()
// 	declare public service: TestService;
// }

// app.registerService(TestService, new TestService());

// const fetch = new Request('http://localhost/test')
// let res = await app.fetch(fetch);
// res = await app.fetch(fetch);
// console.log(res.status, res.headers.get('Date'));
// Deno.bench('fetch', async () => {
//   await app.fetch(fetch);
// });

// const notFound = new Request('http://localhost/');
// Deno.bench('fetch NOT Found', async () => {
//   await app.fetch(notFound);
// });

// const post = new Request('http://localhost/test', {
//   method: 'POST',
//   body: JSON.stringify({ name: 'test' }),
//   headers: { 'Content-Type': 'application/json' },
// });
// Deno.bench('fetch POST', async () => {
//   await app.fetch(post.clone());
// });

// const noContent = new Request('http://localhost/test', {
//     method: 'DELETE',
//     headers: { 'Content-Type': 'application/json' },
//   });
// Deno.bench('fetch no content', async () => {
//   await app.fetch(noContent);
// });

// Deno.bench('getService', () => {
// 	app.getService(TestService);
// });

// const test = new Test();
// Deno.bench('getService integrated', () => {
// 	test.service;
// });

// const rootHono = new Hono({ strict: true });
// const hono = new Hono({ strict: true }).basePath('/test');
// hono.get('', (c) => {
//   return c.json(1);
// });
// hono.options('*', (c) => {
//   return c.text('1');
// });
// hono.all('*', (c) => {
//   return c.text('2', { status: 405 });
// });
// rootHono.route('', hono);

// res = await rootHono.fetch(fetch);
// console.log(rootHono.router, res.status);

// Deno.bench('hono fetch', async () => {
//   await rootHono.fetch(fetch);
// });