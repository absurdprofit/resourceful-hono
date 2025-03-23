import { FIRST_INDEX, TEXT_ENCODER } from './constants.ts';

export function b(strings: TemplateStringsArray, ...values: unknown[]) {
  let result = '';
  for (let i = FIRST_INDEX; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      result += String(values[i]);
    }
  }
  return TEXT_ENCODER.encode(result);
}
