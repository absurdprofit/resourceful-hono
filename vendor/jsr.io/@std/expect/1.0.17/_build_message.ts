// Copyright 2018-2025 the Deno authors. MIT license.

import { buildMessage } from "jsr:@std/internal@^1.0.10/build-message";
import { diff } from "jsr:@std/internal@^1.0.10/diff";
import { diffStr } from "jsr:@std/internal@^1.0.10/diff-str";
import { format } from "jsr:@std/internal@^1.0.10/format";
import type { EqualOptions } from "./_types.ts";

type EqualErrorMessageOptions = Pick<
  EqualOptions,
  "formatter" | "msg"
>;

function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function buildEqualErrorMessage<T>(
  actual: T,
  expected: T,
  options: EqualErrorMessageOptions = {},
): string {
  const { formatter = format, msg } = options;
  const msgPrefix = msg ? `${msg}: ` : "";
  const actualString = formatter(actual);
  const expectedString = formatter(expected);

  let message = `${msgPrefix}Values are not equal.`;

  const stringDiff = isString(actual) && isString(expected);
  const diffResult = stringDiff
    ? diffStr(actual, expected)
    : diff(actualString.split("\n"), expectedString.split("\n"));
  const diffMsg = buildMessage(diffResult, { stringDiff }).join("\n");
  message = `${message}\n${diffMsg}`;

  return message;
}

export function buildNotEqualErrorMessage<T>(
  actual: T,
  expected: T,
  options: EqualErrorMessageOptions = {},
): string {
  const { formatter = format, msg } = options;
  const actualString = formatter(actual);
  const expectedString = formatter(expected);

  const msgPrefix = msg ? `${msg}: ` : "";
  return `${msgPrefix}Expected actual: ${actualString} not to be: ${expectedString}.`;
}
