import { z } from "zod";
import { QueryBuilder, WithBuilder } from "./QueryBuilder.ts";

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