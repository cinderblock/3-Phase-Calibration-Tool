import React from 'react';
import { flash } from 'react-animations';
import { StyleSheet, css } from 'aphrodite';

const styles = StyleSheet.create({
  flash: {
    animationName: flash,
    animationDuration: '3s',
    animationIterationCount: 'infinite',
  },
});

function Dot({ delay }: { delay: number }): JSX.Element {
  const animationDelay = delay + 'ms';
  return (
    <span className={css(styles.flash)} style={{ animationDelay }}>
      .
    </span>
  );
}

export default function AnimatedEllipsis(): JSX.Element {
  return (
    <>
      <Dot delay={250} />
      <Dot delay={500} />
      <Dot delay={750} />
    </>
  );
}
