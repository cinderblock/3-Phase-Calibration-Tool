import React from 'react';
import { ipcRenderer as backend } from 'electron';
import { BackendStateData } from './BackendConnection/BackendState';

backend.on('response', (event, args) => {
  console.log(args);
});

const App: React.FC = () => {
  return (
    <div className="App">
      <button onClick={() => backend.send('channel', { title: 'hi', content: 'hello this is my message' })}>
        Click me
      </button>
      Time: <BackendStateData mapper={s => s.time} />
    </div>
  );
};

export default App;
