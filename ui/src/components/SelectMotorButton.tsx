import React from 'react';
import { useUserControls } from '../BackendConnection/UserControls';

export function SelectMotorButton({ motor: serial }: { motor: string }) {
  return (
    <div>
      serial: {serial} <button onClick={useUserControls(() => ({ connected: serial }), [serial])}>Connect</button>
    </div>
  );
}
