/** 重み付き非復元抽出。weight が高いほど選ばれやすい。 */
export function weightedSampleWithoutReplacement<T>(
  items: readonly T[],
  weights: readonly number[],
  count: number,
  random: () => number = Math.random
): T[] {
  if (items.length === 0 || count <= 0) {
    return [];
  }

  const take = Math.min(count, items.length);
  const remaining: { item: T; weight: number }[] = items.map((item, i) => ({
    item,
    weight: Math.max(weights[i] ?? 1, 1)
  }));

  const selected: T[] = [];

  for (let n = 0; n < take; n += 1) {
    const totalWeight = remaining.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = random() * totalWeight;
    let pickedIndex = remaining.length - 1;

    for (let i = 0; i < remaining.length; i += 1) {
      roll -= remaining[i].weight;
      if (roll <= 0) {
        pickedIndex = i;
        break;
      }
    }

    selected.push(remaining[pickedIndex].item);
    remaining.splice(pickedIndex, 1);
  }

  return selected;
}
