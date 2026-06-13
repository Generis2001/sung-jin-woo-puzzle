export type ToastType = 'ok' | 'err' | 'inf';

let _handler: ((msg: string, type: ToastType) => void) | null = null;

export function registerToastHandler(fn: (msg: string, type: ToastType) => void) {
  _handler = fn;
}

export function toast(msg: string, type: ToastType = 'inf') {
  _handler?.(msg, type);
}
