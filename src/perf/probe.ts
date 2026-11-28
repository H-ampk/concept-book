export type IdbReadSample = {
  store: string;
  count: number;
  ms: number;
  /** 読み取り完了の performance.now()。所要時間の記録に使う。 */
  at: number;
  /** プローブ内の記録順。時刻が同じでも読み取りと計算を区別する。 */
  seq: number;
};

export type ModelSample = {
  name: string;
  ms: number;
  /** 計算完了の performance.now()。所要時間の記録に使う。 */
  at: number;
  /** プローブ内の記録順。時刻が同じでも読み取りと計算を区別する。 */
  seq: number;
};

export type PerfProbeState = {
  idb: IdbReadSample[];
  models: ModelSample[];
  /** 次に記録するイベントの連番。プローブを差し替えると 0 に戻る。 */
  nextSeq: number;
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
    probe.models.push({ name, ms: at - started, at, seq: takeSeq(probe) });
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
    at,
    seq: takeSeq(probe)
  });
};

/** 記録のたびに増やす。配列を空にしても、プローブオブジェクトを新しくするまで連番は続く。 */
const takeSeq = (probe: PerfProbeState): number => {
  if (typeof probe.nextSeq !== "number" || probe.nextSeq < 0) {
    probe.nextSeq = 0;
  }
  const seq = probe.nextSeq;
  probe.nextSeq += 1;
  return seq;
};
