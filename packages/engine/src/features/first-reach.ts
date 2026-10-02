/**
 * "First bar from `from` on whose low is ≤ x" (or high ≥ x) in O(log n), via a segment tree of
 * minima (maxima). Lets every gap/level find its first touch without scanning to the end.
 */
export class FirstReach {
  private readonly size: number;
  private readonly tree: Float64Array;

  constructor(
    values: readonly number[],
    private readonly mode: 'MIN' | 'MAX',
  ) {
    let size = 1;
    while (size < values.length) size *= 2;
    this.size = size;
    const neutral = mode === 'MIN' ? Infinity : -Infinity;
    this.tree = new Float64Array(2 * size).fill(neutral);
    for (let i = 0; i < values.length; i++) this.tree[size + i] = values[i]!;
    for (let i = size - 1; i >= 1; i--) {
      const a = this.tree[2 * i]!;
      const b = this.tree[2 * i + 1]!;
      this.tree[i] = mode === 'MIN' ? Math.min(a, b) : Math.max(a, b);
    }
  }

  private reaches(v: number, x: number): boolean {
    return this.mode === 'MIN' ? v <= x : v >= x;
  }

  /** Smallest index ≥ from whose value reaches x (≤ x for MIN, ≥ x for MAX), or −1. */
  first(from: number, x: number): number {
    return this.search(1, 0, this.size, from, x);
  }

  private search(node: number, lo: number, hi: number, from: number, x: number): number {
    if (hi <= from || !this.reaches(this.tree[node]!, x)) return -1;
    if (hi - lo === 1) return lo;
    const mid = (lo + hi) >> 1;
    const left = this.search(2 * node, lo, mid, from, x);
    return left !== -1 ? left : this.search(2 * node + 1, mid, hi, from, x);
  }
}
