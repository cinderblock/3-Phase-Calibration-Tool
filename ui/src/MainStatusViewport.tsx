import React from 'react';
import { useBackendStateUpdate } from './BackendConnection/BackendState';
import { ConnectedMotorStatus } from './components/ConnectedMotorStatus';
import { useUserControls } from './BackendConnection/UserControls';
import { RunMode } from './main-shared-types/UserControls';

function RunModePicker() {
  return (
    <div>
      <button onClick={useUserControls(() => ({ mode: RunMode.Automatic }))}>Automatic</button>
      <button onClick={useUserControls(() => ({ mode: RunMode.Manual }))}>Manual</button>
      <br />
      Amplitude:{' '}
      <input
        type="text"
        onChange={useUserControls(event => {
          event.preventDefault();
          return { drive: { amplitude: parseInt(event.target.value) } };
        })}
        value={useBackendStateUpdate(s => s.userControls.drive.amplitude)}
      />
      Angle:{' '}
      <input
        type="text"
        onChange={useUserControls(event => {
          event.preventDefault();
          return { drive: { angle: parseInt(event.target.value) } };
        })}
        value={useBackendStateUpdate(s => s.userControls.drive.angle)}
      />
      Velocity:{' '}
      <input
        type="text"
        onChange={useUserControls(event => {
          event.preventDefault();
          return { drive: { velocity: parseInt(event.target.value) } };
        })}
        value={useBackendStateUpdate(s => s.userControls.drive.velocity)}
      />
      <br />
      Mlx Interval:{' '}
      <input
        type="text"
        onChange={useUserControls(event => {
          event.preventDefault();
          return { mlxCommandInterval: parseInt(event.target.value) };
        })}
        value={useBackendStateUpdate(s => s.userControls.mlxCommandInterval)}
      />
      Command Interval:{' '}
      <input
        type="text"
        onChange={useUserControls(event => {
          event.preventDefault();
          return { drive: { CommandInterval: parseInt(event.target.value) } };
        })}
        value={useBackendStateUpdate(s => s.userControls.drive.CommandInterval)}
      />
      <br />
      Command Mode:{' '}
      <input
        type="text"
        onChange={useUserControls(event => {
          event.preventDefault();
          return { drive: { CommandMode: parseInt(event.target.value) } };
        })}
        value={useBackendStateUpdate(s => s.userControls.drive.CommandMode)}
      />
    </div>
  );
}

export function MainStatusViewport() {
  const connected = useBackendStateUpdate(s => s.userControls.connected);

  if (!connected) return <div>Not connected</div>;

  return (
    <div>
      <RunModePicker />
      <ConnectedMotorStatus />
    </div>
  );
}
