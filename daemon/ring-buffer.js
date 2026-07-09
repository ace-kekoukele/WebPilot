// daemon/ring-buffer.js — O(1) 环形缓冲区，替代 array.shift()
// 用法: const rb = new RingBuffer(10000); rb.push(item); const arr = rb.toArray();

// ──── RingBuffer ────────────────────────────────────────────────────────────
export class RingBuffer {
  /**
   * @param {number} capacity
   */
  constructor(capacity = 10000) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.head = 0;  // 下一条写入位置
    this.size = 0;  // 当前实际条目数
  }

  /** 追加一条（超过容量则覆盖最老的） */
  push(item) {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) this.size++;
  }

  /** 返回所有条目（按写入顺序） */
  toArray() {
    if (this.size === 0) return [];
    if (this.size < this.capacity) {
      return this.buffer.slice(0, this.size);
    }
    // 绕回来了: [head..end) + [0..head)
    const tail = this.buffer.slice(this.head);       // head 之后（最老的）
    const front = this.buffer.slice(0, this.head);  // head 之前（最新的）
    return [...tail, ...front];
  }

  /** 返回最近 n 条 */
  recent(n = 50) {
    const count = Math.min(n, this.size);
    if (count === 0) return [];
    const start = (this.head - count + this.capacity) % this.capacity;
    const result = [];
    for (let i = 0; i < count; i++) {
      const idx = (start + i) % this.capacity;
      result.push(this.buffer[idx]);
    }
    return result;
  }

  /** 按条件过滤（遍历整个 buffer） */
  filter(fn) {
    const arr = this.toArray();
    return arr.filter(fn);
  }

  get length() { return this.size; }

  clear() {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.size = 0;
  }
}

// ──── IndexedRingBuffer — 带索引的缓冲区（按 key 快速查找） ──────────────────
export class IndexedRingBuffer {
  /**
   * @param {number} capacity
   */
  constructor(capacity = 10000) {
    this._buffer = new RingBuffer(capacity);
    this._index = new Map();  // key → [buffer indices]
  }

  push(item, key = null) {
    const index = this._buffer.head;
    this._buffer.push(item);
    if (key) {
      const slots = this._index.get(key) || [];
      slots.push(index);
      if (slots.length > 10) slots.shift();  // 每个 key 最多存 10 个位置
      this._index.set(key, slots);
    }
  }

  toArray() { return this._buffer.toArray(); }
  recent(n) { return this._buffer.recent(n); }
  filter(fn) { return this._buffer.filter(fn); }
  get length() { return this._buffer.length; }
  clear() { this._buffer.clear(); this._index.clear(); }

  /** 按 key 查找（返回匹配的条目） */
  findByKey(key) {
    const indices = this._index.get(key);
    if (!indices) return [];
    return indices
      .map(i => this._buffer.buffer[i])
      .filter(Boolean);
  }
}
