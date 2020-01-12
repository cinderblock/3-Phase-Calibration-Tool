import React from 'react';
import { BackendStateData, useBackendStateUpdate } from './BackendConnection/BackendState';
import { useUserControls } from './BackendConnection/UserControls';

function MotorButton({ motor: serial }: { motor: string }) {
  return (
    <div>
      serial: {serial} <button onClick={useUserControls(() => ({ connected: serial }), [serial])}>Connect</button>
    </div>
  );
}

const App: React.FC = () => {
  const connected = useBackendStateUpdate(s => s.connectedMotorSerials);

  const motorList = !connected ? 'No Motors :(' : connected.map(serial => <MotorButton key={serial} motor={serial} />);

  return (
    <div className="App">
      <button onClick={useUserControls(() => ({}))}>Click me!</button>
      Time: <BackendStateData mapper={s => s.time} />
      {motorList}
    </div>
  );
};

export default App;
