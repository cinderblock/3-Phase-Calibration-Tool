import React from 'react';

import { MainStatusViewport } from './MainStatusViewport';
import { AvailableMotors } from './AvailableMotors';

const App: React.FC = () => {
  return (
    <div className="App">
      <AvailableMotors />
      <MainStatusViewport />
    </div>
  );
};

export default App;
