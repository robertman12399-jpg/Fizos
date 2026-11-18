/* ФизМат RPG. Версия офлайн-кеша: обновлять при каждой публикации. */
'use strict';
const CACHE_PREFIX = 'fizmat-rpg-';
const CACHE_NAME = CACHE_PREFIX + 'release-2026-11-18-1';
const INDEX = new URL('./index.html', self.registration.scope).href;
const APP_FILES = [
  './index.html', './', './manifest.json',
  './icon-192.png', './icon-512.png',
  './icon-192-maskable.png', './icon-512-maskable.png', './icon-180.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Только после полной загрузки: при сбое старый кеш сохраняется.
    await cache.addAll(APP_FILES);
    // Важно при миграции со старого SW v13: старый интерфейс не умеет
    // принимать команду обновления. Новый SW активируется, не перезагружая
    // открытые вкладки. Текущий ответ ученика НЕ прерывается.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith(CACHE_PREFIX) && n !== CACHE_NAME)
      .map(n => caches.delete(n)));
    // Cache Storage и localStorage — разные хранилища. Здесь НЕТ никакого
    // обращения к localStorage/IndexedDB и НЕТ удаления данных ученика.
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIZMAT_ACTIVATE_UPDATE') {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.href.startsWith(self.registration.scope)) return;

  if (req.mode === 'navigate') {
    // Сеть в первую очередь: публикация index.html видна при следующем
    // открытии. Офлайн: версия, сохраненная при установке SW.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(req, {cache: 'no-store'});
        if (response.ok && response.type === 'basic') {
          // Сбой записи в Cache Storage не должен подменять свежую
          // сетевую страницу старой версией приложения.
          try { await cache.put(INDEX, response.clone()); } catch (_) {}
        }
        return response;
      } catch (error) {
        const cached = await cache.match(INDEX);
        return cached || Response.error();
      }
    })());
    return;
  }

  // Сетевые ресурсы PWA: быстро из кеша, при отсутствии — из сети.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const response = await fetch(req);
      if (response.ok && response.type === 'basic') await cache.put(req, response.clone());
      return response;
    } catch (error) {
      return Response.error();
    }
  })());
});
