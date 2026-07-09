// test/unit/_helpers.js — 共享 mock WebSocket
import { EventEmitter } from 'node:events';

export class MockWs extends EventEmitter {
  constructor(readyState = 1 /* OPEN */) {
    super();
    this.readyState = readyState;
    this.sent = [];
  }
  send(data) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3; // CLOSED
    this.emit('close');
  }
  // Convenience: directly reply to the i-th sent message
  replyTo(i, result) {
    const sent = this.sent[i];
    this.emit('message', JSON.stringify({ id: sent.id, result }));
  }
  replyErrorTo(i, message) {
    const sent = this.sent[i];
    this.emit('message', JSON.stringify({ id: sent.id, error: { code: -32001, message } }));
  }
}

export const WS_OPEN = 1;
export const WS_CLOSED = 3;