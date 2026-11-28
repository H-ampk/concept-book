export type IdbReadSample = {
  store: string;
  count: number;
  ms: number;
  /** 読み取り完了の performance.now()。起動完了がログ後の計算より先に切れないようにする。 */
  at: number;
};

export type ModelSample = {
  name: string;
  ms: number;
  /** 計算完了の performance.now()。 */
  at: number;
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
    const at = performance.now();
    probe.models.push({ name, ms: at - started, at });
  }
};

/**
 * プローブがあるときだけ開始時刻を取る。
 * 無いときは performance.now() を呼ばない。
 */
export const perfReadStartedAt = (): number | null => (activeProbe() ? performance.now() : null);

/** IndexedDB の読み取り 1 回。プローブが無いときは何もしない。 */
export const noteIdbRead = (store: string, count: number, startedAt: number | null): void => {
  if (startedAt == null) {
    return;
  }
  const probe = activeProbe();
  if (!probe) {
    return;
  }
  const at = performance.now();
  probe.idb.push({
    store,
    count,
    ms: at - startedAt,
    at
  });
};
