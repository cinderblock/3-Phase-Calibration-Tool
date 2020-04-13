import React from 'react';
import { useBackendStateUpdate } from '../BackendConnection/BackendState';
import { NormalData, CommonData, ReadData, FaultData, ManualData } from 'smooth-control';
import { useUserControls, useUserCommand } from '../BackendConnection/UserControls';
import { UserCommands } from '../shared/UserControls';

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

export function ConnectedMotorStatus() {
  const state = useBackendStateUpdate(s => s.motorState);

  const clearFaults = useUserCommand(() => ({ command: UserCommands.ClearFault }));

  const manualMode = useUserCommand(() => ({ command: UserCommands.ReadMLX, which: 'xyz' }));

  if (!state) return <></>;

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
      <div>
        <div style={{ color: 'black', textAlign: 'left', padding: 5 }}>
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
        </div>
        <div>
          <button onClick={manualMode}>Manual Read MLX</button>
        </div>
        <div>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      </div>
    </>
  );
}
