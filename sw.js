'use strict';

var staticCacheName = 'restaurant-cache';
var contentImgsCache = 'restaurant-content-imgs';
var allCaches = [
  staticCacheName,
  contentImgsCache,
];


/* Cache all url in the storage cache so that any page
 * that has been visited is accessible offline
 * staticCacheName is the variable storing the cache name
*/
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(staticCacheName).then(function(cache) {
      return cache.addAll([
        '/',
        'js/main_bundle.js',
        'js/restaurant_bundle.js',
        'css/styles.css',
        'https://fonts.gstatic.com/s/roboto/v18/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2',
        'https://fonts.googleapis.com/css?family=Roboto'
      ]);
    })
  );
});

/* Remove the old cache */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(cacheName) {
          return cacheName.startsWith('restaurant-') &&
                 !allCaches.includes(cacheName);
        })
          .map(function(cacheName) {
            return caches.delete(cacheName);
          })
      );
    })
  );
});

/* If a request doesn't match anything in the cache, get it from the network,
send it to the page and add it to the cache at the same time.*/
self.addEventListener('fetch', function(event) {
  var requestUrl = new URL(event.request.url);

  // Don't use service worker caches for IndexDB based
  // data.
  if (requestUrl.pathname.startsWith('/restaurants/') ||
      requestUrl.pathname.startsWith('/reviews/')) {
    return;
  }

  if (requestUrl.pathname.startsWith('/img/')) {
    event.respondWith(servePhoto(event.request));
    return;
  }

  event.respondWith(
    caches.open(staticCacheName).then(function(cache) {
      return cache.match(event.request).then(function (response) {
        return response || fetch(event.request).then(function(response) {
          cache.put(event.request.url, response.clone());
          return response;
        });
      });
    })
      .catch(error => {
        console.log('Error', error);
      })
  );
});

self.addEventListener('message', (event) => {
  console.log('event', event);
  if (event.data.action == 'skipWaiting') {
    self.skipWaiting();
  }
});

function servePhoto(request) {
  return caches.open(contentImgsCache).then(function(cache) {
    return cache.match(request).then(function(response) {
      if (response) return response;

      return fetch(request).then(function(networkResponse) {
        cache.put(request, networkResponse.clone());
        return networkResponse;
      });
    });
  });
}

self.addEventListener('sync', function (event) {
  if (event.tag == 'myFirstSync') {
    const DBOpenRequest = indexedDB.open('restaurants', 1);
    DBOpenRequest.onsuccess = function (e) {
      let db = DBOpenRequest.result;
      let tx = db.transaction('offline-reviews', 'readwrite');
      let store = tx.objectStore('offline-reviews');
      // 1. Get submitted reviews while offline
      let request = store.getAll();
      request.onsuccess = function () {
        // 2. POST offline reviews to network
        for (let i = 0; i < request.result.length; i++) {
          fetch(`http://localhost:1337/reviews/`, {
            body: JSON.stringify(request.result[i]),
            cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
            credentials: 'same-origin', // include, same-origin, *omit
            headers: {
              'content-type': 'application/json'
            },
            method: 'POST',
            mode: 'cors', // no-cors, cors, *same-origin
            redirect: 'follow', // *manual, follow, error
            referrer: 'no-referrer', // *client, no-referrer
          })
            .then(response => {
              return response.json();
            })
            .then(data => {
              let tx = db.transaction('reviews', 'readwrite');
              let store = tx.objectStore('reviews');
              let request = store.add(data);
              request.onsuccess = function (data) {
                //TODO: add data (= one review) to view
                let tx = db.transaction('offline-reviews', 'readwrite');
                let store = tx.objectStore('offline-reviews');
                let request = store.clear();
                request.onsuccess = function () { };
                request.onerror = function (error) {
                  console.log('Unable to clear offline-reviews objectStore', error);
                };
              };
              request.onerror = function (error) {
                console.log('Unable to add objectStore to IDB', error);
              };
            })
            .catch(error => {
              console.log('Unable to make a POST fetch', error);
            });
        }
      };
      request.onerror = function (e) {
        console.log(e);
      };
    };
    DBOpenRequest.onerror = function (e) {
      console.log(e);
    };
  }
});

