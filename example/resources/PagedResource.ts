import { FromQuery, HttpStatusCodes, PagedResult, WithBuilder } from '@resourceful-hono/core';
import BaseResource from './BaseResource.ts';
import { z } from 'zod';

const MIN_SKIP = 1;
const MIN_TAKE = 10;
const MAX_TAKE = 50;
const BuilderSchema = z.array(
  z.union([
    z.tuple([z.literal('leftJoinAndSelect'), z.string(), z.string()]),
    z.tuple([z.literal('skip'), z.coerce.number().min(MIN_SKIP)]),
    z.tuple([z.literal('take'), z.coerce.number().min(MIN_TAKE).max(MAX_TAKE)]),
    z.tuple([
      z.literal('orderBy'),
      z.string(),
      z.union([z.literal('DESC'), z.literal('ASC')]),
    ]),
  ])
);

export class PagedResource extends BaseResource {
  public async GET(@FromQuery(BuilderSchema) query: z.infer<typeof BuilderSchema>) {
    const queryBuilder = new PageBuilder()
      .createQueryBuilder('user');
    const result = await query.reduce(WithBuilder, queryBuilder).getManyAndCount();
    return PagedResult(HttpStatusCodes.Ok, result, undefined, {
      url: this.request.url,
      pagination: {
        next: query,
      },
    });
  }
}

export class PageBuilder {
  private readonly operations: string[] = [];

  public createQueryBuilder(alias: string) {
    this.operations.push(`createQueryBuilder(${alias})`);
    return this;
  }

  public leftJoinAndSelect(join: string, alias: string) {
    this.operations.push(`leftJoinAndSelect(${join}, ${alias})`);
    return this;
  }

  public where(condition: string, params?: Record<string, unknown>) {
    this.operations.push(`where(${condition}, ${JSON.stringify(params)})`);
    return this;
  }

  public andWhere(condition: string, params?: Record<string, unknown>) {
    this.operations.push(`andWhere(${condition}, ${JSON.stringify(params)})`);
    return this;
  }

  public orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC') {
    this.operations.push(`orderBy(${column}, ${direction})`);
    return this;
  }

  public skip(value: number) {
    this.operations.push(`skip(${value})`);
    return this;
  }

  public take(value: number) {
    this.operations.push(`take(${value})`);
    return this;
  }

  public getMany() {
    this.operations.push('getMany()');
    return Promise.resolve([{ id: Number(), name: 'demo' }]);
  }

  public getManyAndCount() {
    this.operations.push('getManyAndCount()');
    const result = [{ id: Number(), name: 'demo' }];
    return Promise.resolve([result, result.length]);
  }

  public build() {
    return this.operations.join(' -> ');
  }
}