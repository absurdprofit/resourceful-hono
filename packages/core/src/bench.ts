// import { Hono } from 'hono';
// import { Application, Resource, Result } from './index.ts';
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
//     // return new Response(JSON.stringify(1), { status: 200 });
//     return Result(200, { count: ++TestResource.count });
//   }

//   POST(@FromBody(z.object({ name: z.string() })) body: { name: string }) {
//     return Result(201, { name: body.name });
//   }
// }

// app.registerResources([TestResource]);

// let res = await app.fetch(new Request('http://localhost/test'));
// console.log(res.status, res.headers.get('Date'));
// Deno.bench('fetch', async () => {
//   await app.fetch(new Request('http://localhost/test'));
// });

// Deno.bench('fetch NOT Found', async () => {
//   await app.fetch(new Request('http://localhost/'));
// });

// Deno.bench('fetch POST', async () => {
//   await app.fetch(new Request('http://localhost/test', {
//     method: 'POST',
//     body: JSON.stringify({ name: 'test' }),
//     headers: { 'Content-Type': 'application/json' },
//   }));
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

// res = await rootHono.fetch(new Request('http://localhost/test'));
// console.log(rootHono.router, res.status);

// Deno.bench('hono fetch', async () => {
//   await rootHono.fetch(new Request('http://localhost/test'));
// });