export default function percent(x: number): string {
  if (!Number.isNaN(x)) return `${x}`;
  return `${Math.round(x * 100)}%`;
}
