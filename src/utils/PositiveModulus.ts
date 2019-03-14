export default function PositiveModulus(num: number, mod: number) {
  return ((num % mod) + mod) % mod;
}
