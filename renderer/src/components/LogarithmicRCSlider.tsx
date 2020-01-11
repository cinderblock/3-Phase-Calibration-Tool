import React from 'react';

import Slider, { SliderProps } from 'rc-slider';

type NumberMap = (x: number) => number;
type Map = number | boolean | { axisFromReal: NumberMap; realFromAxis: NumberMap };

export default function LogarithmicRCSlider({
  map,
  steps,
  ...props
}: Omit<SliderProps, 'step'> & { map?: Map; steps?: number; min?: number; max: number }): JSX.Element {
  if (map !== false) {
    // Default to simple log/exp
    if (map === undefined) map = true;

    // Simple log scale
    if (map === true) {
      map = {
        axisFromReal: Math.log,
        realFromAxis: Math.exp,
      };
    }

    // Log scale approximation that goes to zero
    if (typeof map === 'number') {
      if (map < 0) throw new RangeError('Negative maps are not currently allowed');

      // Helpful to allow logarithmic scales less than one that still go to zero
      const scale = map || 1;

      map = {
        axisFromReal: (real: number): number => {
          real *= scale;
          return real < 1 ? 0 : Math.log(real);
        },
        realFromAxis: (axis: number): number => (axis && Math.exp(axis)) / scale,
      };
      props.min = 0;
    }

    const { axisFromReal, realFromAxis } = map;

    ['max', 'min', 'value', 'defaultValue'].forEach(k => {
      const key = k as keyof typeof props;

      const x = props[key];
      if (x === undefined || x === null) return;

      if (realFromAxis(axisFromReal(+x)) !== x)
        throw new RangeError(`Supplied function map pair doesn't equal itself for ${key}: ${x}`);

      (props[key] as any) = axisFromReal(+x);
    });

    if (steps) {
      (props as SliderProps).step = (props.max - props.min!) / steps;
    }

    if (props.marks) {
      const next: typeof props.marks = {};

      for (const x in props.marks) {
        next[axisFromReal((x as unknown) as number)] = props.marks[x];
      }

      props.marks = next;
    }

    ['onBeforeChange', 'onChange', 'onAfterChange'].forEach(k => {
      const key = k as keyof typeof props;
      if (!props[key]) return;
      const orig = props[key] as (value: number, ...args: any[]) => void;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (props[key] as any) = (value: number, ...args: any[]): void => orig(realFromAxis(value), ...args);

      // Workable version that follows the spec but doesn't allow future features of onChange events to be added
      // props[key] = (value: number): void => orig(realFromAxis(value));
    });

    const f = props.tipFormatter;

    if (f) {
      props.tipFormatter = (v: number): ReturnType<typeof f> => f(realFromAxis(v));
    }
  }

  return <Slider {...props} />;
}
