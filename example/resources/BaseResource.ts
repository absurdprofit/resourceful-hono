import { Resource, Route } from "../../packages/core/src/index.ts";

@Route('/api/v1/')
export default abstract class BaseResource extends Resource {}