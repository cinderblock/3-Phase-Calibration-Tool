import React from 'react';
import Badge from 'reactstrap/lib/Badge';

export default function DataPill({ color, children }: { color?: string; children?: any }) {
  return children === undefined ? <Badge>undefined</Badge> : <Badge color={color || 'primary'}>{children}</Badge>;
}
