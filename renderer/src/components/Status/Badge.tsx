import React from 'react';
import { Badge } from 'reactstrap';

import Tooltip from '../simple/TooltipControlled';

export function StatusBadge(props: {
  badge: {
    [key: string]: any;
  };
  id: string;
  minWidth?: number | string;
  text: string | number;
  children?: any;
}): JSX.Element {
  return (
    <>
      <Badge
        id={'StatusBadgeTooltip' + props.id}
        {...props.badge}
        style={Object.assign({ minWidth: props.minWidth }, props.badge.style)}
      >
        {props.text}
      </Badge>
      <Tooltip target={'StatusBadgeTooltip' + props.id} placement="bottom">
        {props.children}
      </Tooltip>
    </>
  );
}
