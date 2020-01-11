import React from 'react';
import { ipcRenderer } from 'electron';

ipcRenderer.on('response', (event, args) => {
  console.log(args);
});

const App: React.FC = () => {
  return (
    <div className="App">
      <button onClick={e => ipcRenderer.send('channel', { title: 'hi', content: 'hello this is my message' })}>
        Click me
      </button>
    </div>
  );
};

export default App;
