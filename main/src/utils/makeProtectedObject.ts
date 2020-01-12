export function makeObjectSetter<T extends {}>(
  internal: T,
  setters: {
    [P in keyof T]: (next: T[P]) => void;
  },
): T {
  const ret = {};

  for (const x in internal) {
    Object.defineProperty(ret, x, { set: setters[x], get: () => internal[x], enumerable: true });
  }

  return ret as T;
}

////// USAGE /////

/*

const myObject = {
  num: 42,
  str: 'initialValue',
};

const protectedObject = makeObjectSetter(myObject, {
  num(x) {
    // Make sure positive
    myObject.num = Math.max(x, 0);
  },
  str(s) {
    // Always double the input
    myObject.str = s + s;
  },
});

console.log('Before:', myObject);
protectedObject.num = -1;
protectedObject.str = 'a';
console.log('After:', myObject);

// Keys are enumerable
for (let x in protectedObject) {
  console.log(x, protectedObject[x as 'num' | 'str']);
}

//*/

/**
 * Which setter argument type should we use?
 */
// type SetterArgType = unknown;
type SetterArgType = any; // eslint-disable-line @typescript-eslint/no-explicit-any

type Setter = (next: SetterArgType) => void;

type SetterOrNested<T> = T extends object ? NestedSetters<T> : Setter;

type NestedSetters<T> = { [P in keyof T]: SetterOrNested<T[P]> };

function isNestedSetters<T>(value: NestedSetters<T> | Setter): value is NestedSetters<T> {
  return typeof value === 'object';
}

/**
 * Create a new "virtual" object that wraps a real one storing arbitrary data.
 *
 * This will return an object that, upon any sets, instead passes the value to a "setter" function.
 *
 * Reads will come from the base object.
 * @param internal Object to wrap
 * @param setters Functions to use to set new values
 */
export function makeObjectSetterRecursive<T extends {}>(internal: T, setters: NestedSetters<Required<T>>): T {
  const ret = {} as T;

  for (const x in setters) {
    type P = Extract<keyof T, string>;

    const setterOrNested = setters[x] as NestedSetters<Required<T[P]>> | Setter;

    const prop: PropertyDescriptor = { enumerable: true };

    if (isNestedSetters(setterOrNested)) {
      prop.value = makeObjectSetterRecursive(internal[x], setterOrNested);
    } else {
      if (!setterOrNested) throw Error('Invalid setter');
      prop.set = setterOrNested;
      prop.get = (): T[Extract<keyof T, string>] => internal[x];
    }

    Object.defineProperty(ret, x, prop);
  }

  return ret;
}

type SetterTyped<T = SetterArgType> = (next: T) => void;

type SetterOrNestedTyped<T> = T extends object ? NestedSettersTyped<T> : SetterTyped<T>;

type NestedSettersTyped<T> = { [P in keyof T]: SetterOrNestedTyped<T[P]> };

function isNestedSettersTyped<T, P>(value: NestedSettersTyped<T> | SetterTyped<P>): value is NestedSettersTyped<T> {
  return typeof value === 'object';
}

/**
 * Create a new "virtual" object that wraps a real one storing arbitrary data.
 *
 * This will return an object that, upon any sets, instead passes the value to a "setter" function.
 *
 * Reads will come from the base object.
 *
 * The difference between this version and the base is that the setter object's functions include the expected type of the target.
 * @param internal Object to wrap
 * @param setters Functions to use to set new values
 */
export function makeObjectSetterRecursiveTyped<T extends {}>(internal: T, setters: NestedSettersTyped<Required<T>>): T {
  const ret = {} as T;

  for (const x in setters) {
    type P = Extract<keyof T, string>;

    const setterOrNested = setters[x] as NestedSettersTyped<Required<T[P]>> | SetterTyped<T[P]>;

    const prop: PropertyDescriptor = { enumerable: true };

    if (isNestedSettersTyped(setterOrNested)) {
      prop.value = makeObjectSetterRecursiveTyped(internal[x], setterOrNested);
    } else {
      if (!setterOrNested) throw Error('Invalid setter');
      prop.set = setterOrNested;
      prop.get = (): T[Extract<keyof T, string>] => internal[x];
    }

    Object.defineProperty(ret, x, prop);
  }

  return ret;
}

////// USAGE /////

/*

const myRecursiveObject = {
  num: 1,
  nested: {
    str: 'foo',
  },
};

const protectedRecursiveObject = makeObjectSetterRecursive(myRecursiveObject, {
  num(x) {
    // Make sure negative
    myRecursiveObject.num = Math.max(x, 0);
  },
  nested: {
    str(s) {
      // Always double the input
      myRecursiveObject.nested.str = s + s;
    },
  },
});

console.log('Before:', myRecursiveObject);
protectedRecursiveObject.num = -1;
protectedRecursiveObject.nested.str = 'a';
console.log('After:', myRecursiveObject);

//*/
