import React from 'react';
import { useBackendStateUpdate } from '../BackendConnection/BackendState';
import { NormalData, CommonData, ReadData, FaultData, ManualData } from 'smooth-control';
import { useUserCommand } from '../BackendConnection/UserControls';
import { UserCommands } from '../main-shared-types/UserControls';

import {
  ResponsiveContainer,
  ScatterChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  ZAxis,
  Scatter,
} from 'recharts';

/* Why can't we import these?
import { ControllerState, ControllerFault } from 'smooth-control';
/*/
enum ControllerState {
  Fault = 0,
  Manual = 1,
  Normal = 2,
}
enum ControllerFault {
  Init = 0,
  UnderVoltageLockout = 1,
  OverCurrent = 2,
  OverTemperature = 3,
  WatchdogReset = 4,
  BrownOutReset = 5,
  InvalidCommand = 6,
}
//*/

function DataPill({ children }: { children?: React.ReactNode; color?: any }) {
  return <span>{children}</span>;
}

function isFaultState(data: ReadData): data is FaultData & CommonData {
  return data.state === ControllerState.Fault;
}

function isManualState(data: ReadData): data is ManualData & CommonData {
  return data.state === ControllerState.Manual;
}

function isNormalState(data: ReadData): data is NormalData & CommonData {
  return data.state === ControllerState.Normal;
}

function PositionChart() {
  return (
    <ResponsiveContainer aspect={1}>
      <ScatterChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          scale="linear"
          type="number"
          dataKey="x"
          name="X"
          domain={[-100, 100]}
          label="X"
          interval={0}
          minTickGap={40}
          mirror={true}
        />
        <YAxis scale="linear" type="number" dataKey="y" name="Y" domain={[-100, 100]} mirror={true} label="Y" />
        <ZAxis dataKey="z" range={[0, 200]} name="score" unit="km" />
        <Tooltip />
        <Legend />
        <Scatter
          name="A school"
          data={[
            { x: 1, y: 1, z: 19 },
            { x: 1.5, y: 0, z: 2 },
            { x: 1, y: -1, z: 3 },
            { x: 0, y: -1.5, z: 4 },
            { x: -1, y: -1, z: 5 },
            { x: -1.5, y: 0, z: 6 },
          ]}
          fill="#8884d8"
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function PrettyState() {
  const state = useBackendStateUpdate(s => s.motorState);

  const clearFaults = useUserCommand(() => ({ command: UserCommands.ClearFault }));

  if (!state) return null;

  const { connected, data, processed, command, enabled } = state;

  const fault =
    data &&
    (data.state === ControllerState.Fault ? (
      <DataPill color="warning">{ControllerFault[data.fault]}</DataPill>
    ) : (
      <DataPill />
    ));

  const disabled = enabled ? null : (
    <h5>
      <DataPill color="warning">Disabled</DataPill>
    </h5>
  );

  let detail: React.ReactNode;

  if (!data) {
  } else if (isFaultState(data) && data.fault !== ControllerFault.Init) {
    detail = (
      <>
        <button onClick={clearFaults}>Clear Fault</button>
        <br />
      </>
    );
  } else if (isManualState(data) || isNormalState(data)) {
    detail = (
      <>
        Position: <DataPill>{data?.position}</DataPill>
        <br />
        Velocity: <DataPill>{data?.velocity}</DataPill>
        <br />
        Amplitude: <DataPill>{data?.amplitude}</DataPill>
        <br />
      </>
    );
  }

  return (
    <>
      <h5>
        <DataPill>{connected ? 'Connected' : 'Missing'}</DataPill>
      </h5>
      {disabled}
      Mode: <DataPill>{command?.mode}</DataPill>
      <br />
      Command: <DataPill>{command?.command}</DataPill>
      <br />
      State:{' '}
      <DataPill color={data?.state === ControllerState.Fault ? 'danger' : 'primary'}>
        {data && ControllerState[data.state]}
      </DataPill>
      {data?.state === ControllerState.Fault ? <> ({fault})</> : <></>}
      <br />
      {detail}
      Temp: <DataPill>{data?.cpuTemp}</DataPill>
      <br />
      Current: <DataPill>{data?.current?.toFixed(3)}</DataPill>
      <br />
      Battery voltage: {processed?.batteryVoltage?.toFixed(2)}
      <br />
      Gate voltage: <DataPill>{processed?.gateVoltage?.toFixed(2)}</DataPill>
      <br />
      Total Current: <DataPill>{processed?.totalCurrent?.toFixed(3)}</DataPill>
    </>
  );
}

function RawValues() {
  const data = useBackendStateUpdate(s => s.motorState.data);

  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}

export function ConnectedMotorStatus() {
  const state = useBackendStateUpdate(s => !s.motorState);

  const manualMode = useUserCommand(() => ({ command: UserCommands.ReadMLX, which: 'xyz' }));

  if (state) return <></>;

  return (
    <>
      <div>
        <div style={{ maxWidth: 500 }}>
          <PositionChart />
        </div>
        <div style={{ color: 'black', textAlign: 'left', padding: 5 }}>
          <PrettyState />
        </div>
        <div>
          <button onClick={manualMode}>Manual Read MLX</button>
        </div>
        <div>
          <RawValues />
        </div>
      </div>
    </>
  );
}
