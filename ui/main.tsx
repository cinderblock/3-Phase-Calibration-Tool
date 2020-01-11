import React from 'react';
import ReactDOM from 'react-dom';

import AppContainer from './AppContainer';

import './style.css';

ReactDOM.render(<AppContainer />, document.body.appendChild(document.createElement('div')));

document.addEventListener(
  'keydown',
  event => {
    if (event.code == 'F12') {
      // Open developer console
      return;
    }

    console.log('No handler for:', event);
  },
  false,
);
