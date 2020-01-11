import React from 'react';
import { useUserControls } from './DaemonConnection/UserControls';

function AppContainer(): JSX.Element {
  return (
    <>
      <input type="button" onClick={useUserControls(() => ({}))}>
        Hello world!
      </input>
    </>
  );
}

export default AppContainer;
