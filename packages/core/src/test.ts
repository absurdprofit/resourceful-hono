import { z } from "zod";
import { QueryBuilder, WithBuilder } from "./QueryBuilder.ts";
import { PagedResult } from "./Resource.ts";
import { deserialiseQuery, serialiseQuery } from "./common/utils.ts";

class MyBuilder {
  id: number | null = null;
  name: string | null = null;
  email: string | null = null;
  setUserId(id: number) {
    this.id = id;
    return this;
  }

  setUsername(name: string) {
    this.name = name;
    return this;
  }

  setEmail(email: string) {
    this.email = email;
    return this;
  }

  finalMethod() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
    }
  }
}

const builder = new QueryBuilder<MyBuilder>()
  .setUserId(10)
	.setUsername("john_doe")
	.setEmail("john@example.com")
  .serialise();

const BuilderCallSchema = z.union([
  z.tuple([z.literal("setUserId"), z.number()]),
  z.tuple([z.literal("setUsername"), z.string()]),
  z.tuple([z.literal("setEmail"), z.string()]),
]);

const json: z.infer<typeof BuilderCallSchema>[] = builder;
console.log(json);
console.log(json.reduce(WithBuilder, new MyBuilder()));

const paged = PagedResult(200, json, undefined, {
  url: 'https://api.example.com/users?page=2',
  next: {
    page: 3,
    size: 12
  },
  previous: {
    page: 1,
    size: 12
  }
});
paged.then(result => {
  console.log(result.headers.get('Link'));
})

Deno.bench('Result', async () => {
  await PagedResult(200, json);
});

Deno.bench('PagedResult', async () => {
  await PagedResult(200, json, undefined, {
    url: 'https://api.example.com/users?page=2',
    next: {
      page: 3,
      size: 12
    },
    previous: {
      page: 1,
      size: 12
    }
  });
});

Deno.bench('URLSearchParams', () => {
  new URLSearchParams([
    ['hello', 'world'],
    ['world', 'hello']
  ]).toString();
});

Deno.bench('deserialiseQuery', () => {
  deserialiseQuery([
    ['hello', 'world'],
    ['world', 'hello']
  ]);
});

Deno.bench('serialiseQuery', () => {
  serialiseQuery([
    ['hello', 'world'],
    ['world', 'hello']
  ]);
});