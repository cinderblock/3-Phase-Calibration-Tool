import React from 'react';

import SmoothieComponent, { SmoothieComponentProps, ToolTip } from 'react-smoothie';
import Slider, { SliderProps } from 'rc-slider';
import TimeAgo from 'react-timeago';
import { useServerDelta, ServerTime } from '../BackendConnection/ServerTime';

const tooltip: ToolTip = ({ time, data, display }: Parameters<ToolTip>[0]) => {
  if (!display) return <div />;

  return (
    <div
      style={{
        background: '#444',
        padding: '1em',
        marginLeft: '20px',
        width: '18ex',
        color: 'white',
      }}
    >
      <strong>
        <TimeAgo date={time ?? 0} now={ServerTime} />
      </strong>
      {data ? (
        <ul style={{ margin: 0 }}>
          {data.map((data, i) => (
            <li key={i} style={{ color: data.series.options.strokeStyle }}>
              {typeof data.value == 'number' ? data.value.toFixed(4) : data.value}
            </li>
          ))}
        </ul>
      ) : (
        <div />
      )}
    </div>
  );
};

export default function SliderChartComponent(props: {
  slider?: SliderProps;
  height?: number;
  chart: SmoothieComponentProps;
}) {
  const height = props.height || 200;
  if (height < 0) throw new RangeError('Height is negative!');

  // Only update if the delay error is greater than 30Hz period
  const serverDelta = useServerDelta(1000 / 30);

  return (
    <>
      {props.slider && <Slider vertical style={{ float: 'right', height: props.height }} {...props.slider} />}
      <div style={{ marginRight: 20 }}>
        <SmoothieComponent
          responsive
          tooltip={tooltip}
          height={props.height}
          millisPerPixel={10}
          {...props.chart}
          streamDelay={-serverDelta}
        />
      </div>
    </>
  );
}
