export type MetricTags = Record<string, string | number>;

export interface Metrics {
  increment(name: string, tags?: MetricTags): void;
  gauge(name: string, value: number, tags?: MetricTags): void;
}
