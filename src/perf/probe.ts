export type IdbReadSample = {
  store: string;
  count: number;
  ms: number;
};

export type ModelSample = {
  name: string;
  ms: number;
};

export type PerfProbeState = {
  idb: IdbReadSample[];
  models: ModelSample[];
};

const probeHost = globalThis as { __CB_PERF_PROBE__?: PerfProbeState };

const activeProbe = (): PerfProbeState | undefined => probeHost.__CB_PERF_PROBE__;

/**
 * 計測プローブが無いときは fn をそのまま実行する。
 * 学習モデルの計算結果は変えない。
 */
export const measurePerfSpan = <T>(name: string, fn: () => T): T => {
  const probe = activeProbe();
  if (!probe) {
    return fn();
  }
  const started = performance.now();
  try {
    return fn();
  } finally {
    probe.models.push({ name, ms: performance.now() - started });
  }
};

/** IndexedDB の読み取り 1 回。プローブが無いときは何もしない。 */
export const noteIdbRead = (store: string, count: number, startedAt: number): void => {
  const probe = activeProbe();
  if (!probe) {
    return;
  }
  probe.idb.push({
    store,
    count,
    ms: performance.now() - startedAt
  });
};
