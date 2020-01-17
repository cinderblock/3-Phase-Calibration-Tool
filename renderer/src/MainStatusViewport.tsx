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
