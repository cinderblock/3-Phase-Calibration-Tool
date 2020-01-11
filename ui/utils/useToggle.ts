import { useState } from 'react';

export default function useToggle(def?: boolean): [boolean, () => void] {
  const [state, set] = useState(!!def);
  return [state, (): void => set(!state)];
}
