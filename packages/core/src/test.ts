import { z } from "zod";
import { QueryBuilder } from "./QueryBuilder.ts";

class MyBuilder {
  setUserId(id: number) {
    return this;
  }

  setUsername(name: string) {
    return this;
  }

  setEmail(email: string) {
    return this;
  }

  finalMethod() {

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
  z.tuple([z.literal("finalMethod")]),
]);

const json: z.infer<typeof BuilderCallSchema>[] = builder;
console.log(json);