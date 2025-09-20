import { Hono } from "hono";
import { Application, Resource, Result } from "./index.ts";

Deno.bench('Result', async () => {
	await Result(200, 1);
});

const app = Application.instance;

class TestResource extends Resource {
	increment = 0;
	GET() {
		return new Response(JSON.stringify(1), { status: 200 });
		// return Result(200, ++this.increment);
	}
}

app.registerResources([TestResource]);

let res = await app.fetch(new Request('http://localhost/test'));
console.log(res.status, res.headers.get('Date'));
Deno.bench('fetch', async () => {
	await app.fetch(new Request('http://localhost/test'));
});

const rootHono = new Hono({ strict: true });
const hono = new Hono({ strict: true }).basePath('/test');
hono.get('', (c) => {
	return c.json(1);
});
hono.options('*', (c) => {
	return c.text('1');
});
hono.all('*', (c) => {
	return c.text('2', { status: 405 });
});
rootHono.route('', hono);

res = await rootHono.fetch(new Request('http://localhost/test'));
console.log(rootHono.router, res.status);

Deno.bench('hono fetch', async () => {
	await rootHono.fetch(new Request('http://localhost/test'));
});