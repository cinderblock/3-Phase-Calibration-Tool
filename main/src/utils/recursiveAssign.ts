import { RecursivePartial } from './RecursivePartial';

/**
 * Iterate over enumerable properties of `update` and assign new values to `target`.
 *
 * @param target Object to write to
 * @param update New values to write
 */
export function recursiveAssign<T extends {}>(target: T, update: RecursivePartial<T>): void {
  // TODO: Handle circular references
  for (const key in update) {
    type U = T[Extract<keyof T, string>];
    if (typeof update[key] === 'object') {
      recursiveAssign(target[key as keyof T], update[key] as RecursivePartial<U>);
    } else {
      target[key as keyof T] = update[key] as U;
    }
  }
}
