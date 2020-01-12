import React from 'react';
import { useBackendStateUpdate } from './BackendConnection/BackendState';
import { ConnectedMotorStatus } from './components/ConnectedMotorStatus';

export function MainStatusViewport() {
  const connected = useBackendStateUpdate(s => s.userControls.connected);

  return <div>{!connected ? 'Not connected' : <ConnectedMotorStatus />}</div>;
}
