import { signal } from '@preact/signals';

const page = signal('connect');

export function showPage(newPage) {
  page.value = newPage;
}

export function getCurrentPage() {
  return page.value;
}
