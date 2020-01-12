import React from 'react';
import { BackendStateData } from './BackendConnection/BackendState';
import { useUserControls } from './BackendConnection/UserControls';

const App: React.FC = () => {
  return (
    <div className="App">
      <button onClick={useUserControls(() => ({}))}>Click me!</button>
      Time: <BackendStateData mapper={s => s.time} />
    </div>
  );
};

export default App;
