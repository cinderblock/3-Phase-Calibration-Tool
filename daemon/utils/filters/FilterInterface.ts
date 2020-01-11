export interface Filter {
  /**
   * Reset integrator to default value
   */
  reset(): void;

  /**
   * Feed a new value into the integrator
   * @param value Next value to feed to filter
   */
  feed(value: number): number;
}
