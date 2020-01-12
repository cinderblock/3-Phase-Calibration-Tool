import React from 'react';
import { useBackendStateUpdate } from './BackendConnection/BackendState';
import { SelectMotorButton } from './components/SelectMotorButton';

export function AvailableMotors() {
  const availableList = useBackendStateUpdate(s => s.connectedMotorSerials);
  const motorList =
    !availableList || !availableList.length
      ? 'No Motors :('
      : availableList.map(serial => <SelectMotorButton key={serial} motor={serial} />);
  return (
    <>
      <div>{motorList}</div>
    </>
  );
}
