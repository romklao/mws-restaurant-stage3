(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _idb = require('idb');

var _idb2 = _interopRequireDefault(_idb);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Common database helper functions.
 */

var DBHelper = function () {
  function DBHelper() {
    _classCallCheck(this, DBHelper);
  }

  _createClass(DBHelper, null, [{
    key: 'mapMarkerForRestaurant',


    /**
     * @Map marker for a restaurant.
     */
    value: function mapMarkerForRestaurant(restaurant, map) {
      DBHelper.addTitleToMap();
      var marker = new google.maps.Marker({
        position: restaurant.latlng,
        title: restaurant.name,
        url: DBHelper.urlForRestaurant(restaurant),
        map: map,
        animation: google.maps.Animation.DROP
      });
      return marker;
    }
    /**
     * @add attribute title to <iframe> in Google Map to improve the accessibility
     */

  }, {
    key: 'addTitleToMap',
    value: function addTitleToMap() {
      google.maps.event.addListenerOnce(map, 'idle', function () {
        document.getElementsByTagName('iframe')[0].title = 'Google Maps';
      });
    }

    /**
     * @open database to store data retrieved from the server in indexedDB API
     */

  }, {
    key: 'openDatabase',
    value: function openDatabase() {
      if (!navigator.serviceWorker) {
        return Promise.resolve();
      } else {
        return _idb2.default.open('restaurants', 3, function (upgradeDb) {
          upgradeDb.createObjectStore('restaurants', { keyPath: 'id' });
          var reviewStore = upgradeDb.createObjectStore('reviews', { keyPath: 'id' });
          reviewStore.createIndex('restaurant_id', 'restaurant_id', { unique: false });
          upgradeDb.createObjectStore('offline-reviews', { keyPath: 'updatedAt' });
        });
      }
    }
    /**
     * @get data from a store in IndexedDB if it is available
     */

  }, {
    key: 'getCachedIndexedDB',
    value: function getCachedIndexedDB(store_name) {
      var dbPromise = DBHelper.openDatabase();

      return dbPromise.then(function (db) {
        if (!db) return;
        var tx = db.transaction(store_name);
        var store = tx.objectStore(store_name);
        return store.getAll();
      });
    }

    /**
     * @store the data in IndexedDB after fetching it from the server
     * @param datas: are retrieved from the server, store_name: {string}
     */

  }, {
    key: 'storeDataIndexedDb',
    value: function storeDataIndexedDb(datas, store_name) {
      var dbPromise = DBHelper.openDatabase();

      dbPromise.then(function (db) {
        if (!db) return;
        var tx = db.transaction(store_name, 'readwrite');
        var store = tx.objectStore(store_name);

        datas.forEach(function (data) {
          store.put(data);
        });
        return tx.complete;
      });
    }
    /**
     * @fetch all restaurants form IndexedDB if they exist otherwise fetch from the server.
     */

  }, {
    key: 'fetchRestaurants',
    value: function fetchRestaurants(callback) {
      //check if data exists in indexDB API if it does return callback
      DBHelper.getCachedIndexedDB('restaurants').then(function (results) {
        if (results && results.length > 0) {
          callback(null, results);
        } else {
          // Use else condition to avoid fetching from sails server
          // because updating favorite on the sails server is not persistent
          // and to get data from IndexedDB only
          fetch(DBHelper.DATABASE_URL + '/restaurants').then(function (response) {
            return response.json();
          }).then(function (restaurants) {
            //store data in indexDB API after fetching
            DBHelper.storeDataIndexedDb(restaurants, 'restaurants');
            return callback(null, restaurants);
          }).catch(function (err) {
            return callback(err, null);
          });
        }
      });
    }
    /**
     * @fetch all reviews form IndexedDB if they exist otherwise fetch from the server.
     */

  }, {
    key: 'fetchRestaurantReviews',
    value: function fetchRestaurantReviews(restaurant, callback) {
      var dbPromise = DBHelper.openDatabase();

      dbPromise.then(function (db) {
        if (!db) return;

        var tx = db.transaction('reviews');
        var store = tx.objectStore('reviews');
        var index = store.index('restaurant_id');

        index.getAll(restaurant.id).then(function (results) {
          callback(null, results);

          if (!navigator.onLine) {
            return;
          }

          fetch(DBHelper.DATABASE_URL + '/reviews/?restaurant_id=' + restaurant.id).then(function (response) {
            return response.json();
          }).then(function (reviews) {
            //store data in indexDB API after fetching
            var reviewsLen = reviews.length;
            if (reviewsLen >= 29) {
              for (var i = 0; i < reviewsLen - 20; i++) {
                DBHelper.deleteRestaurantReviews(reviews[i].id);
              }
            }
            DBHelper.storeDataIndexedDb(reviews, 'reviews');
            callback(null, reviews);
          }).catch(function (err) {
            callback(err, null);
          });
        });
      });
    }

    /**
     * @fetch a restaurant by its ID.
     */

  }, {
    key: 'fetchRestaurantById',
    value: function fetchRestaurantById(id, callback) {
      // fetch all restaurants with proper error handling.
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          var restaurant = restaurants.find(function (r) {
            return r.id == id;
          });
          if (restaurant) {
            // Got the restaurant
            callback(null, restaurant);
          } else {
            // Restaurant does not exist in the database
            callback('Restaurant does not exist', null);
          }
        }
      });
    }

    /**
     * @fetch restaurants by a cuisine type with proper error handling.
     */

  }, {
    key: 'fetchRestaurantByCuisine',
    value: function fetchRestaurantByCuisine(cuisine, callback) {
      // Fetch all restaurants  with proper error handling
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          // Filter restaurants to have only given cuisine type
          var results = restaurants.filter(function (r) {
            return r.cuisine_type == cuisine;
          });
          callback(null, results);
        }
      });
    }

    /**
     * @fetch restaurants by a neighborhood with proper error handling.
     */

  }, {
    key: 'fetchRestaurantByNeighborhood',
    value: function fetchRestaurantByNeighborhood(neighborhood, callback) {
      // Fetch all restaurants
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          // Filter restaurants to have only given neighborhood
          var results = restaurants.filter(function (r) {
            return r.neighborhood == neighborhood;
          });
          callback(null, results);
        }
      });
    }

    /**
     * @fetch restaurants by a cuisine and a neighborhood with proper error handling.
     */

  }, {
    key: 'fetchRestaurantByCuisineAndNeighborhood',
    value: function fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
      // Fetch all restaurants
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          var results = restaurants;
          if (cuisine != 'all') {
            // filter by cuisine
            results = results.filter(function (r) {
              return r.cuisine_type == cuisine;
            });
          }
          if (neighborhood != 'all') {
            // filter by neighborhood
            results = results.filter(function (r) {
              return r.neighborhood == neighborhood;
            });
          }
          callback(null, results);
        }
      });
    }
  }, {
    key: 'fetchRestaurantByCuisineNeighborhoodAndFavorite',
    value: function fetchRestaurantByCuisineNeighborhoodAndFavorite(cuisine, neighborhood, favorite, callback) {
      // Fetch all restaurants
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          var results = restaurants;
          if (cuisine != 'all') {
            // filter by cuisine
            results = results.filter(function (r) {
              return r.cuisine_type == cuisine;
            });
          }
          if (neighborhood != 'all') {
            // filter by neighborhood
            results = results.filter(function (r) {
              return r.neighborhood == neighborhood;
            });
          }
          if (favorite == 'true') {
            results = results.filter(function (r) {
              return r.is_favorite == 'true';
            });
          }
          callback(null, results);
        }
      });
    }

    /**
     * @fetch all neighborhoods with proper error handling.
     */

  }, {
    key: 'fetchNeighborhoods',
    value: function fetchNeighborhoods(callback) {
      // Fetch all restaurants
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          // Get all neighborhoods from all restaurants
          var neighborhoods = restaurants.map(function (v, i) {
            return restaurants[i].neighborhood;
          });
          // Remove duplicates from neighborhoods
          var uniqueNeighborhoods = neighborhoods.filter(function (v, i) {
            return neighborhoods.indexOf(v) == i;
          });
          callback(null, uniqueNeighborhoods);
        }
      });
    }

    /**
     * @fetch all cuisines with proper error handling.
     */

  }, {
    key: 'fetchCuisines',
    value: function fetchCuisines(callback) {
      // Fetch all restaurants
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          // Get all cuisines from all restaurants
          var cuisines = restaurants.map(function (v, i) {
            return restaurants[i].cuisine_type;
          });
          // Remove duplicates from cuisines
          var uniqueCuisines = cuisines.filter(function (v, i) {
            return cuisines.indexOf(v) == i;
          });
          callback(null, uniqueCuisines);
        }
      });
    }

    /**
     * @restaurant page URL.
     */

  }, {
    key: 'urlForRestaurant',
    value: function urlForRestaurant(restaurant) {
      return './restaurant.html?id=' + restaurant.id;
    }

    /**
     * @restaurant image URL.
     */

  }, {
    key: 'imageUrlForRestaurant',
    value: function imageUrlForRestaurant(restaurant) {
      if (restaurant.photograph === undefined) {
        restaurant.photograph = 10;
      }
      return 'img/' + restaurant.photograph + '.webp';
    }
  }, {
    key: 'deleteRestaurantReviews',
    value: function deleteRestaurantReviews(review_id) {
      fetch(DBHelper.DATABASE_URL + '/reviews/' + review_id, {
        method: 'DELETE'
      }).then(function (response) {
        return response;
      }).then(function (data) {
        return data;
      }).catch(function (err) {
        console.log('Error', err);
      });
    }

    /**
     * @post review_data to the server when a user submits a review
     * online: keep it in the reviews store in IndexedDB
     * offline: keep it in the offlne-reviews in IndexedDB
     * @param review_data is from a user fills out the form
     */

  }, {
    key: 'createRestaurantReview',
    value: function createRestaurantReview(review_data) {
      return fetch(DBHelper.DATABASE_URL + '/reviews', {
        method: 'POST',
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'same-origin',
        body: JSON.stringify(review_data),
        headers: {
          'content-type': 'application/json'
        },
        mode: 'cors',
        redirect: 'follow',
        referrer: 'no-referrer'
      }).then(function (response) {
        response.json().then(function (review_data) {
          /* keep datas in IndexedDB after posting data to the server when online */
          DBHelper.storeDataIndexedDb([review_data], 'reviews');
          return review_data;
        });
      }).catch(function (error) {
        review_data['updatedAt'] = new Date().getTime();
        /* keep datas in IndexedDB after posting data to the server when offline*/
        DBHelper.storeDataIndexedDb([review_data], 'offline-reviews');
        console.log('Review stored offline in IDB');
        return;
      });
    }

    /**
     * @clear data in the offline-reviews store
     */

  }, {
    key: 'clearOfflineReviews',
    value: function clearOfflineReviews() {
      var dbPromise = DBHelper.openDatabase();
      dbPromise.then(function (db) {
        var tx = db.transaction('offline-reviews', 'readwrite');
        var store = tx.objectStore('offline-reviews');
        store.clear();
      });
      return;
    }

    /**
     * @get reviews from offline-stores in IndexedDB when a user go from offline to online
     */

  }, {
    key: 'createOfflineReview',
    value: function createOfflineReview() {
      DBHelper.openDatabase().then(function (db) {
        if (!db) return;
        var tx = db.transaction('offline-reviews', 'readwrite');
        var store = tx.objectStore('offline-reviews');

        store.getAll().then(function (offlineReviews) {
          offlineReviews.forEach(function (review) {
            DBHelper.createRestaurantReview(review);
          });
          DBHelper.clearOfflineReviews();
        });
      });
    }
    /**
     *@when online update a value of a restaurant's favorite by sending the PUT request to the server
     *and store the data to IndexedDB so it can be used when offline
    */

  }, {
    key: 'toggleFavorite',
    value: function toggleFavorite(restaurant, isFavorite) {
      return fetch(DBHelper.DATABASE_URL + '/restaurants/' + restaurant.id + '/?is_favorite=' + isFavorite, {
        method: 'PUT'
      }).then(function (response) {
        console.log('updated API restaurant: ' + restaurant.id + ' favorite : ' + isFavorite);
        return response.json();
      }).then(function (data) {
        DBHelper.storeDataIndexedDb([data], 'restaurants');
        console.log('updated IDB restaurant: ' + restaurant.id + ' favorite : ' + isFavorite);
        return data;
      }).catch(function (error) {
        // convert from boolean to string because the API uses strings 'true' and 'false'
        restaurant.is_favorite = isFavorite ? 'true' : 'false';

        DBHelper.storeDataIndexedDb([restaurant], 'restaurants');
        console.log('store favorite offline');
        return;
      });
    }

    /**
    * @fill favorites in HTML so it can be used by both main and restaurant page
    */

  }, {
    key: 'fillFavoritesHTML',
    value: function fillFavoritesHTML(restaurant) {
      var label = document.createElement('label');
      label.setAttribute('aria-label', 'Label for checking favorite');
      label.className = 'fav-container';

      var icon = document.createElement('i');
      icon.className = 'fas fa-heart';
      label.append(icon);

      var input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('aria-label', 'Select favorite');

      if (restaurant.is_favorite == 'true') {
        icon.style.color = '#d32f2f';
      } else {
        icon.style.color = '#aeb0b1';
      }

      input.checked = restaurant.is_favorite == 'true';
      input.addEventListener('change', function (event) {
        event.preventDefault();
        if (input.checked == true) {
          DBHelper.toggleFavorite(restaurant, input.checked);
          icon.style.color = '#d32f2f';
        } else {
          DBHelper.toggleFavorite(restaurant, input.checked);
          icon.style.color = '#aeb0b1';
        }
      });
      label.append(input);
      return label;
    }

    /*@create these functions to add online status to the browser
     * when it is offline it will store review submissions in offline-reviews IndexedDB
     * when connectivity is reestablished, it will call the function to show new reviews on the page
    */

  }, {
    key: 'onGoOnline',
    value: function onGoOnline() {
      console.log('Going online');
      DBHelper.createOfflineReview();
    }
  }, {
    key: 'onGoOffline',
    value: function onGoOffline() {
      console.log('Going offline');
    }
  }, {
    key: 'DATABASE_URL',

    /**
     * Database URL.
     * Change this to restaurants.json file location on your server.
     */
    get: function get() {
      //const port = 1337;// Change this to your server port
      //return `https://restaurant-reviews-api.herokuapp.com/:${port}`;
      return 'https://restaurant-reviews-api.herokuapp.com';
    }
  }]);

  return DBHelper;
}();

window.addEventListener('online', DBHelper.onGoOnline);
window.addEventListener('offline', DBHelper.onGoOffline);

/* @register ServiceWorker to cache data for the site
   * to allow any page that has been visited is accessible offline
   */
navigator.serviceWorker.register('./sw.js').then(function (reg) {
  // Registration was successful
  console.log('ServiceWorker registration successful with scope: ', reg.scope);
  if (!navigator.serviceWorker.controller) {
    return;
  }
  if (reg.waiting) {
    _updateReady(reg.waiting);
    return;
  }
  if (reg.installing) {
    _trackInstalling(reg.installing);
    return;
  }

  reg.addEventListener('updatefound', function () {
    _trackInstalling(reg.installing);
  });

  var refreshing;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (refreshing) return;
    refreshing = true;
  });
}).catch(function () {
  console.log('Service worker registration failed');
});

var _updateReady = function _updateReady(worker) {
  worker.postMessage({ action: 'skipWaiting' });
};

var _trackInstalling = function _trackInstalling(worker) {
  var indexController = undefined;
  worker.addEventListener('stateChange', function () {
    if (worker.state == 'installed') {
      indexController._updateReady(worker);
    }
  });
};

exports.default = DBHelper;

},{"idb":3}],2:[function(require,module,exports){
'use strict';

var _dbhelper = require('./dbhelper');

var _dbhelper2 = _interopRequireDefault(_dbhelper);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var markers = [];

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', function () {
  _dbhelper2.default.addTitleToMap();
  initMap();
  fetchNeighborhoods();
  fetchCuisines();
});

/**
 * Initialize Google map, called from HTML.
 */
var initMap = function initMap() {
  if (typeof google !== 'undefined') {
    var loc = {
      lat: 40.722216,
      lng: -73.987501
    };
    self.map = new google.maps.Map(document.getElementById('map'), {
      zoom: 12,
      center: loc,
      scrollwheel: false
    });
    self.updateRestaurants();
  }
  self.updateRestaurants();
};

/**
 * Add markers for current restaurants to the map.
 */
var addMarkersToMap = function addMarkersToMap(restaurants) {
  restaurants.forEach(function (restaurant) {
    // Add marker to the map
    var marker = _dbhelper2.default.mapMarkerForRestaurant(restaurant, self.map);
    google.maps.event.addListener(marker, 'click', function () {
      window.location.href = marker.url;
    });
    markers.push(marker);
  });
};

/**
 * Fetch all neighborhoods and set their HTML.
 */
var fetchNeighborhoods = function fetchNeighborhoods() {
  _dbhelper2.default.fetchNeighborhoods(function (error, neighborhoods) {
    if (error) {
      // Got an error
      console.error(error);
    } else {
      fillNeighborhoodsHTML(neighborhoods);
    }
  });
};

/**
 * Set neighborhoods HTML.
 */
var fillNeighborhoodsHTML = function fillNeighborhoodsHTML(neighborhoods) {
  var select = document.getElementById('neighborhoods-select');
  neighborhoods.forEach(function (neighborhood) {
    var option = document.createElement('option');
    option.innerHTML = neighborhood;
    option.setAttribute('value', neighborhood);
    option.setAttribute('role', 'option');
    select.append(option);
  });
};

/**
 * Fetch all cuisines and set their HTML.
 */
var fetchCuisines = function fetchCuisines() {
  _dbhelper2.default.fetchCuisines(function (error, cuisines) {
    if (error) {
      // Got an error!
      console.error(error);
    } else {
      fillCuisinesHTML(cuisines);
    }
  });
};

/**
 * Set cuisines HTML.
 */
var fillCuisinesHTML = function fillCuisinesHTML(cuisines) {
  var select = document.getElementById('cuisines-select');

  cuisines.forEach(function (cuisine) {
    var option = document.createElement('option');
    option.innerHTML = cuisine;
    option.setAttribute('value', cuisine);
    option.setAttribute('role', 'option');
    select.append(option);
  });
};

/**
 * Create restaurant HTML.
 */
var createRestaurantHTML = function createRestaurantHTML(restaurant) {
  var li = document.createElement('li');

  var image = document.createElement('img');
  image.className = 'restaurant-imgs';
  image.src = _dbhelper2.default.imageUrlForRestaurant(restaurant);
  image.alt = restaurant.name + ' is ' + restaurant.cuisine_type + ' restaurant';
  li.append(image);

  var nameWrap = document.createElement('div');
  nameWrap.className = 'name-wrap';
  var name = document.createElement('h3');
  name.innerHTML = restaurant.name;
  nameWrap.append(name);
  //import the fillFavoritesHTML from dbhelper.js
  nameWrap.append(_dbhelper2.default.fillFavoritesHTML(restaurant));
  li.append(nameWrap);

  var addressWrap = document.createElement('div');
  addressWrap.className = 'address-wrap';
  var neighborhood = document.createElement('p');
  neighborhood.innerHTML = restaurant.neighborhood;
  addressWrap.append(neighborhood);

  var address = document.createElement('p');
  address.innerHTML = restaurant.address;
  addressWrap.append(address);
  li.append(addressWrap);

  var more = document.createElement('a');
  more.innerHTML = 'View Details';
  more.href = _dbhelper2.default.urlForRestaurant(restaurant);
  li.append(more);

  return li;
};

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
var resetRestaurants = function resetRestaurants(restaurants) {
  // Remove all restaurants
  restaurants = [];
  var ul = document.getElementById('restaurants-list');
  ul.innerHTML = '';

  // Remove all map markers
  markers.forEach(function (m) {
    return m.setMap(null);
  });
  markers = [];
  self.restaurants = restaurants;
};

/**
 * Create all restaurants HTML and add them to the webpage.
 */
var fillRestaurantsHTML = function fillRestaurantsHTML(restaurants) {
  var ul = document.getElementById('restaurants-list');

  restaurants.forEach(function (restaurant) {
    ul.append(createRestaurantHTML(restaurant));
  });
  if (typeof google !== 'undefined') {
    addMarkersToMap(restaurants);
  }
};

/**
 * Update page and map for current restaurants and make it global so
 * it allows index.html use this function to update the content
 */
self.updateRestaurants = function () {
  var cSelect = document.getElementById('cuisines-select');
  var nSelect = document.getElementById('neighborhoods-select');
  var fSelect = document.getElementById('favorites-select');

  var cIndex = cSelect.selectedIndex;
  var nIndex = nSelect.selectedIndex;
  var fIndex = fSelect.selectedIndex;

  var cuisine = cSelect[cIndex].value;
  var neighborhood = nSelect[nIndex].value;
  var favorite = fSelect[fIndex].value;

  _dbhelper2.default.fetchRestaurantByCuisineNeighborhoodAndFavorite(cuisine, neighborhood, favorite, function (error, restaurants) {
    if (error) {
      // Got an error!
      console.error(error);
    } else {
      resetRestaurants(restaurants);
      fillRestaurantsHTML(restaurants);
    }
  });
};

},{"./dbhelper":1}],3:[function(require,module,exports){
'use strict';

(function() {
  function toArray(arr) {
    return Array.prototype.slice.call(arr);
  }

  function promisifyRequest(request) {
    return new Promise(function(resolve, reject) {
      request.onsuccess = function() {
        resolve(request.result);
      };

      request.onerror = function() {
        reject(request.error);
      };
    });
  }

  function promisifyRequestCall(obj, method, args) {
    var request;
    var p = new Promise(function(resolve, reject) {
      request = obj[method].apply(obj, args);
      promisifyRequest(request).then(resolve, reject);
    });

    p.request = request;
    return p;
  }

  function promisifyCursorRequestCall(obj, method, args) {
    var p = promisifyRequestCall(obj, method, args);
    return p.then(function(value) {
      if (!value) return;
      return new Cursor(value, p.request);
    });
  }

  function proxyProperties(ProxyClass, targetProp, properties) {
    properties.forEach(function(prop) {
      Object.defineProperty(ProxyClass.prototype, prop, {
        get: function() {
          return this[targetProp][prop];
        },
        set: function(val) {
          this[targetProp][prop] = val;
        }
      });
    });
  }

  function proxyRequestMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function(prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function() {
        return promisifyRequestCall(this[targetProp], prop, arguments);
      };
    });
  }

  function proxyMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function(prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function() {
        return this[targetProp][prop].apply(this[targetProp], arguments);
      };
    });
  }

  function proxyCursorRequestMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function(prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function() {
        return promisifyCursorRequestCall(this[targetProp], prop, arguments);
      };
    });
  }

  function Index(index) {
    this._index = index;
  }

  proxyProperties(Index, '_index', [
    'name',
    'keyPath',
    'multiEntry',
    'unique'
  ]);

  proxyRequestMethods(Index, '_index', IDBIndex, [
    'get',
    'getKey',
    'getAll',
    'getAllKeys',
    'count'
  ]);

  proxyCursorRequestMethods(Index, '_index', IDBIndex, [
    'openCursor',
    'openKeyCursor'
  ]);

  function Cursor(cursor, request) {
    this._cursor = cursor;
    this._request = request;
  }

  proxyProperties(Cursor, '_cursor', [
    'direction',
    'key',
    'primaryKey',
    'value'
  ]);

  proxyRequestMethods(Cursor, '_cursor', IDBCursor, [
    'update',
    'delete'
  ]);

  // proxy 'next' methods
  ['advance', 'continue', 'continuePrimaryKey'].forEach(function(methodName) {
    if (!(methodName in IDBCursor.prototype)) return;
    Cursor.prototype[methodName] = function() {
      var cursor = this;
      var args = arguments;
      return Promise.resolve().then(function() {
        cursor._cursor[methodName].apply(cursor._cursor, args);
        return promisifyRequest(cursor._request).then(function(value) {
          if (!value) return;
          return new Cursor(value, cursor._request);
        });
      });
    };
  });

  function ObjectStore(store) {
    this._store = store;
  }

  ObjectStore.prototype.createIndex = function() {
    return new Index(this._store.createIndex.apply(this._store, arguments));
  };

  ObjectStore.prototype.index = function() {
    return new Index(this._store.index.apply(this._store, arguments));
  };

  proxyProperties(ObjectStore, '_store', [
    'name',
    'keyPath',
    'indexNames',
    'autoIncrement'
  ]);

  proxyRequestMethods(ObjectStore, '_store', IDBObjectStore, [
    'put',
    'add',
    'delete',
    'clear',
    'get',
    'getAll',
    'getKey',
    'getAllKeys',
    'count'
  ]);

  proxyCursorRequestMethods(ObjectStore, '_store', IDBObjectStore, [
    'openCursor',
    'openKeyCursor'
  ]);

  proxyMethods(ObjectStore, '_store', IDBObjectStore, [
    'deleteIndex'
  ]);

  function Transaction(idbTransaction) {
    this._tx = idbTransaction;
    this.complete = new Promise(function(resolve, reject) {
      idbTransaction.oncomplete = function() {
        resolve();
      };
      idbTransaction.onerror = function() {
        reject(idbTransaction.error);
      };
      idbTransaction.onabort = function() {
        reject(idbTransaction.error);
      };
    });
  }

  Transaction.prototype.objectStore = function() {
    return new ObjectStore(this._tx.objectStore.apply(this._tx, arguments));
  };

  proxyProperties(Transaction, '_tx', [
    'objectStoreNames',
    'mode'
  ]);

  proxyMethods(Transaction, '_tx', IDBTransaction, [
    'abort'
  ]);

  function UpgradeDB(db, oldVersion, transaction) {
    this._db = db;
    this.oldVersion = oldVersion;
    this.transaction = new Transaction(transaction);
  }

  UpgradeDB.prototype.createObjectStore = function() {
    return new ObjectStore(this._db.createObjectStore.apply(this._db, arguments));
  };

  proxyProperties(UpgradeDB, '_db', [
    'name',
    'version',
    'objectStoreNames'
  ]);

  proxyMethods(UpgradeDB, '_db', IDBDatabase, [
    'deleteObjectStore',
    'close'
  ]);

  function DB(db) {
    this._db = db;
  }

  DB.prototype.transaction = function() {
    return new Transaction(this._db.transaction.apply(this._db, arguments));
  };

  proxyProperties(DB, '_db', [
    'name',
    'version',
    'objectStoreNames'
  ]);

  proxyMethods(DB, '_db', IDBDatabase, [
    'close'
  ]);

  // Add cursor iterators
  // TODO: remove this once browsers do the right thing with promises
  ['openCursor', 'openKeyCursor'].forEach(function(funcName) {
    [ObjectStore, Index].forEach(function(Constructor) {
      // Don't create iterateKeyCursor if openKeyCursor doesn't exist.
      if (!(funcName in Constructor.prototype)) return;

      Constructor.prototype[funcName.replace('open', 'iterate')] = function() {
        var args = toArray(arguments);
        var callback = args[args.length - 1];
        var nativeObject = this._store || this._index;
        var request = nativeObject[funcName].apply(nativeObject, args.slice(0, -1));
        request.onsuccess = function() {
          callback(request.result);
        };
      };
    });
  });

  // polyfill getAll
  [Index, ObjectStore].forEach(function(Constructor) {
    if (Constructor.prototype.getAll) return;
    Constructor.prototype.getAll = function(query, count) {
      var instance = this;
      var items = [];

      return new Promise(function(resolve) {
        instance.iterateCursor(query, function(cursor) {
          if (!cursor) {
            resolve(items);
            return;
          }
          items.push(cursor.value);

          if (count !== undefined && items.length == count) {
            resolve(items);
            return;
          }
          cursor.continue();
        });
      });
    };
  });

  var exp = {
    open: function(name, version, upgradeCallback) {
      var p = promisifyRequestCall(indexedDB, 'open', [name, version]);
      var request = p.request;

      if (request) {
        request.onupgradeneeded = function(event) {
          if (upgradeCallback) {
            upgradeCallback(new UpgradeDB(request.result, event.oldVersion, request.transaction));
          }
        };
      }

      return p.then(function(db) {
        return new DB(db);
      });
    },
    delete: function(name) {
      return promisifyRequestCall(indexedDB, 'deleteDatabase', [name]);
    }
  };

  if (typeof module !== 'undefined') {
    module.exports = exp;
    module.exports.default = module.exports;
  }
  else {
    self.idb = exp;
  }
}());

},{}]},{},[2,1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9kYmhlbHBlci5qcyIsImpzL21haW4uanMiLCJub2RlX21vZHVsZXMvaWRiL2xpYi9pZGIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7Ozs7Ozs7QUFFQTs7Ozs7Ozs7QUFFQTs7OztJQUlNLFE7Ozs7Ozs7OztBQVdKOzs7MkNBRzhCLFUsRUFBWSxHLEVBQUs7QUFDN0MsZUFBUyxhQUFUO0FBQ0EsVUFBTSxTQUFTLElBQUksT0FBTyxJQUFQLENBQVksTUFBaEIsQ0FBdUI7QUFDcEMsa0JBQVUsV0FBVyxNQURlO0FBRXBDLGVBQU8sV0FBVyxJQUZrQjtBQUdwQyxhQUFLLFNBQVMsZ0JBQVQsQ0FBMEIsVUFBMUIsQ0FIK0I7QUFJcEMsYUFBSyxHQUorQjtBQUtwQyxtQkFBVyxPQUFPLElBQVAsQ0FBWSxTQUFaLENBQXNCO0FBTEcsT0FBdkIsQ0FBZjtBQU9BLGFBQU8sTUFBUDtBQUNEO0FBQ0Q7Ozs7OztvQ0FHdUI7QUFDckIsYUFBTyxJQUFQLENBQVksS0FBWixDQUFrQixlQUFsQixDQUFrQyxHQUFsQyxFQUF1QyxNQUF2QyxFQUErQyxZQUFNO0FBQ25ELGlCQUFTLG9CQUFULENBQThCLFFBQTlCLEVBQXdDLENBQXhDLEVBQTJDLEtBQTNDLEdBQW1ELGFBQW5EO0FBQ0QsT0FGRDtBQUdEOztBQUVEOzs7Ozs7bUNBR3NCO0FBQ3BCLFVBQUksQ0FBQyxVQUFVLGFBQWYsRUFBOEI7QUFDNUIsZUFBTyxRQUFRLE9BQVIsRUFBUDtBQUNELE9BRkQsTUFFTztBQUNMLGVBQU8sY0FBSSxJQUFKLENBQVMsYUFBVCxFQUF3QixDQUF4QixFQUEyQixVQUFDLFNBQUQsRUFBZTtBQUMvQyxvQkFBVSxpQkFBVixDQUE0QixhQUE1QixFQUEyQyxFQUFFLFNBQVMsSUFBWCxFQUEzQztBQUNBLGNBQUksY0FBYyxVQUFVLGlCQUFWLENBQTRCLFNBQTVCLEVBQXVDLEVBQUUsU0FB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QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuaW1wb3J0IGlkYiBmcm9tICdpZGInO1xyXG5cclxuLyoqXHJcbiAqIENvbW1vbiBkYXRhYmFzZSBoZWxwZXIgZnVuY3Rpb25zLlxyXG4gKi9cclxuXHJcbmNsYXNzIERCSGVscGVyIHtcclxuICAvKipcclxuICAgKiBEYXRhYmFzZSBVUkwuXHJcbiAgICogQ2hhbmdlIHRoaXMgdG8gcmVzdGF1cmFudHMuanNvbiBmaWxlIGxvY2F0aW9uIG9uIHlvdXIgc2VydmVyLlxyXG4gICAqL1xyXG4gIHN0YXRpYyBnZXQgREFUQUJBU0VfVVJMKCkge1xyXG4gICAgLy9jb25zdCBwb3J0ID0gMTMzNzsvLyBDaGFuZ2UgdGhpcyB0byB5b3VyIHNlcnZlciBwb3J0XHJcbiAgICAvL3JldHVybiBgaHR0cHM6Ly9yZXN0YXVyYW50LXJldmlld3MtYXBpLmhlcm9rdWFwcC5jb20vOiR7cG9ydH1gO1xyXG4gICAgcmV0dXJuICdodHRwczovL3Jlc3RhdXJhbnQtcmV2aWV3cy1hcGkuaGVyb2t1YXBwLmNvbSc7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBATWFwIG1hcmtlciBmb3IgYSByZXN0YXVyYW50LlxyXG4gICAqL1xyXG4gIHN0YXRpYyBtYXBNYXJrZXJGb3JSZXN0YXVyYW50KHJlc3RhdXJhbnQsIG1hcCkge1xyXG4gICAgREJIZWxwZXIuYWRkVGl0bGVUb01hcCgpO1xyXG4gICAgY29uc3QgbWFya2VyID0gbmV3IGdvb2dsZS5tYXBzLk1hcmtlcih7XHJcbiAgICAgIHBvc2l0aW9uOiByZXN0YXVyYW50LmxhdGxuZyxcclxuICAgICAgdGl0bGU6IHJlc3RhdXJhbnQubmFtZSxcclxuICAgICAgdXJsOiBEQkhlbHBlci51cmxGb3JSZXN0YXVyYW50KHJlc3RhdXJhbnQpLFxyXG4gICAgICBtYXA6IG1hcCxcclxuICAgICAgYW5pbWF0aW9uOiBnb29nbGUubWFwcy5BbmltYXRpb24uRFJPUFxyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gbWFya2VyO1xyXG4gIH1cclxuICAvKipcclxuICAgKiBAYWRkIGF0dHJpYnV0ZSB0aXRsZSB0byA8aWZyYW1lPiBpbiBHb29nbGUgTWFwIHRvIGltcHJvdmUgdGhlIGFjY2Vzc2liaWxpdHlcclxuICAgKi9cclxuICBzdGF0aWMgYWRkVGl0bGVUb01hcCgpIHtcclxuICAgIGdvb2dsZS5tYXBzLmV2ZW50LmFkZExpc3RlbmVyT25jZShtYXAsICdpZGxlJywgKCkgPT4ge1xyXG4gICAgICBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaWZyYW1lJylbMF0udGl0bGUgPSAnR29vZ2xlIE1hcHMnO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAb3BlbiBkYXRhYmFzZSB0byBzdG9yZSBkYXRhIHJldHJpZXZlZCBmcm9tIHRoZSBzZXJ2ZXIgaW4gaW5kZXhlZERCIEFQSVxyXG4gICAqL1xyXG4gIHN0YXRpYyBvcGVuRGF0YWJhc2UoKSB7XHJcbiAgICBpZiAoIW5hdmlnYXRvci5zZXJ2aWNlV29ya2VyKSB7XHJcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHJldHVybiBpZGIub3BlbigncmVzdGF1cmFudHMnLCAzLCAodXBncmFkZURiKSA9PiB7XHJcbiAgICAgICAgdXBncmFkZURiLmNyZWF0ZU9iamVjdFN0b3JlKCdyZXN0YXVyYW50cycsIHsga2V5UGF0aDogJ2lkJyB9KTtcclxuICAgICAgICBsZXQgcmV2aWV3U3RvcmUgPSB1cGdyYWRlRGIuY3JlYXRlT2JqZWN0U3RvcmUoJ3Jldmlld3MnLCB7IGtleVBhdGg6ICdpZCcgfSk7XHJcbiAgICAgICAgcmV2aWV3U3RvcmUuY3JlYXRlSW5kZXgoJ3Jlc3RhdXJhbnRfaWQnLCAncmVzdGF1cmFudF9pZCcsIHsgdW5pcXVlOiBmYWxzZSB9KTtcclxuICAgICAgICB1cGdyYWRlRGIuY3JlYXRlT2JqZWN0U3RvcmUoJ29mZmxpbmUtcmV2aWV3cycsIHsga2V5UGF0aDogJ3VwZGF0ZWRBdCcgfSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuICAvKipcclxuICAgKiBAZ2V0IGRhdGEgZnJvbSBhIHN0b3JlIGluIEluZGV4ZWREQiBpZiBpdCBpcyBhdmFpbGFibGVcclxuICAgKi9cclxuICBzdGF0aWMgZ2V0Q2FjaGVkSW5kZXhlZERCKHN0b3JlX25hbWUpIHtcclxuICAgIGxldCBkYlByb21pc2UgPSBEQkhlbHBlci5vcGVuRGF0YWJhc2UoKTtcclxuXHJcbiAgICByZXR1cm4gZGJQcm9taXNlLnRoZW4oZnVuY3Rpb24oZGIpIHtcclxuICAgICAgaWYoIWRiKSByZXR1cm47XHJcbiAgICAgIGxldCB0eCA9IGRiLnRyYW5zYWN0aW9uKHN0b3JlX25hbWUpO1xyXG4gICAgICBsZXQgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShzdG9yZV9uYW1lKTtcclxuICAgICAgcmV0dXJuIHN0b3JlLmdldEFsbCgpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAc3RvcmUgdGhlIGRhdGEgaW4gSW5kZXhlZERCIGFmdGVyIGZldGNoaW5nIGl0IGZyb20gdGhlIHNlcnZlclxyXG4gICAqIEBwYXJhbSBkYXRhczogYXJlIHJldHJpZXZlZCBmcm9tIHRoZSBzZXJ2ZXIsIHN0b3JlX25hbWU6IHtzdHJpbmd9XHJcbiAgICovXHJcbiAgc3RhdGljIHN0b3JlRGF0YUluZGV4ZWREYihkYXRhcywgc3RvcmVfbmFtZSkge1xyXG4gICAgbGV0IGRiUHJvbWlzZSA9IERCSGVscGVyLm9wZW5EYXRhYmFzZSgpO1xyXG5cclxuICAgIGRiUHJvbWlzZS50aGVuKGRiID0+IHtcclxuICAgICAgaWYgKCFkYikgcmV0dXJuO1xyXG4gICAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKHN0b3JlX25hbWUsICdyZWFkd3JpdGUnKTtcclxuICAgICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShzdG9yZV9uYW1lKTtcclxuXHJcbiAgICAgIGRhdGFzLmZvckVhY2goZGF0YSA9PiB7XHJcbiAgICAgICAgc3RvcmUucHV0KGRhdGEpO1xyXG4gICAgICB9KTtcclxuICAgICAgcmV0dXJuIHR4LmNvbXBsZXRlO1xyXG4gICAgfSk7XHJcbiAgfVxyXG4gIC8qKlxyXG4gICAqIEBmZXRjaCBhbGwgcmVzdGF1cmFudHMgZm9ybSBJbmRleGVkREIgaWYgdGhleSBleGlzdCBvdGhlcndpc2UgZmV0Y2ggZnJvbSB0aGUgc2VydmVyLlxyXG4gICAqL1xyXG4gIHN0YXRpYyBmZXRjaFJlc3RhdXJhbnRzKGNhbGxiYWNrKSB7XHJcbiAgICAvL2NoZWNrIGlmIGRhdGEgZXhpc3RzIGluIGluZGV4REIgQVBJIGlmIGl0IGRvZXMgcmV0dXJuIGNhbGxiYWNrXHJcbiAgICBEQkhlbHBlci5nZXRDYWNoZWRJbmRleGVkREIoJ3Jlc3RhdXJhbnRzJykudGhlbihyZXN1bHRzID0+IHtcclxuICAgICAgaWYgKHJlc3VsdHMgJiYgcmVzdWx0cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0cyk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gVXNlIGVsc2UgY29uZGl0aW9uIHRvIGF2b2lkIGZldGNoaW5nIGZyb20gc2FpbHMgc2VydmVyXHJcbiAgICAgICAgLy8gYmVjYXVzZSB1cGRhdGluZyBmYXZvcml0ZSBvbiB0aGUgc2FpbHMgc2VydmVyIGlzIG5vdCBwZXJzaXN0ZW50XHJcbiAgICAgICAgLy8gYW5kIHRvIGdldCBkYXRhIGZyb20gSW5kZXhlZERCIG9ubHlcclxuICAgICAgICBmZXRjaChgJHtEQkhlbHBlci5EQVRBQkFTRV9VUkx9L3Jlc3RhdXJhbnRzYClcclxuICAgICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSlcclxuICAgICAgICAgIC50aGVuKHJlc3RhdXJhbnRzID0+IHtcclxuICAgICAgICAgICAgLy9zdG9yZSBkYXRhIGluIGluZGV4REIgQVBJIGFmdGVyIGZldGNoaW5nXHJcbiAgICAgICAgICAgIERCSGVscGVyLnN0b3JlRGF0YUluZGV4ZWREYihyZXN0YXVyYW50cywgJ3Jlc3RhdXJhbnRzJyk7XHJcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhudWxsLCByZXN0YXVyYW50cyk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgICAgLmNhdGNoKGVyciA9PiB7XHJcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIgLCBudWxsKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcbiAgLyoqXHJcbiAgICogQGZldGNoIGFsbCByZXZpZXdzIGZvcm0gSW5kZXhlZERCIGlmIHRoZXkgZXhpc3Qgb3RoZXJ3aXNlIGZldGNoIGZyb20gdGhlIHNlcnZlci5cclxuICAgKi9cclxuICBzdGF0aWMgZmV0Y2hSZXN0YXVyYW50UmV2aWV3cyhyZXN0YXVyYW50LCBjYWxsYmFjaykge1xyXG4gICAgbGV0IGRiUHJvbWlzZSA9IERCSGVscGVyLm9wZW5EYXRhYmFzZSgpO1xyXG5cclxuICAgIGRiUHJvbWlzZS50aGVuKGRiID0+IHtcclxuICAgICAgaWYgKCFkYikgcmV0dXJuO1xyXG5cclxuICAgICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbigncmV2aWV3cycpO1xyXG4gICAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKCdyZXZpZXdzJyk7XHJcbiAgICAgIGNvbnN0IGluZGV4ID0gc3RvcmUuaW5kZXgoJ3Jlc3RhdXJhbnRfaWQnKTtcclxuXHJcbiAgICAgIGluZGV4LmdldEFsbChyZXN0YXVyYW50LmlkKS50aGVuKHJlc3VsdHMgPT4ge1xyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdHMpO1xyXG5cclxuICAgICAgICBpZiAoIW5hdmlnYXRvci5vbkxpbmUpIHtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZldGNoKGAke0RCSGVscGVyLkRBVEFCQVNFX1VSTH0vcmV2aWV3cy8/cmVzdGF1cmFudF9pZD0ke3Jlc3RhdXJhbnQuaWR9YClcclxuICAgICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24oKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICAgICAudGhlbihyZXZpZXdzID0+IHtcclxuICAgICAgICAgICAgLy9zdG9yZSBkYXRhIGluIGluZGV4REIgQVBJIGFmdGVyIGZldGNoaW5nXHJcbiAgICAgICAgICAgIGxldCByZXZpZXdzTGVuID0gcmV2aWV3cy5sZW5ndGg7XHJcbiAgICAgICAgICAgIGlmIChyZXZpZXdzTGVuID49IDI5KSB7XHJcbiAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZXZpZXdzTGVuIC0gMjA7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgREJIZWxwZXIuZGVsZXRlUmVzdGF1cmFudFJldmlld3MocmV2aWV3c1tpXS5pZCk7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIERCSGVscGVyLnN0b3JlRGF0YUluZGV4ZWREYihyZXZpZXdzLCAncmV2aWV3cycpO1xyXG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCByZXZpZXdzKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICAgICAuY2F0Y2goZXJyID0+IHtcclxuICAgICAgICAgICAgY2FsbGJhY2soZXJyICwgbnVsbCk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEBmZXRjaCBhIHJlc3RhdXJhbnQgYnkgaXRzIElELlxyXG4gICAqL1xyXG4gIHN0YXRpYyBmZXRjaFJlc3RhdXJhbnRCeUlkKGlkLCBjYWxsYmFjaykge1xyXG4gICAgLy8gZmV0Y2ggYWxsIHJlc3RhdXJhbnRzIHdpdGggcHJvcGVyIGVycm9yIGhhbmRsaW5nLlxyXG4gICAgREJIZWxwZXIuZmV0Y2hSZXN0YXVyYW50cygoZXJyb3IsIHJlc3RhdXJhbnRzKSA9PiB7XHJcbiAgICAgIGlmIChlcnJvcikge1xyXG4gICAgICAgIGNhbGxiYWNrKGVycm9yLCBudWxsKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zdCByZXN0YXVyYW50ID0gcmVzdGF1cmFudHMuZmluZChyID0+IHIuaWQgPT0gaWQpO1xyXG4gICAgICAgIGlmIChyZXN0YXVyYW50KSB7IC8vIEdvdCB0aGUgcmVzdGF1cmFudFxyXG4gICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdGF1cmFudCk7XHJcbiAgICAgICAgfSBlbHNlIHsgLy8gUmVzdGF1cmFudCBkb2VzIG5vdCBleGlzdCBpbiB0aGUgZGF0YWJhc2VcclxuICAgICAgICAgIGNhbGxiYWNrKCdSZXN0YXVyYW50IGRvZXMgbm90IGV4aXN0JywgbnVsbCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEBmZXRjaCByZXN0YXVyYW50cyBieSBhIGN1aXNpbmUgdHlwZSB3aXRoIHByb3BlciBlcnJvciBoYW5kbGluZy5cclxuICAgKi9cclxuICBzdGF0aWMgZmV0Y2hSZXN0YXVyYW50QnlDdWlzaW5lKGN1aXNpbmUsIGNhbGxiYWNrKSB7XHJcbiAgICAvLyBGZXRjaCBhbGwgcmVzdGF1cmFudHMgIHdpdGggcHJvcGVyIGVycm9yIGhhbmRsaW5nXHJcbiAgICBEQkhlbHBlci5mZXRjaFJlc3RhdXJhbnRzKChlcnJvciwgcmVzdGF1cmFudHMpID0+IHtcclxuICAgICAgaWYgKGVycm9yKSB7XHJcbiAgICAgICAgY2FsbGJhY2soZXJyb3IsIG51bGwpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIEZpbHRlciByZXN0YXVyYW50cyB0byBoYXZlIG9ubHkgZ2l2ZW4gY3Vpc2luZSB0eXBlXHJcbiAgICAgICAgY29uc3QgcmVzdWx0cyA9IHJlc3RhdXJhbnRzLmZpbHRlcihyID0+IHIuY3Vpc2luZV90eXBlID09IGN1aXNpbmUpO1xyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdHMpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEBmZXRjaCByZXN0YXVyYW50cyBieSBhIG5laWdoYm9yaG9vZCB3aXRoIHByb3BlciBlcnJvciBoYW5kbGluZy5cclxuICAgKi9cclxuICBzdGF0aWMgZmV0Y2hSZXN0YXVyYW50QnlOZWlnaGJvcmhvb2QobmVpZ2hib3Job29kLCBjYWxsYmFjaykge1xyXG4gICAgLy8gRmV0Y2ggYWxsIHJlc3RhdXJhbnRzXHJcbiAgICBEQkhlbHBlci5mZXRjaFJlc3RhdXJhbnRzKChlcnJvciwgcmVzdGF1cmFudHMpID0+IHtcclxuICAgICAgaWYgKGVycm9yKSB7XHJcbiAgICAgICAgY2FsbGJhY2soZXJyb3IsIG51bGwpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIEZpbHRlciByZXN0YXVyYW50cyB0byBoYXZlIG9ubHkgZ2l2ZW4gbmVpZ2hib3Job29kXHJcbiAgICAgICAgY29uc3QgcmVzdWx0cyA9IHJlc3RhdXJhbnRzLmZpbHRlcihyID0+IHIubmVpZ2hib3Job29kID09IG5laWdoYm9yaG9vZCk7XHJcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0cyk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQGZldGNoIHJlc3RhdXJhbnRzIGJ5IGEgY3Vpc2luZSBhbmQgYSBuZWlnaGJvcmhvb2Qgd2l0aCBwcm9wZXIgZXJyb3IgaGFuZGxpbmcuXHJcbiAgICovXHJcbiAgc3RhdGljIGZldGNoUmVzdGF1cmFudEJ5Q3Vpc2luZUFuZE5laWdoYm9yaG9vZChjdWlzaW5lLCBuZWlnaGJvcmhvb2QsIGNhbGxiYWNrKSB7XHJcbiAgICAvLyBGZXRjaCBhbGwgcmVzdGF1cmFudHNcclxuICAgIERCSGVscGVyLmZldGNoUmVzdGF1cmFudHMoKGVycm9yLCByZXN0YXVyYW50cykgPT4ge1xyXG4gICAgICBpZiAoZXJyb3IpIHtcclxuICAgICAgICBjYWxsYmFjayhlcnJvciwgbnVsbCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgbGV0IHJlc3VsdHMgPSByZXN0YXVyYW50cztcclxuICAgICAgICBpZiAoY3Vpc2luZSAhPSAnYWxsJykgeyAvLyBmaWx0ZXIgYnkgY3Vpc2luZVxyXG4gICAgICAgICAgcmVzdWx0cyA9IHJlc3VsdHMuZmlsdGVyKHIgPT4gci5jdWlzaW5lX3R5cGUgPT0gY3Vpc2luZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChuZWlnaGJvcmhvb2QgIT0gJ2FsbCcpIHsgLy8gZmlsdGVyIGJ5IG5laWdoYm9yaG9vZFxyXG4gICAgICAgICAgcmVzdWx0cyA9IHJlc3VsdHMuZmlsdGVyKHIgPT4gci5uZWlnaGJvcmhvb2QgPT0gbmVpZ2hib3Job29kKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0cyk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgc3RhdGljIGZldGNoUmVzdGF1cmFudEJ5Q3Vpc2luZU5laWdoYm9yaG9vZEFuZEZhdm9yaXRlKGN1aXNpbmUsIG5laWdoYm9yaG9vZCwgZmF2b3JpdGUsIGNhbGxiYWNrKSB7XHJcbiAgICAvLyBGZXRjaCBhbGwgcmVzdGF1cmFudHNcclxuICAgIERCSGVscGVyLmZldGNoUmVzdGF1cmFudHMoKGVycm9yLCByZXN0YXVyYW50cykgPT4ge1xyXG4gICAgICBpZiAoZXJyb3IpIHtcclxuICAgICAgICBjYWxsYmFjayhlcnJvciwgbnVsbCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgbGV0IHJlc3VsdHMgPSByZXN0YXVyYW50cztcclxuICAgICAgICBpZiAoY3Vpc2luZSAhPSAnYWxsJykgeyAvLyBmaWx0ZXIgYnkgY3Vpc2luZVxyXG4gICAgICAgICAgcmVzdWx0cyA9IHJlc3VsdHMuZmlsdGVyKHIgPT4gci5jdWlzaW5lX3R5cGUgPT0gY3Vpc2luZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChuZWlnaGJvcmhvb2QgIT0gJ2FsbCcpIHsgLy8gZmlsdGVyIGJ5IG5laWdoYm9yaG9vZFxyXG4gICAgICAgICAgcmVzdWx0cyA9IHJlc3VsdHMuZmlsdGVyKHIgPT4gci5uZWlnaGJvcmhvb2QgPT0gbmVpZ2hib3Job29kKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGZhdm9yaXRlID09ICd0cnVlJykge1xyXG4gICAgICAgICAgcmVzdWx0cyA9IHJlc3VsdHMuZmlsdGVyKHIgPT4gci5pc19mYXZvcml0ZSA9PSAndHJ1ZScpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHRzKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAZmV0Y2ggYWxsIG5laWdoYm9yaG9vZHMgd2l0aCBwcm9wZXIgZXJyb3IgaGFuZGxpbmcuXHJcbiAgICovXHJcbiAgc3RhdGljIGZldGNoTmVpZ2hib3Job29kcyhjYWxsYmFjaykge1xyXG4gICAgLy8gRmV0Y2ggYWxsIHJlc3RhdXJhbnRzXHJcbiAgICBEQkhlbHBlci5mZXRjaFJlc3RhdXJhbnRzKChlcnJvciwgcmVzdGF1cmFudHMpID0+IHtcclxuICAgICAgaWYgKGVycm9yKSB7XHJcbiAgICAgICAgY2FsbGJhY2soZXJyb3IsIG51bGwpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIEdldCBhbGwgbmVpZ2hib3Job29kcyBmcm9tIGFsbCByZXN0YXVyYW50c1xyXG4gICAgICAgIGNvbnN0IG5laWdoYm9yaG9vZHMgPSByZXN0YXVyYW50cy5tYXAoKHYsIGkpID0+IHJlc3RhdXJhbnRzW2ldLm5laWdoYm9yaG9vZCk7XHJcbiAgICAgICAgLy8gUmVtb3ZlIGR1cGxpY2F0ZXMgZnJvbSBuZWlnaGJvcmhvb2RzXHJcbiAgICAgICAgY29uc3QgdW5pcXVlTmVpZ2hib3Job29kcyA9IG5laWdoYm9yaG9vZHMuZmlsdGVyKCh2LCBpKSA9PiBuZWlnaGJvcmhvb2RzLmluZGV4T2YodikgPT0gaSk7XHJcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgdW5pcXVlTmVpZ2hib3Job29kcyk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQGZldGNoIGFsbCBjdWlzaW5lcyB3aXRoIHByb3BlciBlcnJvciBoYW5kbGluZy5cclxuICAgKi9cclxuICBzdGF0aWMgZmV0Y2hDdWlzaW5lcyhjYWxsYmFjaykge1xyXG4gICAgLy8gRmV0Y2ggYWxsIHJlc3RhdXJhbnRzXHJcbiAgICBEQkhlbHBlci5mZXRjaFJlc3RhdXJhbnRzKChlcnJvciwgcmVzdGF1cmFudHMpID0+IHtcclxuICAgICAgaWYgKGVycm9yKSB7XHJcbiAgICAgICAgY2FsbGJhY2soZXJyb3IsIG51bGwpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIEdldCBhbGwgY3Vpc2luZXMgZnJvbSBhbGwgcmVzdGF1cmFudHNcclxuICAgICAgICBjb25zdCBjdWlzaW5lcyA9IHJlc3RhdXJhbnRzLm1hcCgodiwgaSkgPT4gcmVzdGF1cmFudHNbaV0uY3Vpc2luZV90eXBlKTtcclxuICAgICAgICAvLyBSZW1vdmUgZHVwbGljYXRlcyBmcm9tIGN1aXNpbmVzXHJcbiAgICAgICAgY29uc3QgdW5pcXVlQ3Vpc2luZXMgPSBjdWlzaW5lcy5maWx0ZXIoKHYsIGkpID0+IGN1aXNpbmVzLmluZGV4T2YodikgPT0gaSk7XHJcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgdW5pcXVlQ3Vpc2luZXMpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEByZXN0YXVyYW50IHBhZ2UgVVJMLlxyXG4gICAqL1xyXG4gIHN0YXRpYyB1cmxGb3JSZXN0YXVyYW50KHJlc3RhdXJhbnQpIHtcclxuICAgIHJldHVybiAoYC4vcmVzdGF1cmFudC5odG1sP2lkPSR7cmVzdGF1cmFudC5pZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEByZXN0YXVyYW50IGltYWdlIFVSTC5cclxuICAgKi9cclxuICBzdGF0aWMgaW1hZ2VVcmxGb3JSZXN0YXVyYW50KHJlc3RhdXJhbnQpIHtcclxuICAgIGlmIChyZXN0YXVyYW50LnBob3RvZ3JhcGggPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICByZXN0YXVyYW50LnBob3RvZ3JhcGggPSAxMDtcclxuICAgIH1cclxuICAgIHJldHVybiAoYGltZy8ke3Jlc3RhdXJhbnQucGhvdG9ncmFwaH0ud2VicGApO1xyXG4gIH1cclxuXHJcbiAgc3RhdGljIGRlbGV0ZVJlc3RhdXJhbnRSZXZpZXdzKHJldmlld19pZCkge1xyXG4gICAgZmV0Y2goYCR7REJIZWxwZXIuREFUQUJBU0VfVVJMfS9yZXZpZXdzLyR7cmV2aWV3X2lkfWAsIHtcclxuICAgICAgbWV0aG9kOiAnREVMRVRFJ1xyXG4gICAgfSlcclxuICAgICAgLnRoZW4ocmVzcG9uc2UgPT4ge1xyXG4gICAgICAgIHJldHVybiByZXNwb25zZTtcclxuICAgICAgfSlcclxuICAgICAgLnRoZW4oZGF0YSA9PiB7XHJcbiAgICAgICAgcmV0dXJuIGRhdGE7XHJcbiAgICAgIH0pXHJcbiAgICAgIC5jYXRjaChlcnIgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdFcnJvcicsIGVycik7XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQHBvc3QgcmV2aWV3X2RhdGEgdG8gdGhlIHNlcnZlciB3aGVuIGEgdXNlciBzdWJtaXRzIGEgcmV2aWV3XHJcbiAgICogb25saW5lOiBrZWVwIGl0IGluIHRoZSByZXZpZXdzIHN0b3JlIGluIEluZGV4ZWREQlxyXG4gICAqIG9mZmxpbmU6IGtlZXAgaXQgaW4gdGhlIG9mZmxuZS1yZXZpZXdzIGluIEluZGV4ZWREQlxyXG4gICAqIEBwYXJhbSByZXZpZXdfZGF0YSBpcyBmcm9tIGEgdXNlciBmaWxscyBvdXQgdGhlIGZvcm1cclxuICAgKi9cclxuICBzdGF0aWMgY3JlYXRlUmVzdGF1cmFudFJldmlldyhyZXZpZXdfZGF0YSkge1xyXG4gICAgcmV0dXJuIGZldGNoKGAke0RCSGVscGVyLkRBVEFCQVNFX1VSTH0vcmV2aWV3c2AsIHtcclxuICAgICAgbWV0aG9kOiAnUE9TVCcsXHJcbiAgICAgIGNhY2hlOiAnbm8tY2FjaGUnLCAvLyAqZGVmYXVsdCwgbm8tY2FjaGUsIHJlbG9hZCwgZm9yY2UtY2FjaGUsIG9ubHktaWYtY2FjaGVkXHJcbiAgICAgIGNyZWRlbnRpYWxzOiAnc2FtZS1vcmlnaW4nLFxyXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZXZpZXdfZGF0YSksXHJcbiAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXHJcbiAgICAgIH0sXHJcbiAgICAgIG1vZGU6ICdjb3JzJyxcclxuICAgICAgcmVkaXJlY3Q6ICdmb2xsb3cnLFxyXG4gICAgICByZWZlcnJlcjogJ25vLXJlZmVycmVyJyxcclxuICAgIH0pXHJcbiAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcclxuICAgICAgICByZXNwb25zZS5qc29uKClcclxuICAgICAgICAgIC50aGVuKHJldmlld19kYXRhID0+IHtcclxuICAgICAgICAgIC8qIGtlZXAgZGF0YXMgaW4gSW5kZXhlZERCIGFmdGVyIHBvc3RpbmcgZGF0YSB0byB0aGUgc2VydmVyIHdoZW4gb25saW5lICovXHJcbiAgICAgICAgICAgIERCSGVscGVyLnN0b3JlRGF0YUluZGV4ZWREYihbcmV2aWV3X2RhdGFdLCAncmV2aWV3cycpO1xyXG4gICAgICAgICAgICByZXR1cm4gcmV2aWV3X2RhdGE7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgfSlcclxuICAgICAgLmNhdGNoKGVycm9yID0+IHtcclxuICAgICAgICByZXZpZXdfZGF0YVsndXBkYXRlZEF0J10gPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcclxuICAgICAgICAvKiBrZWVwIGRhdGFzIGluIEluZGV4ZWREQiBhZnRlciBwb3N0aW5nIGRhdGEgdG8gdGhlIHNlcnZlciB3aGVuIG9mZmxpbmUqL1xyXG4gICAgICAgIERCSGVscGVyLnN0b3JlRGF0YUluZGV4ZWREYihbcmV2aWV3X2RhdGFdLCAnb2ZmbGluZS1yZXZpZXdzJyk7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ1JldmlldyBzdG9yZWQgb2ZmbGluZSBpbiBJREInKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQGNsZWFyIGRhdGEgaW4gdGhlIG9mZmxpbmUtcmV2aWV3cyBzdG9yZVxyXG4gICAqL1xyXG4gIHN0YXRpYyBjbGVhck9mZmxpbmVSZXZpZXdzKCkge1xyXG4gICAgbGV0IGRiUHJvbWlzZSA9IERCSGVscGVyLm9wZW5EYXRhYmFzZSgpO1xyXG4gICAgZGJQcm9taXNlLnRoZW4oZGIgPT4ge1xyXG4gICAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKCdvZmZsaW5lLXJldmlld3MnLCAncmVhZHdyaXRlJyk7XHJcbiAgICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoJ29mZmxpbmUtcmV2aWV3cycpO1xyXG4gICAgICBzdG9yZS5jbGVhcigpO1xyXG4gICAgfSk7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAZ2V0IHJldmlld3MgZnJvbSBvZmZsaW5lLXN0b3JlcyBpbiBJbmRleGVkREIgd2hlbiBhIHVzZXIgZ28gZnJvbSBvZmZsaW5lIHRvIG9ubGluZVxyXG4gICAqL1xyXG4gIHN0YXRpYyBjcmVhdGVPZmZsaW5lUmV2aWV3KCkge1xyXG4gICAgREJIZWxwZXIub3BlbkRhdGFiYXNlKCkudGhlbihkYiA9PiB7XHJcbiAgICAgIGlmICghZGIpIHJldHVybjtcclxuICAgICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbignb2ZmbGluZS1yZXZpZXdzJywgJ3JlYWR3cml0ZScpO1xyXG4gICAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKCdvZmZsaW5lLXJldmlld3MnKTtcclxuXHJcbiAgICAgIHN0b3JlLmdldEFsbCgpLnRoZW4ob2ZmbGluZVJldmlld3MgPT4ge1xyXG4gICAgICAgIG9mZmxpbmVSZXZpZXdzLmZvckVhY2gocmV2aWV3ID0+IHtcclxuICAgICAgICAgIERCSGVscGVyLmNyZWF0ZVJlc3RhdXJhbnRSZXZpZXcocmV2aWV3KTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBEQkhlbHBlci5jbGVhck9mZmxpbmVSZXZpZXdzKCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG4gIC8qKlxyXG4gICAqQHdoZW4gb25saW5lIHVwZGF0ZSBhIHZhbHVlIG9mIGEgcmVzdGF1cmFudCdzIGZhdm9yaXRlIGJ5IHNlbmRpbmcgdGhlIFBVVCByZXF1ZXN0IHRvIHRoZSBzZXJ2ZXJcclxuICAgKmFuZCBzdG9yZSB0aGUgZGF0YSB0byBJbmRleGVkREIgc28gaXQgY2FuIGJlIHVzZWQgd2hlbiBvZmZsaW5lXHJcbiAgKi9cclxuICBzdGF0aWMgdG9nZ2xlRmF2b3JpdGUocmVzdGF1cmFudCwgaXNGYXZvcml0ZSkge1xyXG4gICAgcmV0dXJuIGZldGNoKGAke0RCSGVscGVyLkRBVEFCQVNFX1VSTH0vcmVzdGF1cmFudHMvJHtyZXN0YXVyYW50LmlkfS8/aXNfZmF2b3JpdGU9JHtpc0Zhdm9yaXRlfWAsIHtcclxuICAgICAgbWV0aG9kOiAnUFVUJyxcclxuICAgIH0pXHJcbiAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcclxuICAgICAgICBjb25zb2xlLmxvZyhgdXBkYXRlZCBBUEkgcmVzdGF1cmFudDogJHtyZXN0YXVyYW50LmlkfSBmYXZvcml0ZSA6ICR7aXNGYXZvcml0ZX1gKTtcclxuICAgICAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpO1xyXG4gICAgICB9KVxyXG4gICAgICAudGhlbihkYXRhID0+IHtcclxuICAgICAgICBEQkhlbHBlci5zdG9yZURhdGFJbmRleGVkRGIoW2RhdGFdLCAncmVzdGF1cmFudHMnKTtcclxuICAgICAgICBjb25zb2xlLmxvZyhgdXBkYXRlZCBJREIgcmVzdGF1cmFudDogJHtyZXN0YXVyYW50LmlkfSBmYXZvcml0ZSA6ICR7aXNGYXZvcml0ZX1gKTtcclxuICAgICAgICByZXR1cm4gZGF0YTtcclxuICAgICAgfSlcclxuICAgICAgLmNhdGNoKGVycm9yID0+IHtcclxuICAgICAgICAvLyBjb252ZXJ0IGZyb20gYm9vbGVhbiB0byBzdHJpbmcgYmVjYXVzZSB0aGUgQVBJIHVzZXMgc3RyaW5ncyAndHJ1ZScgYW5kICdmYWxzZSdcclxuICAgICAgICByZXN0YXVyYW50LmlzX2Zhdm9yaXRlID0gaXNGYXZvcml0ZSA/ICd0cnVlJyA6ICdmYWxzZSc7XHJcblxyXG4gICAgICAgIERCSGVscGVyLnN0b3JlRGF0YUluZGV4ZWREYihbcmVzdGF1cmFudF0sICdyZXN0YXVyYW50cycpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdzdG9yZSBmYXZvcml0ZSBvZmZsaW5lJyk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gKiBAZmlsbCBmYXZvcml0ZXMgaW4gSFRNTCBzbyBpdCBjYW4gYmUgdXNlZCBieSBib3RoIG1haW4gYW5kIHJlc3RhdXJhbnQgcGFnZVxyXG4gKi9cclxuICBzdGF0aWMgZmlsbEZhdm9yaXRlc0hUTUwocmVzdGF1cmFudCkge1xyXG4gICAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsYWJlbCcpO1xyXG4gICAgbGFiZWwuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0xhYmVsIGZvciBjaGVja2luZyBmYXZvcml0ZScpO1xyXG4gICAgbGFiZWwuY2xhc3NOYW1lID0gJ2Zhdi1jb250YWluZXInO1xyXG5cclxuICAgIGNvbnN0IGljb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpJyk7XHJcbiAgICBpY29uLmNsYXNzTmFtZSA9ICdmYXMgZmEtaGVhcnQnO1xyXG4gICAgbGFiZWwuYXBwZW5kKGljb24pO1xyXG5cclxuICAgIGNvbnN0IGlucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcclxuICAgIGlucHV0LnR5cGUgPSAnY2hlY2tib3gnO1xyXG4gICAgaW5wdXQuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ1NlbGVjdCBmYXZvcml0ZScpO1xyXG5cclxuICAgIGlmIChyZXN0YXVyYW50LmlzX2Zhdm9yaXRlID09ICd0cnVlJykge1xyXG4gICAgICBpY29uLnN0eWxlLmNvbG9yID0gJyNkMzJmMmYnO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgaWNvbi5zdHlsZS5jb2xvciA9ICcjYWViMGIxJztcclxuICAgIH1cclxuXHJcbiAgICBpbnB1dC5jaGVja2VkID0gKHJlc3RhdXJhbnQuaXNfZmF2b3JpdGUgID09ICd0cnVlJyk7XHJcbiAgICBpbnB1dC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBldmVudCA9PiB7XHJcbiAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgIGlmIChpbnB1dC5jaGVja2VkID09IHRydWUpIHtcclxuICAgICAgICBEQkhlbHBlci50b2dnbGVGYXZvcml0ZShyZXN0YXVyYW50LCBpbnB1dC5jaGVja2VkKTtcclxuICAgICAgICBpY29uLnN0eWxlLmNvbG9yID0gJyNkMzJmMmYnO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIERCSGVscGVyLnRvZ2dsZUZhdm9yaXRlKHJlc3RhdXJhbnQsIGlucHV0LmNoZWNrZWQpO1xyXG4gICAgICAgIGljb24uc3R5bGUuY29sb3IgPSAnI2FlYjBiMSc7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgbGFiZWwuYXBwZW5kKGlucHV0KTtcclxuICAgIHJldHVybiBsYWJlbDtcclxuICB9XHJcblxyXG4gIC8qQGNyZWF0ZSB0aGVzZSBmdW5jdGlvbnMgdG8gYWRkIG9ubGluZSBzdGF0dXMgdG8gdGhlIGJyb3dzZXJcclxuICAgKiB3aGVuIGl0IGlzIG9mZmxpbmUgaXQgd2lsbCBzdG9yZSByZXZpZXcgc3VibWlzc2lvbnMgaW4gb2ZmbGluZS1yZXZpZXdzIEluZGV4ZWREQlxyXG4gICAqIHdoZW4gY29ubmVjdGl2aXR5IGlzIHJlZXN0YWJsaXNoZWQsIGl0IHdpbGwgY2FsbCB0aGUgZnVuY3Rpb24gdG8gc2hvdyBuZXcgcmV2aWV3cyBvbiB0aGUgcGFnZVxyXG4gICovXHJcbiAgc3RhdGljIG9uR29PbmxpbmUoKSB7XHJcbiAgICBjb25zb2xlLmxvZygnR29pbmcgb25saW5lJyk7XHJcbiAgICBEQkhlbHBlci5jcmVhdGVPZmZsaW5lUmV2aWV3KCk7XHJcbiAgfVxyXG5cclxuICBzdGF0aWMgb25Hb09mZmxpbmUoKSB7XHJcbiAgICBjb25zb2xlLmxvZygnR29pbmcgb2ZmbGluZScpO1xyXG4gIH1cclxufVxyXG5cclxud2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ29ubGluZScsIERCSGVscGVyLm9uR29PbmxpbmUpO1xyXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignb2ZmbGluZScsIERCSGVscGVyLm9uR29PZmZsaW5lKTtcclxuXHJcbi8qIEByZWdpc3RlciBTZXJ2aWNlV29ya2VyIHRvIGNhY2hlIGRhdGEgZm9yIHRoZSBzaXRlXHJcbiAgICogdG8gYWxsb3cgYW55IHBhZ2UgdGhhdCBoYXMgYmVlbiB2aXNpdGVkIGlzIGFjY2Vzc2libGUgb2ZmbGluZVxyXG4gICAqL1xyXG5uYXZpZ2F0b3Iuc2VydmljZVdvcmtlci5yZWdpc3RlcignLi9zdy5qcycpXHJcbiAgLnRoZW4oZnVuY3Rpb24ocmVnKSB7XHJcbiAgLy8gUmVnaXN0cmF0aW9uIHdhcyBzdWNjZXNzZnVsXHJcbiAgICBjb25zb2xlLmxvZygnU2VydmljZVdvcmtlciByZWdpc3RyYXRpb24gc3VjY2Vzc2Z1bCB3aXRoIHNjb3BlOiAnLCByZWcuc2NvcGUpO1xyXG4gICAgaWYgKCFuYXZpZ2F0b3Iuc2VydmljZVdvcmtlci5jb250cm9sbGVyKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGlmIChyZWcud2FpdGluZykge1xyXG4gICAgICBfdXBkYXRlUmVhZHkocmVnLndhaXRpbmcpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBpZiAocmVnLmluc3RhbGxpbmcpIHtcclxuICAgICAgX3RyYWNrSW5zdGFsbGluZyhyZWcuaW5zdGFsbGluZyk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICByZWcuYWRkRXZlbnRMaXN0ZW5lcigndXBkYXRlZm91bmQnLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgIF90cmFja0luc3RhbGxpbmcocmVnLmluc3RhbGxpbmcpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdmFyIHJlZnJlc2hpbmc7XHJcbiAgICBuYXZpZ2F0b3Iuc2VydmljZVdvcmtlci5hZGRFdmVudExpc3RlbmVyKCdjb250cm9sbGVyY2hhbmdlJywgZnVuY3Rpb24gKCkge1xyXG4gICAgICBpZiAocmVmcmVzaGluZykgcmV0dXJuO1xyXG4gICAgICByZWZyZXNoaW5nID0gdHJ1ZTtcclxuICAgIH0pO1xyXG4gIH0pXHJcbiAgLmNhdGNoKGZ1bmN0aW9uICgpIHtcclxuICAgIGNvbnNvbGUubG9nKCdTZXJ2aWNlIHdvcmtlciByZWdpc3RyYXRpb24gZmFpbGVkJyk7XHJcbiAgfSk7XHJcblxyXG5sZXQgX3VwZGF0ZVJlYWR5ID0gKHdvcmtlcikgPT4ge1xyXG4gIHdvcmtlci5wb3N0TWVzc2FnZSh7YWN0aW9uOiAnc2tpcFdhaXRpbmcnfSk7XHJcbn07XHJcblxyXG5sZXQgIF90cmFja0luc3RhbGxpbmcgPSAod29ya2VyKSA9PiB7XHJcbiAgbGV0IGluZGV4Q29udHJvbGxlciA9IHRoaXM7XHJcbiAgd29ya2VyLmFkZEV2ZW50TGlzdGVuZXIoJ3N0YXRlQ2hhbmdlJywgZnVuY3Rpb24oKSB7XHJcbiAgICBpZiAod29ya2VyLnN0YXRlID09ICdpbnN0YWxsZWQnKSB7XHJcbiAgICAgIGluZGV4Q29udHJvbGxlci5fdXBkYXRlUmVhZHkod29ya2VyKTtcclxuICAgIH1cclxuICB9KTtcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IERCSGVscGVyO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG5pbXBvcnQgREJIZWxwZXIgZnJvbSAnLi9kYmhlbHBlcic7XHJcblxyXG52YXIgbWFya2VycyA9IFtdO1xyXG5cclxuLyoqXHJcbiAqIEZldGNoIG5laWdoYm9yaG9vZHMgYW5kIGN1aXNpbmVzIGFzIHNvb24gYXMgdGhlIHBhZ2UgaXMgbG9hZGVkLlxyXG4gKi9cclxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsICgpID0+IHtcclxuICBEQkhlbHBlci5hZGRUaXRsZVRvTWFwKCk7XHJcbiAgaW5pdE1hcCgpO1xyXG4gIGZldGNoTmVpZ2hib3Job29kcygpO1xyXG4gIGZldGNoQ3Vpc2luZXMoKTtcclxufSk7XHJcblxyXG4vKipcclxuICogSW5pdGlhbGl6ZSBHb29nbGUgbWFwLCBjYWxsZWQgZnJvbSBIVE1MLlxyXG4gKi9cclxubGV0IGluaXRNYXAgPSAoKSA9PiB7XHJcbiAgaWYgKHR5cGVvZiBnb29nbGUgIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICBsZXQgbG9jID0ge1xyXG4gICAgICBsYXQ6IDQwLjcyMjIxNixcclxuICAgICAgbG5nOiAtNzMuOTg3NTAxXHJcbiAgICB9O1xyXG4gICAgc2VsZi5tYXAgPSBuZXcgZ29vZ2xlLm1hcHMuTWFwKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtYXAnKSwge1xyXG4gICAgICB6b29tOiAxMixcclxuICAgICAgY2VudGVyOiBsb2MsXHJcbiAgICAgIHNjcm9sbHdoZWVsOiBmYWxzZVxyXG4gICAgfSk7XHJcbiAgICBzZWxmLnVwZGF0ZVJlc3RhdXJhbnRzKCk7XHJcbiAgfVxyXG4gIHNlbGYudXBkYXRlUmVzdGF1cmFudHMoKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBBZGQgbWFya2VycyBmb3IgY3VycmVudCByZXN0YXVyYW50cyB0byB0aGUgbWFwLlxyXG4gKi9cclxubGV0IGFkZE1hcmtlcnNUb01hcCA9IChyZXN0YXVyYW50cykgPT4ge1xyXG4gIHJlc3RhdXJhbnRzLmZvckVhY2gocmVzdGF1cmFudCA9PiB7XHJcbiAgICAvLyBBZGQgbWFya2VyIHRvIHRoZSBtYXBcclxuICAgIGNvbnN0IG1hcmtlciA9IERCSGVscGVyLm1hcE1hcmtlckZvclJlc3RhdXJhbnQocmVzdGF1cmFudCwgc2VsZi5tYXApO1xyXG4gICAgZ29vZ2xlLm1hcHMuZXZlbnQuYWRkTGlzdGVuZXIobWFya2VyLCAnY2xpY2snLCAoKSA9PiB7XHJcbiAgICAgIHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gbWFya2VyLnVybDtcclxuICAgIH0pO1xyXG4gICAgbWFya2Vycy5wdXNoKG1hcmtlcik7XHJcbiAgfSk7XHJcbn07XHJcblxyXG4vKipcclxuICogRmV0Y2ggYWxsIG5laWdoYm9yaG9vZHMgYW5kIHNldCB0aGVpciBIVE1MLlxyXG4gKi9cclxubGV0IGZldGNoTmVpZ2hib3Job29kcyA9ICgpID0+IHtcclxuICBEQkhlbHBlci5mZXRjaE5laWdoYm9yaG9vZHMoKGVycm9yLCBuZWlnaGJvcmhvb2RzKSA9PiB7XHJcbiAgICBpZiAoZXJyb3IpIHsgLy8gR290IGFuIGVycm9yXHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgZmlsbE5laWdoYm9yaG9vZHNIVE1MKG5laWdoYm9yaG9vZHMpO1xyXG4gICAgfVxyXG4gIH0pO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFNldCBuZWlnaGJvcmhvb2RzIEhUTUwuXHJcbiAqL1xyXG5sZXQgZmlsbE5laWdoYm9yaG9vZHNIVE1MID0gKG5laWdoYm9yaG9vZHMpID0+IHtcclxuICBjb25zdCBzZWxlY3QgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbmVpZ2hib3Job29kcy1zZWxlY3QnKTtcclxuICBuZWlnaGJvcmhvb2RzLmZvckVhY2gobmVpZ2hib3Job29kID0+IHtcclxuICAgIGNvbnN0IG9wdGlvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ29wdGlvbicpO1xyXG4gICAgb3B0aW9uLmlubmVySFRNTCA9IG5laWdoYm9yaG9vZDtcclxuICAgIG9wdGlvbi5zZXRBdHRyaWJ1dGUoJ3ZhbHVlJywgbmVpZ2hib3Job29kKTtcclxuICAgIG9wdGlvbi5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnb3B0aW9uJyk7XHJcbiAgICBzZWxlY3QuYXBwZW5kKG9wdGlvbik7XHJcbiAgfSk7XHJcbn07XHJcblxyXG4vKipcclxuICogRmV0Y2ggYWxsIGN1aXNpbmVzIGFuZCBzZXQgdGhlaXIgSFRNTC5cclxuICovXHJcbmxldCBmZXRjaEN1aXNpbmVzID0gKCkgPT4ge1xyXG4gIERCSGVscGVyLmZldGNoQ3Vpc2luZXMoKGVycm9yLCBjdWlzaW5lcykgPT4ge1xyXG4gICAgaWYgKGVycm9yKSB7IC8vIEdvdCBhbiBlcnJvciFcclxuICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBmaWxsQ3Vpc2luZXNIVE1MKGN1aXNpbmVzKTtcclxuICAgIH1cclxuICB9KTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBTZXQgY3Vpc2luZXMgSFRNTC5cclxuICovXHJcbmxldCBmaWxsQ3Vpc2luZXNIVE1MID0gKGN1aXNpbmVzKSA9PiB7XHJcbiAgY29uc3Qgc2VsZWN0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2N1aXNpbmVzLXNlbGVjdCcpO1xyXG5cclxuICBjdWlzaW5lcy5mb3JFYWNoKGN1aXNpbmUgPT4ge1xyXG4gICAgY29uc3Qgb3B0aW9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnb3B0aW9uJyk7XHJcbiAgICBvcHRpb24uaW5uZXJIVE1MID0gY3Vpc2luZTtcclxuICAgIG9wdGlvbi5zZXRBdHRyaWJ1dGUoJ3ZhbHVlJywgY3Vpc2luZSk7XHJcbiAgICBvcHRpb24uc2V0QXR0cmlidXRlKCdyb2xlJywgJ29wdGlvbicpO1xyXG4gICAgc2VsZWN0LmFwcGVuZChvcHRpb24pO1xyXG4gIH0pO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSByZXN0YXVyYW50IEhUTUwuXHJcbiAqL1xyXG5sZXQgY3JlYXRlUmVzdGF1cmFudEhUTUwgPSAocmVzdGF1cmFudCkgPT4ge1xyXG4gIGNvbnN0IGxpID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKTtcclxuXHJcbiAgY29uc3QgaW1hZ2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbWcnKTtcclxuICBpbWFnZS5jbGFzc05hbWUgPSAncmVzdGF1cmFudC1pbWdzJztcclxuICBpbWFnZS5zcmMgPSBEQkhlbHBlci5pbWFnZVVybEZvclJlc3RhdXJhbnQocmVzdGF1cmFudCk7XHJcbiAgaW1hZ2UuYWx0ID0gYCR7cmVzdGF1cmFudC5uYW1lfSBpcyAke3Jlc3RhdXJhbnQuY3Vpc2luZV90eXBlfSByZXN0YXVyYW50YDtcclxuICBsaS5hcHBlbmQoaW1hZ2UpO1xyXG5cclxuICBjb25zdCBuYW1lV3JhcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIG5hbWVXcmFwLmNsYXNzTmFtZSA9ICduYW1lLXdyYXAnO1xyXG4gIGNvbnN0IG5hbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdoMycpO1xyXG4gIG5hbWUuaW5uZXJIVE1MID0gcmVzdGF1cmFudC5uYW1lO1xyXG4gIG5hbWVXcmFwLmFwcGVuZChuYW1lKTtcclxuICAvL2ltcG9ydCB0aGUgZmlsbEZhdm9yaXRlc0hUTUwgZnJvbSBkYmhlbHBlci5qc1xyXG4gIG5hbWVXcmFwLmFwcGVuZChEQkhlbHBlci5maWxsRmF2b3JpdGVzSFRNTChyZXN0YXVyYW50KSk7XHJcbiAgbGkuYXBwZW5kKG5hbWVXcmFwKTtcclxuXHJcbiAgY29uc3QgYWRkcmVzc1dyYXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICBhZGRyZXNzV3JhcC5jbGFzc05hbWUgPSAnYWRkcmVzcy13cmFwJztcclxuICBjb25zdCBuZWlnaGJvcmhvb2QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdwJyk7XHJcbiAgbmVpZ2hib3Job29kLmlubmVySFRNTCA9IHJlc3RhdXJhbnQubmVpZ2hib3Job29kO1xyXG4gIGFkZHJlc3NXcmFwLmFwcGVuZChuZWlnaGJvcmhvb2QpO1xyXG5cclxuICBjb25zdCBhZGRyZXNzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgncCcpO1xyXG4gIGFkZHJlc3MuaW5uZXJIVE1MID0gcmVzdGF1cmFudC5hZGRyZXNzO1xyXG4gIGFkZHJlc3NXcmFwLmFwcGVuZChhZGRyZXNzKTtcclxuICBsaS5hcHBlbmQoYWRkcmVzc1dyYXApO1xyXG5cclxuICBjb25zdCBtb3JlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xyXG4gIG1vcmUuaW5uZXJIVE1MID0gJ1ZpZXcgRGV0YWlscyc7XHJcbiAgbW9yZS5ocmVmID0gREJIZWxwZXIudXJsRm9yUmVzdGF1cmFudChyZXN0YXVyYW50KTtcclxuICBsaS5hcHBlbmQobW9yZSk7XHJcblxyXG4gIHJldHVybiBsaTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDbGVhciBjdXJyZW50IHJlc3RhdXJhbnRzLCB0aGVpciBIVE1MIGFuZCByZW1vdmUgdGhlaXIgbWFwIG1hcmtlcnMuXHJcbiAqL1xyXG5sZXQgcmVzZXRSZXN0YXVyYW50cyA9IChyZXN0YXVyYW50cykgPT4ge1xyXG4gIC8vIFJlbW92ZSBhbGwgcmVzdGF1cmFudHNcclxuICByZXN0YXVyYW50cyA9IFtdO1xyXG4gIGNvbnN0IHVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc3RhdXJhbnRzLWxpc3QnKTtcclxuICB1bC5pbm5lckhUTUwgPSAnJztcclxuXHJcbiAgLy8gUmVtb3ZlIGFsbCBtYXAgbWFya2Vyc1xyXG4gIG1hcmtlcnMuZm9yRWFjaChtID0+IG0uc2V0TWFwKG51bGwpKTtcclxuICBtYXJrZXJzID0gW107XHJcbiAgc2VsZi5yZXN0YXVyYW50cyA9IHJlc3RhdXJhbnRzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhbGwgcmVzdGF1cmFudHMgSFRNTCBhbmQgYWRkIHRoZW0gdG8gdGhlIHdlYnBhZ2UuXHJcbiAqL1xyXG5sZXQgZmlsbFJlc3RhdXJhbnRzSFRNTCA9IChyZXN0YXVyYW50cykgPT4ge1xyXG4gIGNvbnN0IHVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc3RhdXJhbnRzLWxpc3QnKTtcclxuXHJcbiAgcmVzdGF1cmFudHMuZm9yRWFjaChyZXN0YXVyYW50ID0+IHtcclxuICAgIHVsLmFwcGVuZChjcmVhdGVSZXN0YXVyYW50SFRNTChyZXN0YXVyYW50KSk7XHJcbiAgfSk7XHJcbiAgaWYodHlwZW9mIGdvb2dsZSAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgIGFkZE1hcmtlcnNUb01hcChyZXN0YXVyYW50cyk7XHJcbiAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIFVwZGF0ZSBwYWdlIGFuZCBtYXAgZm9yIGN1cnJlbnQgcmVzdGF1cmFudHMgYW5kIG1ha2UgaXQgZ2xvYmFsIHNvXHJcbiAqIGl0IGFsbG93cyBpbmRleC5odG1sIHVzZSB0aGlzIGZ1bmN0aW9uIHRvIHVwZGF0ZSB0aGUgY29udGVudFxyXG4gKi9cclxuc2VsZi51cGRhdGVSZXN0YXVyYW50cyA9ICgpID0+IHtcclxuICBjb25zdCBjU2VsZWN0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2N1aXNpbmVzLXNlbGVjdCcpO1xyXG4gIGNvbnN0IG5TZWxlY3QgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbmVpZ2hib3Job29kcy1zZWxlY3QnKTtcclxuICBjb25zdCBmU2VsZWN0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Zhdm9yaXRlcy1zZWxlY3QnKTtcclxuXHJcbiAgY29uc3QgY0luZGV4ID0gY1NlbGVjdC5zZWxlY3RlZEluZGV4O1xyXG4gIGNvbnN0IG5JbmRleCA9IG5TZWxlY3Quc2VsZWN0ZWRJbmRleDtcclxuICBjb25zdCBmSW5kZXggPSBmU2VsZWN0LnNlbGVjdGVkSW5kZXg7XHJcblxyXG4gIGNvbnN0IGN1aXNpbmUgPSBjU2VsZWN0W2NJbmRleF0udmFsdWU7XHJcbiAgY29uc3QgbmVpZ2hib3Job29kID0gblNlbGVjdFtuSW5kZXhdLnZhbHVlO1xyXG4gIGNvbnN0IGZhdm9yaXRlID0gZlNlbGVjdFtmSW5kZXhdLnZhbHVlO1xyXG5cclxuICBEQkhlbHBlci5mZXRjaFJlc3RhdXJhbnRCeUN1aXNpbmVOZWlnaGJvcmhvb2RBbmRGYXZvcml0ZShjdWlzaW5lLCBuZWlnaGJvcmhvb2QsIGZhdm9yaXRlLCAoZXJyb3IsIHJlc3RhdXJhbnRzKSA9PiB7XHJcbiAgICBpZiAoZXJyb3IpIHsgLy8gR290IGFuIGVycm9yIVxyXG4gICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHJlc2V0UmVzdGF1cmFudHMocmVzdGF1cmFudHMpO1xyXG4gICAgICBmaWxsUmVzdGF1cmFudHNIVE1MKHJlc3RhdXJhbnRzKTtcclxuICAgIH1cclxuICB9KTtcclxufTtcclxuXHJcblxyXG5cclxuIiwiJ3VzZSBzdHJpY3QnO1xuXG4oZnVuY3Rpb24oKSB7XG4gIGZ1bmN0aW9uIHRvQXJyYXkoYXJyKSB7XG4gICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFycik7XG4gIH1cblxuICBmdW5jdGlvbiBwcm9taXNpZnlSZXF1ZXN0KHJlcXVlc3QpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICByZXF1ZXN0Lm9uc3VjY2VzcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXNvbHZlKHJlcXVlc3QucmVzdWx0KTtcbiAgICAgIH07XG5cbiAgICAgIHJlcXVlc3Qub25lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZWplY3QocmVxdWVzdC5lcnJvcik7XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJvbWlzaWZ5UmVxdWVzdENhbGwob2JqLCBtZXRob2QsIGFyZ3MpIHtcbiAgICB2YXIgcmVxdWVzdDtcbiAgICB2YXIgcCA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgcmVxdWVzdCA9IG9ialttZXRob2RdLmFwcGx5KG9iaiwgYXJncyk7XG4gICAgICBwcm9taXNpZnlSZXF1ZXN0KHJlcXVlc3QpLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICB9KTtcblxuICAgIHAucmVxdWVzdCA9IHJlcXVlc3Q7XG4gICAgcmV0dXJuIHA7XG4gIH1cblxuICBmdW5jdGlvbiBwcm9taXNpZnlDdXJzb3JSZXF1ZXN0Q2FsbChvYmosIG1ldGhvZCwgYXJncykge1xuICAgIHZhciBwID0gcHJvbWlzaWZ5UmVxdWVzdENhbGwob2JqLCBtZXRob2QsIGFyZ3MpO1xuICAgIHJldHVybiBwLnRoZW4oZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIGlmICghdmFsdWUpIHJldHVybjtcbiAgICAgIHJldHVybiBuZXcgQ3Vyc29yKHZhbHVlLCBwLnJlcXVlc3QpO1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJveHlQcm9wZXJ0aWVzKFByb3h5Q2xhc3MsIHRhcmdldFByb3AsIHByb3BlcnRpZXMpIHtcbiAgICBwcm9wZXJ0aWVzLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFByb3h5Q2xhc3MucHJvdG90eXBlLCBwcm9wLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXNbdGFyZ2V0UHJvcF1bcHJvcF07XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgdGhpc1t0YXJnZXRQcm9wXVtwcm9wXSA9IHZhbDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBwcm94eVJlcXVlc3RNZXRob2RzKFByb3h5Q2xhc3MsIHRhcmdldFByb3AsIENvbnN0cnVjdG9yLCBwcm9wZXJ0aWVzKSB7XG4gICAgcHJvcGVydGllcy5mb3JFYWNoKGZ1bmN0aW9uKHByb3ApIHtcbiAgICAgIGlmICghKHByb3AgaW4gQ29uc3RydWN0b3IucHJvdG90eXBlKSkgcmV0dXJuO1xuICAgICAgUHJveHlDbGFzcy5wcm90b3R5cGVbcHJvcF0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHByb21pc2lmeVJlcXVlc3RDYWxsKHRoaXNbdGFyZ2V0UHJvcF0sIHByb3AsIGFyZ3VtZW50cyk7XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJveHlNZXRob2RzKFByb3h5Q2xhc3MsIHRhcmdldFByb3AsIENvbnN0cnVjdG9yLCBwcm9wZXJ0aWVzKSB7XG4gICAgcHJvcGVydGllcy5mb3JFYWNoKGZ1bmN0aW9uKHByb3ApIHtcbiAgICAgIGlmICghKHByb3AgaW4gQ29uc3RydWN0b3IucHJvdG90eXBlKSkgcmV0dXJuO1xuICAgICAgUHJveHlDbGFzcy5wcm90b3R5cGVbcHJvcF0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXNbdGFyZ2V0UHJvcF1bcHJvcF0uYXBwbHkodGhpc1t0YXJnZXRQcm9wXSwgYXJndW1lbnRzKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBwcm94eUN1cnNvclJlcXVlc3RNZXRob2RzKFByb3h5Q2xhc3MsIHRhcmdldFByb3AsIENvbnN0cnVjdG9yLCBwcm9wZXJ0aWVzKSB7XG4gICAgcHJvcGVydGllcy5mb3JFYWNoKGZ1bmN0aW9uKHByb3ApIHtcbiAgICAgIGlmICghKHByb3AgaW4gQ29uc3RydWN0b3IucHJvdG90eXBlKSkgcmV0dXJuO1xuICAgICAgUHJveHlDbGFzcy5wcm90b3R5cGVbcHJvcF0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHByb21pc2lmeUN1cnNvclJlcXVlc3RDYWxsKHRoaXNbdGFyZ2V0UHJvcF0sIHByb3AsIGFyZ3VtZW50cyk7XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gSW5kZXgoaW5kZXgpIHtcbiAgICB0aGlzLl9pbmRleCA9IGluZGV4O1xuICB9XG5cbiAgcHJveHlQcm9wZXJ0aWVzKEluZGV4LCAnX2luZGV4JywgW1xuICAgICduYW1lJyxcbiAgICAna2V5UGF0aCcsXG4gICAgJ211bHRpRW50cnknLFxuICAgICd1bmlxdWUnXG4gIF0pO1xuXG4gIHByb3h5UmVxdWVzdE1ldGhvZHMoSW5kZXgsICdfaW5kZXgnLCBJREJJbmRleCwgW1xuICAgICdnZXQnLFxuICAgICdnZXRLZXknLFxuICAgICdnZXRBbGwnLFxuICAgICdnZXRBbGxLZXlzJyxcbiAgICAnY291bnQnXG4gIF0pO1xuXG4gIHByb3h5Q3Vyc29yUmVxdWVzdE1ldGhvZHMoSW5kZXgsICdfaW5kZXgnLCBJREJJbmRleCwgW1xuICAgICdvcGVuQ3Vyc29yJyxcbiAgICAnb3BlbktleUN1cnNvcidcbiAgXSk7XG5cbiAgZnVuY3Rpb24gQ3Vyc29yKGN1cnNvciwgcmVxdWVzdCkge1xuICAgIHRoaXMuX2N1cnNvciA9IGN1cnNvcjtcbiAgICB0aGlzLl9yZXF1ZXN0ID0gcmVxdWVzdDtcbiAgfVxuXG4gIHByb3h5UHJvcGVydGllcyhDdXJzb3IsICdfY3Vyc29yJywgW1xuICAgICdkaXJlY3Rpb24nLFxuICAgICdrZXknLFxuICAgICdwcmltYXJ5S2V5JyxcbiAgICAndmFsdWUnXG4gIF0pO1xuXG4gIHByb3h5UmVxdWVzdE1ldGhvZHMoQ3Vyc29yLCAnX2N1cnNvcicsIElEQkN1cnNvciwgW1xuICAgICd1cGRhdGUnLFxuICAgICdkZWxldGUnXG4gIF0pO1xuXG4gIC8vIHByb3h5ICduZXh0JyBtZXRob2RzXG4gIFsnYWR2YW5jZScsICdjb250aW51ZScsICdjb250aW51ZVByaW1hcnlLZXknXS5mb3JFYWNoKGZ1bmN0aW9uKG1ldGhvZE5hbWUpIHtcbiAgICBpZiAoIShtZXRob2ROYW1lIGluIElEQkN1cnNvci5wcm90b3R5cGUpKSByZXR1cm47XG4gICAgQ3Vyc29yLnByb3RvdHlwZVttZXRob2ROYW1lXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGN1cnNvciA9IHRoaXM7XG4gICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICBjdXJzb3IuX2N1cnNvclttZXRob2ROYW1lXS5hcHBseShjdXJzb3IuX2N1cnNvciwgYXJncyk7XG4gICAgICAgIHJldHVybiBwcm9taXNpZnlSZXF1ZXN0KGN1cnNvci5fcmVxdWVzdCkudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICAgIGlmICghdmFsdWUpIHJldHVybjtcbiAgICAgICAgICByZXR1cm4gbmV3IEN1cnNvcih2YWx1ZSwgY3Vyc29yLl9yZXF1ZXN0KTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9O1xuICB9KTtcblxuICBmdW5jdGlvbiBPYmplY3RTdG9yZShzdG9yZSkge1xuICAgIHRoaXMuX3N0b3JlID0gc3RvcmU7XG4gIH1cblxuICBPYmplY3RTdG9yZS5wcm90b3R5cGUuY3JlYXRlSW5kZXggPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IEluZGV4KHRoaXMuX3N0b3JlLmNyZWF0ZUluZGV4LmFwcGx5KHRoaXMuX3N0b3JlLCBhcmd1bWVudHMpKTtcbiAgfTtcblxuICBPYmplY3RTdG9yZS5wcm90b3R5cGUuaW5kZXggPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IEluZGV4KHRoaXMuX3N0b3JlLmluZGV4LmFwcGx5KHRoaXMuX3N0b3JlLCBhcmd1bWVudHMpKTtcbiAgfTtcblxuICBwcm94eVByb3BlcnRpZXMoT2JqZWN0U3RvcmUsICdfc3RvcmUnLCBbXG4gICAgJ25hbWUnLFxuICAgICdrZXlQYXRoJyxcbiAgICAnaW5kZXhOYW1lcycsXG4gICAgJ2F1dG9JbmNyZW1lbnQnXG4gIF0pO1xuXG4gIHByb3h5UmVxdWVzdE1ldGhvZHMoT2JqZWN0U3RvcmUsICdfc3RvcmUnLCBJREJPYmplY3RTdG9yZSwgW1xuICAgICdwdXQnLFxuICAgICdhZGQnLFxuICAgICdkZWxldGUnLFxuICAgICdjbGVhcicsXG4gICAgJ2dldCcsXG4gICAgJ2dldEFsbCcsXG4gICAgJ2dldEtleScsXG4gICAgJ2dldEFsbEtleXMnLFxuICAgICdjb3VudCdcbiAgXSk7XG5cbiAgcHJveHlDdXJzb3JSZXF1ZXN0TWV0aG9kcyhPYmplY3RTdG9yZSwgJ19zdG9yZScsIElEQk9iamVjdFN0b3JlLCBbXG4gICAgJ29wZW5DdXJzb3InLFxuICAgICdvcGVuS2V5Q3Vyc29yJ1xuICBdKTtcblxuICBwcm94eU1ldGhvZHMoT2JqZWN0U3RvcmUsICdfc3RvcmUnLCBJREJPYmplY3RTdG9yZSwgW1xuICAgICdkZWxldGVJbmRleCdcbiAgXSk7XG5cbiAgZnVuY3Rpb24gVHJhbnNhY3Rpb24oaWRiVHJhbnNhY3Rpb24pIHtcbiAgICB0aGlzLl90eCA9IGlkYlRyYW5zYWN0aW9uO1xuICAgIHRoaXMuY29tcGxldGUgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIGlkYlRyYW5zYWN0aW9uLm9uY29tcGxldGUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgfTtcbiAgICAgIGlkYlRyYW5zYWN0aW9uLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVqZWN0KGlkYlRyYW5zYWN0aW9uLmVycm9yKTtcbiAgICAgIH07XG4gICAgICBpZGJUcmFuc2FjdGlvbi5vbmFib3J0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlamVjdChpZGJUcmFuc2FjdGlvbi5lcnJvcik7XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgVHJhbnNhY3Rpb24ucHJvdG90eXBlLm9iamVjdFN0b3JlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBPYmplY3RTdG9yZSh0aGlzLl90eC5vYmplY3RTdG9yZS5hcHBseSh0aGlzLl90eCwgYXJndW1lbnRzKSk7XG4gIH07XG5cbiAgcHJveHlQcm9wZXJ0aWVzKFRyYW5zYWN0aW9uLCAnX3R4JywgW1xuICAgICdvYmplY3RTdG9yZU5hbWVzJyxcbiAgICAnbW9kZSdcbiAgXSk7XG5cbiAgcHJveHlNZXRob2RzKFRyYW5zYWN0aW9uLCAnX3R4JywgSURCVHJhbnNhY3Rpb24sIFtcbiAgICAnYWJvcnQnXG4gIF0pO1xuXG4gIGZ1bmN0aW9uIFVwZ3JhZGVEQihkYiwgb2xkVmVyc2lvbiwgdHJhbnNhY3Rpb24pIHtcbiAgICB0aGlzLl9kYiA9IGRiO1xuICAgIHRoaXMub2xkVmVyc2lvbiA9IG9sZFZlcnNpb247XG4gICAgdGhpcy50cmFuc2FjdGlvbiA9IG5ldyBUcmFuc2FjdGlvbih0cmFuc2FjdGlvbik7XG4gIH1cblxuICBVcGdyYWRlREIucHJvdG90eXBlLmNyZWF0ZU9iamVjdFN0b3JlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBPYmplY3RTdG9yZSh0aGlzLl9kYi5jcmVhdGVPYmplY3RTdG9yZS5hcHBseSh0aGlzLl9kYiwgYXJndW1lbnRzKSk7XG4gIH07XG5cbiAgcHJveHlQcm9wZXJ0aWVzKFVwZ3JhZGVEQiwgJ19kYicsIFtcbiAgICAnbmFtZScsXG4gICAgJ3ZlcnNpb24nLFxuICAgICdvYmplY3RTdG9yZU5hbWVzJ1xuICBdKTtcblxuICBwcm94eU1ldGhvZHMoVXBncmFkZURCLCAnX2RiJywgSURCRGF0YWJhc2UsIFtcbiAgICAnZGVsZXRlT2JqZWN0U3RvcmUnLFxuICAgICdjbG9zZSdcbiAgXSk7XG5cbiAgZnVuY3Rpb24gREIoZGIpIHtcbiAgICB0aGlzLl9kYiA9IGRiO1xuICB9XG5cbiAgREIucHJvdG90eXBlLnRyYW5zYWN0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBUcmFuc2FjdGlvbih0aGlzLl9kYi50cmFuc2FjdGlvbi5hcHBseSh0aGlzLl9kYiwgYXJndW1lbnRzKSk7XG4gIH07XG5cbiAgcHJveHlQcm9wZXJ0aWVzKERCLCAnX2RiJywgW1xuICAgICduYW1lJyxcbiAgICAndmVyc2lvbicsXG4gICAgJ29iamVjdFN0b3JlTmFtZXMnXG4gIF0pO1xuXG4gIHByb3h5TWV0aG9kcyhEQiwgJ19kYicsIElEQkRhdGFiYXNlLCBbXG4gICAgJ2Nsb3NlJ1xuICBdKTtcblxuICAvLyBBZGQgY3Vyc29yIGl0ZXJhdG9yc1xuICAvLyBUT0RPOiByZW1vdmUgdGhpcyBvbmNlIGJyb3dzZXJzIGRvIHRoZSByaWdodCB0aGluZyB3aXRoIHByb21pc2VzXG4gIFsnb3BlbkN1cnNvcicsICdvcGVuS2V5Q3Vyc29yJ10uZm9yRWFjaChmdW5jdGlvbihmdW5jTmFtZSkge1xuICAgIFtPYmplY3RTdG9yZSwgSW5kZXhdLmZvckVhY2goZnVuY3Rpb24oQ29uc3RydWN0b3IpIHtcbiAgICAgIC8vIERvbid0IGNyZWF0ZSBpdGVyYXRlS2V5Q3Vyc29yIGlmIG9wZW5LZXlDdXJzb3IgZG9lc24ndCBleGlzdC5cbiAgICAgIGlmICghKGZ1bmNOYW1lIGluIENvbnN0cnVjdG9yLnByb3RvdHlwZSkpIHJldHVybjtcblxuICAgICAgQ29uc3RydWN0b3IucHJvdG90eXBlW2Z1bmNOYW1lLnJlcGxhY2UoJ29wZW4nLCAnaXRlcmF0ZScpXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgYXJncyA9IHRvQXJyYXkoYXJndW1lbnRzKTtcbiAgICAgICAgdmFyIGNhbGxiYWNrID0gYXJnc1thcmdzLmxlbmd0aCAtIDFdO1xuICAgICAgICB2YXIgbmF0aXZlT2JqZWN0ID0gdGhpcy5fc3RvcmUgfHwgdGhpcy5faW5kZXg7XG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmF0aXZlT2JqZWN0W2Z1bmNOYW1lXS5hcHBseShuYXRpdmVPYmplY3QsIGFyZ3Muc2xpY2UoMCwgLTEpKTtcbiAgICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICBjYWxsYmFjayhyZXF1ZXN0LnJlc3VsdCk7XG4gICAgICAgIH07XG4gICAgICB9O1xuICAgIH0pO1xuICB9KTtcblxuICAvLyBwb2x5ZmlsbCBnZXRBbGxcbiAgW0luZGV4LCBPYmplY3RTdG9yZV0uZm9yRWFjaChmdW5jdGlvbihDb25zdHJ1Y3Rvcikge1xuICAgIGlmIChDb25zdHJ1Y3Rvci5wcm90b3R5cGUuZ2V0QWxsKSByZXR1cm47XG4gICAgQ29uc3RydWN0b3IucHJvdG90eXBlLmdldEFsbCA9IGZ1bmN0aW9uKHF1ZXJ5LCBjb3VudCkge1xuICAgICAgdmFyIGluc3RhbmNlID0gdGhpcztcbiAgICAgIHZhciBpdGVtcyA9IFtdO1xuXG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSkge1xuICAgICAgICBpbnN0YW5jZS5pdGVyYXRlQ3Vyc29yKHF1ZXJ5LCBmdW5jdGlvbihjdXJzb3IpIHtcbiAgICAgICAgICBpZiAoIWN1cnNvcikge1xuICAgICAgICAgICAgcmVzb2x2ZShpdGVtcyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGl0ZW1zLnB1c2goY3Vyc29yLnZhbHVlKTtcblxuICAgICAgICAgIGlmIChjb3VudCAhPT0gdW5kZWZpbmVkICYmIGl0ZW1zLmxlbmd0aCA9PSBjb3VudCkge1xuICAgICAgICAgICAgcmVzb2x2ZShpdGVtcyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGN1cnNvci5jb250aW51ZSgpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH07XG4gIH0pO1xuXG4gIHZhciBleHAgPSB7XG4gICAgb3BlbjogZnVuY3Rpb24obmFtZSwgdmVyc2lvbiwgdXBncmFkZUNhbGxiYWNrKSB7XG4gICAgICB2YXIgcCA9IHByb21pc2lmeVJlcXVlc3RDYWxsKGluZGV4ZWREQiwgJ29wZW4nLCBbbmFtZSwgdmVyc2lvbl0pO1xuICAgICAgdmFyIHJlcXVlc3QgPSBwLnJlcXVlc3Q7XG5cbiAgICAgIGlmIChyZXF1ZXN0KSB7XG4gICAgICAgIHJlcXVlc3Qub251cGdyYWRlbmVlZGVkID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICBpZiAodXBncmFkZUNhbGxiYWNrKSB7XG4gICAgICAgICAgICB1cGdyYWRlQ2FsbGJhY2sobmV3IFVwZ3JhZGVEQihyZXF1ZXN0LnJlc3VsdCwgZXZlbnQub2xkVmVyc2lvbiwgcmVxdWVzdC50cmFuc2FjdGlvbikpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHAudGhlbihmdW5jdGlvbihkYikge1xuICAgICAgICByZXR1cm4gbmV3IERCKGRiKTtcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgZGVsZXRlOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgICByZXR1cm4gcHJvbWlzaWZ5UmVxdWVzdENhbGwoaW5kZXhlZERCLCAnZGVsZXRlRGF0YWJhc2UnLCBbbmFtZV0pO1xuICAgIH1cbiAgfTtcblxuICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGV4cDtcbiAgICBtb2R1bGUuZXhwb3J0cy5kZWZhdWx0ID0gbW9kdWxlLmV4cG9ydHM7XG4gIH1cbiAgZWxzZSB7XG4gICAgc2VsZi5pZGIgPSBleHA7XG4gIH1cbn0oKSk7XG4iXX0=
