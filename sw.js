/* ============================================================
   ФизМат RPG — Service Worker
   ------------------------------------------------------------
   Всё приложение — один большой самодостаточный HTML-файл
   (~2.7 МБ, весь JS/CSS инлайн, кроме шрифтов Google Fonts).
   Задача этого файла — сделать так, чтобы после первого открытия
   приложение запускалось БЕЗ интернета, а при наличии интернета
   тихо подтягивало более новую версию себе на будущее (без
   принудительной переустановки у ученика).

   ВАЖНО ПРИ ОБНОВЛЕНИИ ПРИЛОЖЕНИЯ: меняйте CACHE_VERSION при каждой
   публикации новой версии index.html — иначе Service Worker будет
   считать, что кэш актуален, и ученики не увидят изменений до тех
   пор, пока кэш не истечёт сам (а он не истекает, пока версия та же).
   ============================================================ */

const CACHE_VERSION = "fizmat-rpg-v1"; // <-- увеличивайте (v2, v3...) на каждый релиз
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-192-maskable.png",
  "./icon-512-maskable.png",
];

/* --- установка: кладём основные файлы в кэш --- */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting(); // новая версия SW активируется сразу, не дожидаясь закрытия всех вкладок
});

/* --- активация: подчищаем кэши от старых версий --- */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* --- запросы: cache-first с фоновым обновлением (stale-while-revalidate) ---
   Отдаём из кэша мгновенно (офлайн работает всегда), но параллельно тихо
   идём в сеть за свежей версией и кладём её в кэш — при СЛЕДУЮЩЕМ запуске
   ученик уже увидит обновлённую версию, даже если сам не переустанавливал
   приложение. Если сети нет — просто продолжаем работать из кэша. */
self.addEventListener("fetch", (event) => {
  // Не трогаем запросы не по GET (например, если появятся будущие API) и
  // запросы на другие origin (шрифты Google Fonts) — им дадим работать как
  // обычно, браузер сам покэширует их по HTTP-заголовкам.
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cached); // нет сети — тихо остаёмся на кэше, без ошибки в консоли ученика
        return cached || fetchPromise;
      })
    )
  );
});
