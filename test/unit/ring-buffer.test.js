// test/unit/ring-buffer.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RingBuffer, IndexedRingBuffer } from '../../daemon/ring-buffer.js';

function shouldBe(actual, expected, msg) {
  assert.equal(actual, expected, msg);
}

test('RingBuffer: starts empty', () => {
  const rb = new RingBuffer(5);
  shouldBe(rb.length, 0);
});

test('RingBuffer: push increments size', () => {
  const rb = new RingBuffer(5);
  rb.push('a');
  shouldBe(rb.length, 1);
});

test('RingBuffer: toArray returns in order', () => {
  const rb = new RingBuffer(5);
  rb.push('a'); rb.push('b'); rb.push('c');
  shouldBe(rb.toArray().join(','), 'a,b,c');
});

test('RingBuffer: overwrites oldest when full', () => {
  const rb = new RingBuffer(5);
  for (let i = 0; i < 7; i++) rb.push(i);
  shouldBe(rb.toArray().join(','), '2,3,4,5,6');
});

test('RingBuffer: recent returns last n items', () => {
  const rb = new RingBuffer(5);
  for (let i = 0; i < 5; i++) rb.push(i);
  shouldBe(rb.recent(3).join(','), '2,3,4');
});

test('RingBuffer: clear resets buffer', () => {
  const rb = new RingBuffer(5);
  rb.push('x'); rb.push('y');
  rb.clear();
  shouldBe(rb.length, 0);
});

test('RingBuffer: toArray handles wrap-around', () => {
  const rb = new RingBuffer(5);
  for (let i = 0; i < 8; i++) rb.push(String(i));
  const arr = rb.toArray();
  shouldBe(arr.length, 5);
  shouldBe(arr[0], '3');
});

test('IndexedRingBuffer: push with key indexes correctly', () => {
  const irb = new IndexedRingBuffer(10);
  irb.push({ url: '/a' }, '/a');
  irb.push({ url: '/b' }, '/b');
  irb.push({ url: '/a2' }, '/a');
  const found = irb.findByKey('/a');
  shouldBe(found.length >= 1, true);
});

test('IndexedRingBuffer: findByKey returns empty for unknown key', () => {
  const irb = new IndexedRingBuffer(10);
  shouldBe(irb.findByKey('/none').length, 0);
});

test('IndexedRingBuffer: clear wipes both buffer and index', () => {
  const irb = new IndexedRingBuffer(10);
  irb.push({ x: 1 }, 'k1');
  irb.clear();
  shouldBe(irb.length, 0);
  shouldBe(irb.findByKey('k1').length, 0);
});
