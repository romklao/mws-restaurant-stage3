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
      DBHelper.addAltToMap();
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
  _dbhelper2.default.addAltToMap();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9kYmhlbHBlci5qcyIsImpzL21haW4uanMiLCJub2RlX21vZHVsZXMvaWRiL2xpYi9pZGIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7Ozs7Ozs7QUFFQTs7Ozs7Ozs7QUFFQTs7OztJQUlNLFE7Ozs7Ozs7OztBQVdKOzs7MkNBRzhCLFUsRUFBWSxHLEVBQUs7QUFDN0MsZUFBUyxhQUFUO0FBQ0EsZUFBUyxXQUFUO0FBQ0EsVUFBTSxTQUFTLElBQUksT0FBTyxJQUFQLENBQVksTUFBaEIsQ0FBdUI7QUFDcEMsa0JBQVUsV0FBVyxNQURlO0FBRXBDLGVBQU8sV0FBVyxJQUZrQjtBQUdwQyxhQUFLLFNBQVMsZ0JBQVQsQ0FBMEIsVUFBMUIsQ0FIK0I7QUFJcEMsYUFBSyxHQUorQjtBQUtwQyxtQkFBVyxPQUFPLElBQVAsQ0FBWSxTQUFaLENBQXNCO0FBTEcsT0FBdkIsQ0FBZjtBQU9BLGFBQU8sTUFBUDtBQUNEO0FBQ0Q7Ozs7OztvQ0FHdUI7QUFDckIsYUFBTyxJQUFQLENBQVksS0FBWixDQUFrQixlQUFsQixDQUFrQyxHQUFsQyxFQUF1QyxNQUF2QyxFQUErQyxZQUFNO0FBQ25ELGlCQUFTLG9CQUFULENBQThCLFFBQTlCLEVBQXdDLENBQXhDLEVBQTJDLEtBQTNDLEdBQW1ELGFBQW5EO0FBQ0QsT0FGRDtBQUdEOztBQUVEOzs7Ozs7bUNBR3NCO0FBQ3BCLFVBQUksQ0FBQyxVQUFVLGFBQWYsRUFBOEI7QUFDNUIsZUFBTyxRQUFRLE9BQVIsRUFBUDtBQUNELE9BRkQsTUFFTztBQUNMLGVBQU8sY0FBSSxJQUFKLENBQVMsYUFBVCxFQUF3QixDQUF4QixFQUEyQixVQUFDLFNBQUQsRUFBZTtBQUMvQyxvQkFBVSxpQkFBVixDQUE0QixhQUE1QixFQUEyQyxFQUFFLFNBQVMsSUFBWCxFQUEzQztBQUNBLGNBQUksY0FBYyxVQUFVLGlCQUFWLENBQTRCLFNBQTVC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O0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIid1c2Ugc3RyaWN0JztcclxuXHJcbmltcG9ydCBpZGIgZnJvbSAnaWRiJztcclxuXHJcbi8qKlxyXG4gKiBDb21tb24gZGF0YWJhc2UgaGVscGVyIGZ1bmN0aW9ucy5cclxuICovXHJcblxyXG5jbGFzcyBEQkhlbHBlciB7XHJcbiAgLyoqXHJcbiAgICogRGF0YWJhc2UgVVJMLlxyXG4gICAqIENoYW5nZSB0aGlzIHRvIHJlc3RhdXJhbnRzLmpzb24gZmlsZSBsb2NhdGlvbiBvbiB5b3VyIHNlcnZlci5cclxuICAgKi9cclxuICBzdGF0aWMgZ2V0IERBVEFCQVNFX1VSTCgpIHtcclxuICAgIC8vY29uc3QgcG9ydCA9IDEzMzc7Ly8gQ2hhbmdlIHRoaXMgdG8geW91ciBzZXJ2ZXIgcG9ydFxyXG4gICAgLy9yZXR1cm4gYGh0dHBzOi8vcmVzdGF1cmFudC1yZXZpZXdzLWFwaS5oZXJva3VhcHAuY29tLzoke3BvcnR9YDtcclxuICAgIHJldHVybiAnaHR0cHM6Ly9yZXN0YXVyYW50LXJldmlld3MtYXBpLmhlcm9rdWFwcC5jb20nO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQE1hcCBtYXJrZXIgZm9yIGEgcmVzdGF1cmFudC5cclxuICAgKi9cclxuICBzdGF0aWMgbWFwTWFya2VyRm9yUmVzdGF1cmFudChyZXN0YXVyYW50LCBtYXApIHtcclxuICAgIERCSGVscGVyLmFkZFRpdGxlVG9NYXAoKTtcclxuICAgIERCSGVscGVyLmFkZEFsdFRvTWFwKCk7XHJcbiAgICBjb25zdCBtYXJrZXIgPSBuZXcgZ29vZ2xlLm1hcHMuTWFya2VyKHtcclxuICAgICAgcG9zaXRpb246IHJlc3RhdXJhbnQubGF0bG5nLFxyXG4gICAgICB0aXRsZTogcmVzdGF1cmFudC5uYW1lLFxyXG4gICAgICB1cmw6IERCSGVscGVyLnVybEZvclJlc3RhdXJhbnQocmVzdGF1cmFudCksXHJcbiAgICAgIG1hcDogbWFwLFxyXG4gICAgICBhbmltYXRpb246IGdvb2dsZS5tYXBzLkFuaW1hdGlvbi5EUk9QXHJcbiAgICB9KTtcclxuICAgIHJldHVybiBtYXJrZXI7XHJcbiAgfVxyXG4gIC8qKlxyXG4gICAqIEBhZGQgYXR0cmlidXRlIHRpdGxlIHRvIDxpZnJhbWU+IGluIEdvb2dsZSBNYXAgdG8gaW1wcm92ZSB0aGUgYWNjZXNzaWJpbGl0eVxyXG4gICAqL1xyXG4gIHN0YXRpYyBhZGRUaXRsZVRvTWFwKCkge1xyXG4gICAgZ29vZ2xlLm1hcHMuZXZlbnQuYWRkTGlzdGVuZXJPbmNlKG1hcCwgJ2lkbGUnLCAoKSA9PiB7XHJcbiAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdpZnJhbWUnKVswXS50aXRsZSA9ICdHb29nbGUgTWFwcyc7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEBvcGVuIGRhdGFiYXNlIHRvIHN0b3JlIGRhdGEgcmV0cmlldmVkIGZyb20gdGhlIHNlcnZlciBpbiBpbmRleGVkREIgQVBJXHJcbiAgICovXHJcbiAgc3RhdGljIG9wZW5EYXRhYmFzZSgpIHtcclxuICAgIGlmICghbmF2aWdhdG9yLnNlcnZpY2VXb3JrZXIpIHtcclxuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgcmV0dXJuIGlkYi5vcGVuKCdyZXN0YXVyYW50cycsIDMsICh1cGdyYWRlRGIpID0+IHtcclxuICAgICAgICB1cGdyYWRlRGIuY3JlYXRlT2JqZWN0U3RvcmUoJ3Jlc3RhdXJhbnRzJywgeyBrZXlQYXRoOiAnaWQnIH0pO1xyXG4gICAgICAgIGxldCByZXZpZXdTdG9yZSA9IHVwZ3JhZGVEYi5jcmVhdGVPYmplY3RTdG9yZSgncmV2aWV3cycsIHsga2V5UGF0aDogJ2lkJyB9KTtcclxuICAgICAgICByZXZpZXdTdG9yZS5jcmVhdGVJbmRleCgncmVzdGF1cmFudF9pZCcsICdyZXN0YXVyYW50X2lkJywgeyB1bmlxdWU6IGZhbHNlIH0pO1xyXG4gICAgICAgIHVwZ3JhZGVEYi5jcmVhdGVPYmplY3RTdG9yZSgnb2ZmbGluZS1yZXZpZXdzJywgeyBrZXlQYXRoOiAndXBkYXRlZEF0JyB9KTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIC8qKlxyXG4gICAqIEBnZXQgZGF0YSBmcm9tIGEgc3RvcmUgaW4gSW5kZXhlZERCIGlmIGl0IGlzIGF2YWlsYWJsZVxyXG4gICAqL1xyXG4gIHN0YXRpYyBnZXRDYWNoZWRJbmRleGVkREIoc3RvcmVfbmFtZSkge1xyXG4gICAgbGV0IGRiUHJvbWlzZSA9IERCSGVscGVyLm9wZW5EYXRhYmFzZSgpO1xyXG5cclxuICAgIHJldHVybiBkYlByb21pc2UudGhlbihmdW5jdGlvbihkYikge1xyXG4gICAgICBpZighZGIpIHJldHVybjtcclxuICAgICAgbGV0IHR4ID0gZGIudHJhbnNhY3Rpb24oc3RvcmVfbmFtZSk7XHJcbiAgICAgIGxldCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKHN0b3JlX25hbWUpO1xyXG4gICAgICByZXR1cm4gc3RvcmUuZ2V0QWxsKCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEBzdG9yZSB0aGUgZGF0YSBpbiBJbmRleGVkREIgYWZ0ZXIgZmV0Y2hpbmcgaXQgZnJvbSB0aGUgc2VydmVyXHJcbiAgICogQHBhcmFtIGRhdGFzOiBhcmUgcmV0cmlldmVkIGZyb20gdGhlIHNlcnZlciwgc3RvcmVfbmFtZToge3N0cmluZ31cclxuICAgKi9cclxuICBzdGF0aWMgc3RvcmVEYXRhSW5kZXhlZERiKGRhdGFzLCBzdG9yZV9uYW1lKSB7XHJcbiAgICBsZXQgZGJQcm9taXNlID0gREJIZWxwZXIub3BlbkRhdGFiYXNlKCk7XHJcblxyXG4gICAgZGJQcm9taXNlLnRoZW4oZGIgPT4ge1xyXG4gICAgICBpZiAoIWRiKSByZXR1cm47XHJcbiAgICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oc3RvcmVfbmFtZSwgJ3JlYWR3cml0ZScpO1xyXG4gICAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKHN0b3JlX25hbWUpO1xyXG5cclxuICAgICAgZGF0YXMuZm9yRWFjaChkYXRhID0+IHtcclxuICAgICAgICBzdG9yZS5wdXQoZGF0YSk7XHJcbiAgICAgIH0pO1xyXG4gICAgICByZXR1cm4gdHguY29tcGxldGU7XHJcbiAgICB9KTtcclxuICB9XHJcbiAgLyoqXHJcbiAgICogQGZldGNoIGFsbCByZXN0YXVyYW50cyBmb3JtIEluZGV4ZWREQiBpZiB0aGV5IGV4aXN0IG90aGVyd2lzZSBmZXRjaCBmcm9tIHRoZSBzZXJ2ZXIuXHJcbiAgICovXHJcbiAgc3RhdGljIGZldGNoUmVzdGF1cmFudHMoY2FsbGJhY2spIHtcclxuICAgIC8vY2hlY2sgaWYgZGF0YSBleGlzdHMgaW4gaW5kZXhEQiBBUEkgaWYgaXQgZG9lcyByZXR1cm4gY2FsbGJhY2tcclxuICAgIERCSGVscGVyLmdldENhY2hlZEluZGV4ZWREQigncmVzdGF1cmFudHMnKS50aGVuKHJlc3VsdHMgPT4ge1xyXG4gICAgICBpZiAocmVzdWx0cyAmJiByZXN1bHRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHRzKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBVc2UgZWxzZSBjb25kaXRpb24gdG8gYXZvaWQgZmV0Y2hpbmcgZnJvbSBzYWlscyBzZXJ2ZXJcclxuICAgICAgICAvLyBiZWNhdXNlIHVwZGF0aW5nIGZhdm9yaXRlIG9uIHRoZSBzYWlscyBzZXJ2ZXIgaXMgbm90IHBlcnNpc3RlbnRcclxuICAgICAgICAvLyBhbmQgdG8gZ2V0IGRhdGEgZnJvbSBJbmRleGVkREIgb25seVxyXG4gICAgICAgIGZldGNoKGAke0RCSGVscGVyLkRBVEFCQVNFX1VSTH0vcmVzdGF1cmFudHNgKVxyXG4gICAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKVxyXG4gICAgICAgICAgLnRoZW4ocmVzdGF1cmFudHMgPT4ge1xyXG4gICAgICAgICAgICAvL3N0b3JlIGRhdGEgaW4gaW5kZXhEQiBBUEkgYWZ0ZXIgZmV0Y2hpbmdcclxuICAgICAgICAgICAgREJIZWxwZXIuc3RvcmVEYXRhSW5kZXhlZERiKHJlc3RhdXJhbnRzLCAncmVzdGF1cmFudHMnKTtcclxuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG51bGwsIHJlc3RhdXJhbnRzKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICAgICAuY2F0Y2goZXJyID0+IHtcclxuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVyciAsIG51bGwpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuICAvKipcclxuICAgKiBAZmV0Y2ggYWxsIHJldmlld3MgZm9ybSBJbmRleGVkREIgaWYgdGhleSBleGlzdCBvdGhlcndpc2UgZmV0Y2ggZnJvbSB0aGUgc2VydmVyLlxyXG4gICAqL1xyXG4gIHN0YXRpYyBmZXRjaFJlc3RhdXJhbnRSZXZpZXdzKHJlc3RhdXJhbnQsIGNhbGxiYWNrKSB7XHJcbiAgICBsZXQgZGJQcm9taXNlID0gREJIZWxwZXIub3BlbkRhdGFiYXNlKCk7XHJcblxyXG4gICAgZGJQcm9taXNlLnRoZW4oZGIgPT4ge1xyXG4gICAgICBpZiAoIWRiKSByZXR1cm47XHJcblxyXG4gICAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKCdyZXZpZXdzJyk7XHJcbiAgICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoJ3Jldmlld3MnKTtcclxuICAgICAgY29uc3QgaW5kZXggPSBzdG9yZS5pbmRleCgncmVzdGF1cmFudF9pZCcpO1xyXG5cclxuICAgICAgaW5kZXguZ2V0QWxsKHJlc3RhdXJhbnQuaWQpLnRoZW4ocmVzdWx0cyA9PiB7XHJcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0cyk7XHJcblxyXG4gICAgICAgIGlmICghbmF2aWdhdG9yLm9uTGluZSkge1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZmV0Y2goYCR7REJIZWxwZXIuREFUQUJBU0VfVVJMfS9yZXZpZXdzLz9yZXN0YXVyYW50X2lkPSR7cmVzdGF1cmFudC5pZH1gKVxyXG4gICAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4ge1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgICAgIC50aGVuKHJldmlld3MgPT4ge1xyXG4gICAgICAgICAgICAvL3N0b3JlIGRhdGEgaW4gaW5kZXhEQiBBUEkgYWZ0ZXIgZmV0Y2hpbmdcclxuICAgICAgICAgICAgbGV0IHJldmlld3NMZW4gPSByZXZpZXdzLmxlbmd0aDtcclxuICAgICAgICAgICAgaWYgKHJldmlld3NMZW4gPj0gMjkpIHtcclxuICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJldmlld3NMZW4gLSAyMDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBEQkhlbHBlci5kZWxldGVSZXN0YXVyYW50UmV2aWV3cyhyZXZpZXdzW2ldLmlkKTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgREJIZWxwZXIuc3RvcmVEYXRhSW5kZXhlZERiKHJldmlld3MsICdyZXZpZXdzJyk7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJldmlld3MpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgICAgIC5jYXRjaChlcnIgPT4ge1xyXG4gICAgICAgICAgICBjYWxsYmFjayhlcnIgLCBudWxsKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQGZldGNoIGEgcmVzdGF1cmFudCBieSBpdHMgSUQuXHJcbiAgICovXHJcbiAgc3RhdGljIGZldGNoUmVzdGF1cmFudEJ5SWQoaWQsIGNhbGxiYWNrKSB7XHJcbiAgICAvLyBmZXRjaCBhbGwgcmVzdGF1cmFudHMgd2l0aCBwcm9wZXIgZXJyb3IgaGFuZGxpbmcuXHJcbiAgICBEQkhlbHBlci5mZXRjaFJlc3RhdXJhbnRzKChlcnJvciwgcmVzdGF1cmFudHMpID0+IHtcclxuICAgICAgaWYgKGVycm9yKSB7XHJcbiAgICAgICAgY2FsbGJhY2soZXJyb3IsIG51bGwpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnN0IHJlc3RhdXJhbnQgPSByZXN0YXVyYW50cy5maW5kKHIgPT4gci5pZCA9PSBpZCk7XHJcbiAgICAgICAgaWYgKHJlc3RhdXJhbnQpIHsgLy8gR290IHRoZSByZXN0YXVyYW50XHJcbiAgICAgICAgICBjYWxsYmFjayhudWxsLCByZXN0YXVyYW50KTtcclxuICAgICAgICB9IGVsc2UgeyAvLyBSZXN0YXVyYW50IGRvZXMgbm90IGV4aXN0IGluIHRoZSBkYXRhYmFzZVxyXG4gICAgICAgICAgY2FsbGJhY2soJ1Jlc3RhdXJhbnQgZG9lcyBub3QgZXhpc3QnLCBudWxsKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQGZldGNoIHJlc3RhdXJhbnRzIGJ5IGEgY3Vpc2luZSB0eXBlIHdpdGggcHJvcGVyIGVycm9yIGhhbmRsaW5nLlxyXG4gICAqL1xyXG4gIHN0YXRpYyBmZXRjaFJlc3RhdXJhbnRCeUN1aXNpbmUoY3Vpc2luZSwgY2FsbGJhY2spIHtcclxuICAgIC8vIEZldGNoIGFsbCByZXN0YXVyYW50cyAgd2l0aCBwcm9wZXIgZXJyb3IgaGFuZGxpbmdcclxuICAgIERCSGVscGVyLmZldGNoUmVzdGF1cmFudHMoKGVycm9yLCByZXN0YXVyYW50cykgPT4ge1xyXG4gICAgICBpZiAoZXJyb3IpIHtcclxuICAgICAgICBjYWxsYmFjayhlcnJvciwgbnVsbCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gRmlsdGVyIHJlc3RhdXJhbnRzIHRvIGhhdmUgb25seSBnaXZlbiBjdWlzaW5lIHR5cGVcclxuICAgICAgICBjb25zdCByZXN1bHRzID0gcmVzdGF1cmFudHMuZmlsdGVyKHIgPT4gci5jdWlzaW5lX3R5cGUgPT0gY3Vpc2luZSk7XHJcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0cyk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQGZldGNoIHJlc3RhdXJhbnRzIGJ5IGEgbmVpZ2hib3Job29kIHdpdGggcHJvcGVyIGVycm9yIGhhbmRsaW5nLlxyXG4gICAqL1xyXG4gIHN0YXRpYyBmZXRjaFJlc3RhdXJhbnRCeU5laWdoYm9yaG9vZChuZWlnaGJvcmhvb2QsIGNhbGxiYWNrKSB7XHJcbiAgICAvLyBGZXRjaCBhbGwgcmVzdGF1cmFudHNcclxuICAgIERCSGVscGVyLmZldGNoUmVzdGF1cmFudHMoKGVycm9yLCByZXN0YXVyYW50cykgPT4ge1xyXG4gICAgICBpZiAoZXJyb3IpIHtcclxuICAgICAgICBjYWxsYmFjayhlcnJvciwgbnVsbCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gRmlsdGVyIHJlc3RhdXJhbnRzIHRvIGhhdmUgb25seSBnaXZlbiBuZWlnaGJvcmhvb2RcclxuICAgICAgICBjb25zdCByZXN1bHRzID0gcmVzdGF1cmFudHMuZmlsdGVyKHIgPT4gci5uZWlnaGJvcmhvb2QgPT0gbmVpZ2hib3Job29kKTtcclxuICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHRzKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAZmV0Y2ggcmVzdGF1cmFudHMgYnkgYSBjdWlzaW5lIGFuZCBhIG5laWdoYm9yaG9vZCB3aXRoIHByb3BlciBlcnJvciBoYW5kbGluZy5cclxuICAgKi9cclxuICBzdGF0aWMgZmV0Y2hSZXN0YXVyYW50QnlDdWlzaW5lQW5kTmVpZ2hib3Job29kKGN1aXNpbmUsIG5laWdoYm9yaG9vZCwgY2FsbGJhY2spIHtcclxuICAgIC8vIEZldGNoIGFsbCByZXN0YXVyYW50c1xyXG4gICAgREJIZWxwZXIuZmV0Y2hSZXN0YXVyYW50cygoZXJyb3IsIHJlc3RhdXJhbnRzKSA9PiB7XHJcbiAgICAgIGlmIChlcnJvcikge1xyXG4gICAgICAgIGNhbGxiYWNrKGVycm9yLCBudWxsKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBsZXQgcmVzdWx0cyA9IHJlc3RhdXJhbnRzO1xyXG4gICAgICAgIGlmIChjdWlzaW5lICE9ICdhbGwnKSB7IC8vIGZpbHRlciBieSBjdWlzaW5lXHJcbiAgICAgICAgICByZXN1bHRzID0gcmVzdWx0cy5maWx0ZXIociA9PiByLmN1aXNpbmVfdHlwZSA9PSBjdWlzaW5lKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKG5laWdoYm9yaG9vZCAhPSAnYWxsJykgeyAvLyBmaWx0ZXIgYnkgbmVpZ2hib3Job29kXHJcbiAgICAgICAgICByZXN1bHRzID0gcmVzdWx0cy5maWx0ZXIociA9PiByLm5laWdoYm9yaG9vZCA9PSBuZWlnaGJvcmhvb2QpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHRzKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBzdGF0aWMgZmV0Y2hSZXN0YXVyYW50QnlDdWlzaW5lTmVpZ2hib3Job29kQW5kRmF2b3JpdGUoY3Vpc2luZSwgbmVpZ2hib3Job29kLCBmYXZvcml0ZSwgY2FsbGJhY2spIHtcclxuICAgIC8vIEZldGNoIGFsbCByZXN0YXVyYW50c1xyXG4gICAgREJIZWxwZXIuZmV0Y2hSZXN0YXVyYW50cygoZXJyb3IsIHJlc3RhdXJhbnRzKSA9PiB7XHJcbiAgICAgIGlmIChlcnJvcikge1xyXG4gICAgICAgIGNhbGxiYWNrKGVycm9yLCBudWxsKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBsZXQgcmVzdWx0cyA9IHJlc3RhdXJhbnRzO1xyXG4gICAgICAgIGlmIChjdWlzaW5lICE9ICdhbGwnKSB7IC8vIGZpbHRlciBieSBjdWlzaW5lXHJcbiAgICAgICAgICByZXN1bHRzID0gcmVzdWx0cy5maWx0ZXIociA9PiByLmN1aXNpbmVfdHlwZSA9PSBjdWlzaW5lKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKG5laWdoYm9yaG9vZCAhPSAnYWxsJykgeyAvLyBmaWx0ZXIgYnkgbmVpZ2hib3Job29kXHJcbiAgICAgICAgICByZXN1bHRzID0gcmVzdWx0cy5maWx0ZXIociA9PiByLm5laWdoYm9yaG9vZCA9PSBuZWlnaGJvcmhvb2QpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoZmF2b3JpdGUgPT0gJ3RydWUnKSB7XHJcbiAgICAgICAgICByZXN1bHRzID0gcmVzdWx0cy5maWx0ZXIociA9PiByLmlzX2Zhdm9yaXRlID09ICd0cnVlJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdHMpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEBmZXRjaCBhbGwgbmVpZ2hib3Job29kcyB3aXRoIHByb3BlciBlcnJvciBoYW5kbGluZy5cclxuICAgKi9cclxuICBzdGF0aWMgZmV0Y2hOZWlnaGJvcmhvb2RzKGNhbGxiYWNrKSB7XHJcbiAgICAvLyBGZXRjaCBhbGwgcmVzdGF1cmFudHNcclxuICAgIERCSGVscGVyLmZldGNoUmVzdGF1cmFudHMoKGVycm9yLCByZXN0YXVyYW50cykgPT4ge1xyXG4gICAgICBpZiAoZXJyb3IpIHtcclxuICAgICAgICBjYWxsYmFjayhlcnJvciwgbnVsbCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gR2V0IGFsbCBuZWlnaGJvcmhvb2RzIGZyb20gYWxsIHJlc3RhdXJhbnRzXHJcbiAgICAgICAgY29uc3QgbmVpZ2hib3Job29kcyA9IHJlc3RhdXJhbnRzLm1hcCgodiwgaSkgPT4gcmVzdGF1cmFudHNbaV0ubmVpZ2hib3Job29kKTtcclxuICAgICAgICAvLyBSZW1vdmUgZHVwbGljYXRlcyBmcm9tIG5laWdoYm9yaG9vZHNcclxuICAgICAgICBjb25zdCB1bmlxdWVOZWlnaGJvcmhvb2RzID0gbmVpZ2hib3Job29kcy5maWx0ZXIoKHYsIGkpID0+IG5laWdoYm9yaG9vZHMuaW5kZXhPZih2KSA9PSBpKTtcclxuICAgICAgICBjYWxsYmFjayhudWxsLCB1bmlxdWVOZWlnaGJvcmhvb2RzKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAZmV0Y2ggYWxsIGN1aXNpbmVzIHdpdGggcHJvcGVyIGVycm9yIGhhbmRsaW5nLlxyXG4gICAqL1xyXG4gIHN0YXRpYyBmZXRjaEN1aXNpbmVzKGNhbGxiYWNrKSB7XHJcbiAgICAvLyBGZXRjaCBhbGwgcmVzdGF1cmFudHNcclxuICAgIERCSGVscGVyLmZldGNoUmVzdGF1cmFudHMoKGVycm9yLCByZXN0YXVyYW50cykgPT4ge1xyXG4gICAgICBpZiAoZXJyb3IpIHtcclxuICAgICAgICBjYWxsYmFjayhlcnJvciwgbnVsbCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gR2V0IGFsbCBjdWlzaW5lcyBmcm9tIGFsbCByZXN0YXVyYW50c1xyXG4gICAgICAgIGNvbnN0IGN1aXNpbmVzID0gcmVzdGF1cmFudHMubWFwKCh2LCBpKSA9PiByZXN0YXVyYW50c1tpXS5jdWlzaW5lX3R5cGUpO1xyXG4gICAgICAgIC8vIFJlbW92ZSBkdXBsaWNhdGVzIGZyb20gY3Vpc2luZXNcclxuICAgICAgICBjb25zdCB1bmlxdWVDdWlzaW5lcyA9IGN1aXNpbmVzLmZpbHRlcigodiwgaSkgPT4gY3Vpc2luZXMuaW5kZXhPZih2KSA9PSBpKTtcclxuICAgICAgICBjYWxsYmFjayhudWxsLCB1bmlxdWVDdWlzaW5lcyk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQHJlc3RhdXJhbnQgcGFnZSBVUkwuXHJcbiAgICovXHJcbiAgc3RhdGljIHVybEZvclJlc3RhdXJhbnQocmVzdGF1cmFudCkge1xyXG4gICAgcmV0dXJuIChgLi9yZXN0YXVyYW50Lmh0bWw/aWQ9JHtyZXN0YXVyYW50LmlkfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQHJlc3RhdXJhbnQgaW1hZ2UgVVJMLlxyXG4gICAqL1xyXG4gIHN0YXRpYyBpbWFnZVVybEZvclJlc3RhdXJhbnQocmVzdGF1cmFudCkge1xyXG4gICAgaWYgKHJlc3RhdXJhbnQucGhvdG9ncmFwaCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIHJlc3RhdXJhbnQucGhvdG9ncmFwaCA9IDEwO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIChgaW1nLyR7cmVzdGF1cmFudC5waG90b2dyYXBofS53ZWJwYCk7XHJcbiAgfVxyXG5cclxuICBzdGF0aWMgZGVsZXRlUmVzdGF1cmFudFJldmlld3MocmV2aWV3X2lkKSB7XHJcbiAgICBmZXRjaChgJHtEQkhlbHBlci5EQVRBQkFTRV9VUkx9L3Jldmlld3MvJHtyZXZpZXdfaWR9YCwge1xyXG4gICAgICBtZXRob2Q6ICdERUxFVEUnXHJcbiAgICB9KVxyXG4gICAgICAudGhlbihyZXNwb25zZSA9PiB7XHJcbiAgICAgICAgcmV0dXJuIHJlc3BvbnNlO1xyXG4gICAgICB9KVxyXG4gICAgICAudGhlbihkYXRhID0+IHtcclxuICAgICAgICByZXR1cm4gZGF0YTtcclxuICAgICAgfSlcclxuICAgICAgLmNhdGNoKGVyciA9PiB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ0Vycm9yJywgZXJyKTtcclxuICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAcG9zdCByZXZpZXdfZGF0YSB0byB0aGUgc2VydmVyIHdoZW4gYSB1c2VyIHN1Ym1pdHMgYSByZXZpZXdcclxuICAgKiBvbmxpbmU6IGtlZXAgaXQgaW4gdGhlIHJldmlld3Mgc3RvcmUgaW4gSW5kZXhlZERCXHJcbiAgICogb2ZmbGluZToga2VlcCBpdCBpbiB0aGUgb2ZmbG5lLXJldmlld3MgaW4gSW5kZXhlZERCXHJcbiAgICogQHBhcmFtIHJldmlld19kYXRhIGlzIGZyb20gYSB1c2VyIGZpbGxzIG91dCB0aGUgZm9ybVxyXG4gICAqL1xyXG4gIHN0YXRpYyBjcmVhdGVSZXN0YXVyYW50UmV2aWV3KHJldmlld19kYXRhKSB7XHJcbiAgICByZXR1cm4gZmV0Y2goYCR7REJIZWxwZXIuREFUQUJBU0VfVVJMfS9yZXZpZXdzYCwge1xyXG4gICAgICBtZXRob2Q6ICdQT1NUJyxcclxuICAgICAgY2FjaGU6ICduby1jYWNoZScsIC8vICpkZWZhdWx0LCBuby1jYWNoZSwgcmVsb2FkLCBmb3JjZS1jYWNoZSwgb25seS1pZi1jYWNoZWRcclxuICAgICAgY3JlZGVudGlhbHM6ICdzYW1lLW9yaWdpbicsXHJcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJldmlld19kYXRhKSxcclxuICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICdjb250ZW50LXR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcclxuICAgICAgfSxcclxuICAgICAgbW9kZTogJ2NvcnMnLFxyXG4gICAgICByZWRpcmVjdDogJ2ZvbGxvdycsXHJcbiAgICAgIHJlZmVycmVyOiAnbm8tcmVmZXJyZXInLFxyXG4gICAgfSlcclxuICAgICAgLnRoZW4ocmVzcG9uc2UgPT4ge1xyXG4gICAgICAgIHJlc3BvbnNlLmpzb24oKVxyXG4gICAgICAgICAgLnRoZW4ocmV2aWV3X2RhdGEgPT4ge1xyXG4gICAgICAgICAgLyoga2VlcCBkYXRhcyBpbiBJbmRleGVkREIgYWZ0ZXIgcG9zdGluZyBkYXRhIHRvIHRoZSBzZXJ2ZXIgd2hlbiBvbmxpbmUgKi9cclxuICAgICAgICAgICAgREJIZWxwZXIuc3RvcmVEYXRhSW5kZXhlZERiKFtyZXZpZXdfZGF0YV0sICdyZXZpZXdzJyk7XHJcbiAgICAgICAgICAgIHJldHVybiByZXZpZXdfZGF0YTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICB9KVxyXG4gICAgICAuY2F0Y2goZXJyb3IgPT4ge1xyXG4gICAgICAgIHJldmlld19kYXRhWyd1cGRhdGVkQXQnXSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xyXG4gICAgICAgIC8qIGtlZXAgZGF0YXMgaW4gSW5kZXhlZERCIGFmdGVyIHBvc3RpbmcgZGF0YSB0byB0aGUgc2VydmVyIHdoZW4gb2ZmbGluZSovXHJcbiAgICAgICAgREJIZWxwZXIuc3RvcmVEYXRhSW5kZXhlZERiKFtyZXZpZXdfZGF0YV0sICdvZmZsaW5lLXJldmlld3MnKTtcclxuICAgICAgICBjb25zb2xlLmxvZygnUmV2aWV3IHN0b3JlZCBvZmZsaW5lIGluIElEQicpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAY2xlYXIgZGF0YSBpbiB0aGUgb2ZmbGluZS1yZXZpZXdzIHN0b3JlXHJcbiAgICovXHJcbiAgc3RhdGljIGNsZWFyT2ZmbGluZVJldmlld3MoKSB7XHJcbiAgICBsZXQgZGJQcm9taXNlID0gREJIZWxwZXIub3BlbkRhdGFiYXNlKCk7XHJcbiAgICBkYlByb21pc2UudGhlbihkYiA9PiB7XHJcbiAgICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oJ29mZmxpbmUtcmV2aWV3cycsICdyZWFkd3JpdGUnKTtcclxuICAgICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZSgnb2ZmbGluZS1yZXZpZXdzJyk7XHJcbiAgICAgIHN0b3JlLmNsZWFyKCk7XHJcbiAgICB9KTtcclxuICAgIHJldHVybjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEBnZXQgcmV2aWV3cyBmcm9tIG9mZmxpbmUtc3RvcmVzIGluIEluZGV4ZWREQiB3aGVuIGEgdXNlciBnbyBmcm9tIG9mZmxpbmUgdG8gb25saW5lXHJcbiAgICovXHJcbiAgc3RhdGljIGNyZWF0ZU9mZmxpbmVSZXZpZXcoKSB7XHJcbiAgICBEQkhlbHBlci5vcGVuRGF0YWJhc2UoKS50aGVuKGRiID0+IHtcclxuICAgICAgaWYgKCFkYikgcmV0dXJuO1xyXG4gICAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKCdvZmZsaW5lLXJldmlld3MnLCAncmVhZHdyaXRlJyk7XHJcbiAgICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoJ29mZmxpbmUtcmV2aWV3cycpO1xyXG5cclxuICAgICAgc3RvcmUuZ2V0QWxsKCkudGhlbihvZmZsaW5lUmV2aWV3cyA9PiB7XHJcbiAgICAgICAgb2ZmbGluZVJldmlld3MuZm9yRWFjaChyZXZpZXcgPT4ge1xyXG4gICAgICAgICAgREJIZWxwZXIuY3JlYXRlUmVzdGF1cmFudFJldmlldyhyZXZpZXcpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIERCSGVscGVyLmNsZWFyT2ZmbGluZVJldmlld3MoKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcbiAgLyoqXHJcbiAgICpAd2hlbiBvbmxpbmUgdXBkYXRlIGEgdmFsdWUgb2YgYSByZXN0YXVyYW50J3MgZmF2b3JpdGUgYnkgc2VuZGluZyB0aGUgUFVUIHJlcXVlc3QgdG8gdGhlIHNlcnZlclxyXG4gICAqYW5kIHN0b3JlIHRoZSBkYXRhIHRvIEluZGV4ZWREQiBzbyBpdCBjYW4gYmUgdXNlZCB3aGVuIG9mZmxpbmVcclxuICAqL1xyXG4gIHN0YXRpYyB0b2dnbGVGYXZvcml0ZShyZXN0YXVyYW50LCBpc0Zhdm9yaXRlKSB7XHJcbiAgICByZXR1cm4gZmV0Y2goYCR7REJIZWxwZXIuREFUQUJBU0VfVVJMfS9yZXN0YXVyYW50cy8ke3Jlc3RhdXJhbnQuaWR9Lz9pc19mYXZvcml0ZT0ke2lzRmF2b3JpdGV9YCwge1xyXG4gICAgICBtZXRob2Q6ICdQVVQnLFxyXG4gICAgfSlcclxuICAgICAgLnRoZW4ocmVzcG9uc2UgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGB1cGRhdGVkIEFQSSByZXN0YXVyYW50OiAke3Jlc3RhdXJhbnQuaWR9IGZhdm9yaXRlIDogJHtpc0Zhdm9yaXRlfWApO1xyXG4gICAgICAgIHJldHVybiByZXNwb25zZS5qc29uKCk7XHJcbiAgICAgIH0pXHJcbiAgICAgIC50aGVuKGRhdGEgPT4ge1xyXG4gICAgICAgIERCSGVscGVyLnN0b3JlRGF0YUluZGV4ZWREYihbZGF0YV0sICdyZXN0YXVyYW50cycpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGB1cGRhdGVkIElEQiByZXN0YXVyYW50OiAke3Jlc3RhdXJhbnQuaWR9IGZhdm9yaXRlIDogJHtpc0Zhdm9yaXRlfWApO1xyXG4gICAgICAgIHJldHVybiBkYXRhO1xyXG4gICAgICB9KVxyXG4gICAgICAuY2F0Y2goZXJyb3IgPT4ge1xyXG4gICAgICAgIC8vIGNvbnZlcnQgZnJvbSBib29sZWFuIHRvIHN0cmluZyBiZWNhdXNlIHRoZSBBUEkgdXNlcyBzdHJpbmdzICd0cnVlJyBhbmQgJ2ZhbHNlJ1xyXG4gICAgICAgIHJlc3RhdXJhbnQuaXNfZmF2b3JpdGUgPSBpc0Zhdm9yaXRlID8gJ3RydWUnIDogJ2ZhbHNlJztcclxuXHJcbiAgICAgICAgREJIZWxwZXIuc3RvcmVEYXRhSW5kZXhlZERiKFtyZXN0YXVyYW50XSwgJ3Jlc3RhdXJhbnRzJyk7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ3N0b3JlIGZhdm9yaXRlIG9mZmxpbmUnKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAqIEBmaWxsIGZhdm9yaXRlcyBpbiBIVE1MIHNvIGl0IGNhbiBiZSB1c2VkIGJ5IGJvdGggbWFpbiBhbmQgcmVzdGF1cmFudCBwYWdlXHJcbiAqL1xyXG4gIHN0YXRpYyBmaWxsRmF2b3JpdGVzSFRNTChyZXN0YXVyYW50KSB7XHJcbiAgICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xhYmVsJyk7XHJcbiAgICBsYWJlbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnTGFiZWwgZm9yIGNoZWNraW5nIGZhdm9yaXRlJyk7XHJcbiAgICBsYWJlbC5jbGFzc05hbWUgPSAnZmF2LWNvbnRhaW5lcic7XHJcblxyXG4gICAgY29uc3QgaWNvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2knKTtcclxuICAgIGljb24uY2xhc3NOYW1lID0gJ2ZhcyBmYS1oZWFydCc7XHJcbiAgICBsYWJlbC5hcHBlbmQoaWNvbik7XHJcblxyXG4gICAgY29uc3QgaW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xyXG4gICAgaW5wdXQudHlwZSA9ICdjaGVja2JveCc7XHJcbiAgICBpbnB1dC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnU2VsZWN0IGZhdm9yaXRlJyk7XHJcblxyXG4gICAgaWYgKHJlc3RhdXJhbnQuaXNfZmF2b3JpdGUgPT0gJ3RydWUnKSB7XHJcbiAgICAgIGljb24uc3R5bGUuY29sb3IgPSAnI2QzMmYyZic7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBpY29uLnN0eWxlLmNvbG9yID0gJyNhZWIwYjEnO1xyXG4gICAgfVxyXG5cclxuICAgIGlucHV0LmNoZWNrZWQgPSAocmVzdGF1cmFudC5pc19mYXZvcml0ZSAgPT0gJ3RydWUnKTtcclxuICAgIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGV2ZW50ID0+IHtcclxuICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgaWYgKGlucHV0LmNoZWNrZWQgPT0gdHJ1ZSkge1xyXG4gICAgICAgIERCSGVscGVyLnRvZ2dsZUZhdm9yaXRlKHJlc3RhdXJhbnQsIGlucHV0LmNoZWNrZWQpO1xyXG4gICAgICAgIGljb24uc3R5bGUuY29sb3IgPSAnI2QzMmYyZic7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgREJIZWxwZXIudG9nZ2xlRmF2b3JpdGUocmVzdGF1cmFudCwgaW5wdXQuY2hlY2tlZCk7XHJcbiAgICAgICAgaWNvbi5zdHlsZS5jb2xvciA9ICcjYWViMGIxJztcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBsYWJlbC5hcHBlbmQoaW5wdXQpO1xyXG4gICAgcmV0dXJuIGxhYmVsO1xyXG4gIH1cclxuXHJcbiAgLypAY3JlYXRlIHRoZXNlIGZ1bmN0aW9ucyB0byBhZGQgb25saW5lIHN0YXR1cyB0byB0aGUgYnJvd3NlclxyXG4gICAqIHdoZW4gaXQgaXMgb2ZmbGluZSBpdCB3aWxsIHN0b3JlIHJldmlldyBzdWJtaXNzaW9ucyBpbiBvZmZsaW5lLXJldmlld3MgSW5kZXhlZERCXHJcbiAgICogd2hlbiBjb25uZWN0aXZpdHkgaXMgcmVlc3RhYmxpc2hlZCwgaXQgd2lsbCBjYWxsIHRoZSBmdW5jdGlvbiB0byBzaG93IG5ldyByZXZpZXdzIG9uIHRoZSBwYWdlXHJcbiAgKi9cclxuICBzdGF0aWMgb25Hb09ubGluZSgpIHtcclxuICAgIGNvbnNvbGUubG9nKCdHb2luZyBvbmxpbmUnKTtcclxuICAgIERCSGVscGVyLmNyZWF0ZU9mZmxpbmVSZXZpZXcoKTtcclxuICB9XHJcblxyXG4gIHN0YXRpYyBvbkdvT2ZmbGluZSgpIHtcclxuICAgIGNvbnNvbGUubG9nKCdHb2luZyBvZmZsaW5lJyk7XHJcbiAgfVxyXG59XHJcblxyXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignb25saW5lJywgREJIZWxwZXIub25Hb09ubGluZSk7XHJcbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdvZmZsaW5lJywgREJIZWxwZXIub25Hb09mZmxpbmUpO1xyXG5cclxuLyogQHJlZ2lzdGVyIFNlcnZpY2VXb3JrZXIgdG8gY2FjaGUgZGF0YSBmb3IgdGhlIHNpdGVcclxuICAgKiB0byBhbGxvdyBhbnkgcGFnZSB0aGF0IGhhcyBiZWVuIHZpc2l0ZWQgaXMgYWNjZXNzaWJsZSBvZmZsaW5lXHJcbiAgICovXHJcbm5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLnJlZ2lzdGVyKCcuL3N3LmpzJylcclxuICAudGhlbihmdW5jdGlvbihyZWcpIHtcclxuICAvLyBSZWdpc3RyYXRpb24gd2FzIHN1Y2Nlc3NmdWxcclxuICAgIGNvbnNvbGUubG9nKCdTZXJ2aWNlV29ya2VyIHJlZ2lzdHJhdGlvbiBzdWNjZXNzZnVsIHdpdGggc2NvcGU6ICcsIHJlZy5zY29wZSk7XHJcbiAgICBpZiAoIW5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLmNvbnRyb2xsZXIpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgaWYgKHJlZy53YWl0aW5nKSB7XHJcbiAgICAgIF91cGRhdGVSZWFkeShyZWcud2FpdGluZyk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGlmIChyZWcuaW5zdGFsbGluZykge1xyXG4gICAgICBfdHJhY2tJbnN0YWxsaW5nKHJlZy5pbnN0YWxsaW5nKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHJlZy5hZGRFdmVudExpc3RlbmVyKCd1cGRhdGVmb3VuZCcsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgX3RyYWNrSW5zdGFsbGluZyhyZWcuaW5zdGFsbGluZyk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB2YXIgcmVmcmVzaGluZztcclxuICAgIG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRyb2xsZXJjaGFuZ2UnLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgIGlmIChyZWZyZXNoaW5nKSByZXR1cm47XHJcbiAgICAgIHJlZnJlc2hpbmcgPSB0cnVlO1xyXG4gICAgfSk7XHJcbiAgfSlcclxuICAuY2F0Y2goZnVuY3Rpb24gKCkge1xyXG4gICAgY29uc29sZS5sb2coJ1NlcnZpY2Ugd29ya2VyIHJlZ2lzdHJhdGlvbiBmYWlsZWQnKTtcclxuICB9KTtcclxuXHJcbmxldCBfdXBkYXRlUmVhZHkgPSAod29ya2VyKSA9PiB7XHJcbiAgd29ya2VyLnBvc3RNZXNzYWdlKHthY3Rpb246ICdza2lwV2FpdGluZyd9KTtcclxufTtcclxuXHJcbmxldCAgX3RyYWNrSW5zdGFsbGluZyA9ICh3b3JrZXIpID0+IHtcclxuICBsZXQgaW5kZXhDb250cm9sbGVyID0gdGhpcztcclxuICB3b3JrZXIuYWRkRXZlbnRMaXN0ZW5lcignc3RhdGVDaGFuZ2UnLCBmdW5jdGlvbigpIHtcclxuICAgIGlmICh3b3JrZXIuc3RhdGUgPT0gJ2luc3RhbGxlZCcpIHtcclxuICAgICAgaW5kZXhDb250cm9sbGVyLl91cGRhdGVSZWFkeSh3b3JrZXIpO1xyXG4gICAgfVxyXG4gIH0pO1xyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgREJIZWxwZXI7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbmltcG9ydCBEQkhlbHBlciBmcm9tICcuL2RiaGVscGVyJztcclxuXHJcbnZhciBtYXJrZXJzID0gW107XHJcblxyXG4vKipcclxuICogRmV0Y2ggbmVpZ2hib3Job29kcyBhbmQgY3Vpc2luZXMgYXMgc29vbiBhcyB0aGUgcGFnZSBpcyBsb2FkZWQuXHJcbiAqL1xyXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgKCkgPT4ge1xyXG4gIERCSGVscGVyLmFkZFRpdGxlVG9NYXAoKTtcclxuICBEQkhlbHBlci5hZGRBbHRUb01hcCgpO1xyXG4gIGluaXRNYXAoKTtcclxuICBmZXRjaE5laWdoYm9yaG9vZHMoKTtcclxuICBmZXRjaEN1aXNpbmVzKCk7XHJcbn0pO1xyXG5cclxuLyoqXHJcbiAqIEluaXRpYWxpemUgR29vZ2xlIG1hcCwgY2FsbGVkIGZyb20gSFRNTC5cclxuICovXHJcbmxldCBpbml0TWFwID0gKCkgPT4ge1xyXG4gIGlmICh0eXBlb2YgZ29vZ2xlICE9PSAndW5kZWZpbmVkJykge1xyXG4gICAgbGV0IGxvYyA9IHtcclxuICAgICAgbGF0OiA0MC43MjIyMTYsXHJcbiAgICAgIGxuZzogLTczLjk4NzUwMVxyXG4gICAgfTtcclxuICAgIHNlbGYubWFwID0gbmV3IGdvb2dsZS5tYXBzLk1hcChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWFwJyksIHtcclxuICAgICAgem9vbTogMTIsXHJcbiAgICAgIGNlbnRlcjogbG9jLFxyXG4gICAgICBzY3JvbGx3aGVlbDogZmFsc2VcclxuICAgIH0pO1xyXG4gICAgc2VsZi51cGRhdGVSZXN0YXVyYW50cygpO1xyXG4gIH1cclxuICBzZWxmLnVwZGF0ZVJlc3RhdXJhbnRzKCk7XHJcbn07XHJcblxyXG4vKipcclxuICogQWRkIG1hcmtlcnMgZm9yIGN1cnJlbnQgcmVzdGF1cmFudHMgdG8gdGhlIG1hcC5cclxuICovXHJcbmxldCBhZGRNYXJrZXJzVG9NYXAgPSAocmVzdGF1cmFudHMpID0+IHtcclxuICByZXN0YXVyYW50cy5mb3JFYWNoKHJlc3RhdXJhbnQgPT4ge1xyXG4gICAgLy8gQWRkIG1hcmtlciB0byB0aGUgbWFwXHJcbiAgICBjb25zdCBtYXJrZXIgPSBEQkhlbHBlci5tYXBNYXJrZXJGb3JSZXN0YXVyYW50KHJlc3RhdXJhbnQsIHNlbGYubWFwKTtcclxuICAgIGdvb2dsZS5tYXBzLmV2ZW50LmFkZExpc3RlbmVyKG1hcmtlciwgJ2NsaWNrJywgKCkgPT4ge1xyXG4gICAgICB3aW5kb3cubG9jYXRpb24uaHJlZiA9IG1hcmtlci51cmw7XHJcbiAgICB9KTtcclxuICAgIG1hcmtlcnMucHVzaChtYXJrZXIpO1xyXG4gIH0pO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEZldGNoIGFsbCBuZWlnaGJvcmhvb2RzIGFuZCBzZXQgdGhlaXIgSFRNTC5cclxuICovXHJcbmxldCBmZXRjaE5laWdoYm9yaG9vZHMgPSAoKSA9PiB7XHJcbiAgREJIZWxwZXIuZmV0Y2hOZWlnaGJvcmhvb2RzKChlcnJvciwgbmVpZ2hib3Job29kcykgPT4ge1xyXG4gICAgaWYgKGVycm9yKSB7IC8vIEdvdCBhbiBlcnJvclxyXG4gICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGZpbGxOZWlnaGJvcmhvb2RzSFRNTChuZWlnaGJvcmhvb2RzKTtcclxuICAgIH1cclxuICB9KTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBTZXQgbmVpZ2hib3Job29kcyBIVE1MLlxyXG4gKi9cclxubGV0IGZpbGxOZWlnaGJvcmhvb2RzSFRNTCA9IChuZWlnaGJvcmhvb2RzKSA9PiB7XHJcbiAgY29uc3Qgc2VsZWN0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ25laWdoYm9yaG9vZHMtc2VsZWN0Jyk7XHJcbiAgbmVpZ2hib3Job29kcy5mb3JFYWNoKG5laWdoYm9yaG9vZCA9PiB7XHJcbiAgICBjb25zdCBvcHRpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdvcHRpb24nKTtcclxuICAgIG9wdGlvbi5pbm5lckhUTUwgPSBuZWlnaGJvcmhvb2Q7XHJcbiAgICBvcHRpb24uc2V0QXR0cmlidXRlKCd2YWx1ZScsIG5laWdoYm9yaG9vZCk7XHJcbiAgICBvcHRpb24uc2V0QXR0cmlidXRlKCdyb2xlJywgJ29wdGlvbicpO1xyXG4gICAgc2VsZWN0LmFwcGVuZChvcHRpb24pO1xyXG4gIH0pO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEZldGNoIGFsbCBjdWlzaW5lcyBhbmQgc2V0IHRoZWlyIEhUTUwuXHJcbiAqL1xyXG5sZXQgZmV0Y2hDdWlzaW5lcyA9ICgpID0+IHtcclxuICBEQkhlbHBlci5mZXRjaEN1aXNpbmVzKChlcnJvciwgY3Vpc2luZXMpID0+IHtcclxuICAgIGlmIChlcnJvcikgeyAvLyBHb3QgYW4gZXJyb3IhXHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgZmlsbEN1aXNpbmVzSFRNTChjdWlzaW5lcyk7XHJcbiAgICB9XHJcbiAgfSk7XHJcbn07XHJcblxyXG4vKipcclxuICogU2V0IGN1aXNpbmVzIEhUTUwuXHJcbiAqL1xyXG5sZXQgZmlsbEN1aXNpbmVzSFRNTCA9IChjdWlzaW5lcykgPT4ge1xyXG4gIGNvbnN0IHNlbGVjdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjdWlzaW5lcy1zZWxlY3QnKTtcclxuXHJcbiAgY3Vpc2luZXMuZm9yRWFjaChjdWlzaW5lID0+IHtcclxuICAgIGNvbnN0IG9wdGlvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ29wdGlvbicpO1xyXG4gICAgb3B0aW9uLmlubmVySFRNTCA9IGN1aXNpbmU7XHJcbiAgICBvcHRpb24uc2V0QXR0cmlidXRlKCd2YWx1ZScsIGN1aXNpbmUpO1xyXG4gICAgb3B0aW9uLnNldEF0dHJpYnV0ZSgncm9sZScsICdvcHRpb24nKTtcclxuICAgIHNlbGVjdC5hcHBlbmQob3B0aW9uKTtcclxuICB9KTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDcmVhdGUgcmVzdGF1cmFudCBIVE1MLlxyXG4gKi9cclxubGV0IGNyZWF0ZVJlc3RhdXJhbnRIVE1MID0gKHJlc3RhdXJhbnQpID0+IHtcclxuICBjb25zdCBsaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJyk7XHJcblxyXG4gIGNvbnN0IGltYWdlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW1nJyk7XHJcbiAgaW1hZ2UuY2xhc3NOYW1lID0gJ3Jlc3RhdXJhbnQtaW1ncyc7XHJcbiAgaW1hZ2Uuc3JjID0gREJIZWxwZXIuaW1hZ2VVcmxGb3JSZXN0YXVyYW50KHJlc3RhdXJhbnQpO1xyXG4gIGltYWdlLmFsdCA9IGAke3Jlc3RhdXJhbnQubmFtZX0gaXMgJHtyZXN0YXVyYW50LmN1aXNpbmVfdHlwZX0gcmVzdGF1cmFudGA7XHJcbiAgbGkuYXBwZW5kKGltYWdlKTtcclxuXHJcbiAgY29uc3QgbmFtZVdyYXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICBuYW1lV3JhcC5jbGFzc05hbWUgPSAnbmFtZS13cmFwJztcclxuICBjb25zdCBuYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaDMnKTtcclxuICBuYW1lLmlubmVySFRNTCA9IHJlc3RhdXJhbnQubmFtZTtcclxuICBuYW1lV3JhcC5hcHBlbmQobmFtZSk7XHJcbiAgLy9pbXBvcnQgdGhlIGZpbGxGYXZvcml0ZXNIVE1MIGZyb20gZGJoZWxwZXIuanNcclxuICBuYW1lV3JhcC5hcHBlbmQoREJIZWxwZXIuZmlsbEZhdm9yaXRlc0hUTUwocmVzdGF1cmFudCkpO1xyXG4gIGxpLmFwcGVuZChuYW1lV3JhcCk7XHJcblxyXG4gIGNvbnN0IGFkZHJlc3NXcmFwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgYWRkcmVzc1dyYXAuY2xhc3NOYW1lID0gJ2FkZHJlc3Mtd3JhcCc7XHJcbiAgY29uc3QgbmVpZ2hib3Job29kID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgncCcpO1xyXG4gIG5laWdoYm9yaG9vZC5pbm5lckhUTUwgPSByZXN0YXVyYW50Lm5laWdoYm9yaG9vZDtcclxuICBhZGRyZXNzV3JhcC5hcHBlbmQobmVpZ2hib3Job29kKTtcclxuXHJcbiAgY29uc3QgYWRkcmVzcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3AnKTtcclxuICBhZGRyZXNzLmlubmVySFRNTCA9IHJlc3RhdXJhbnQuYWRkcmVzcztcclxuICBhZGRyZXNzV3JhcC5hcHBlbmQoYWRkcmVzcyk7XHJcbiAgbGkuYXBwZW5kKGFkZHJlc3NXcmFwKTtcclxuXHJcbiAgY29uc3QgbW9yZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcclxuICBtb3JlLmlubmVySFRNTCA9ICdWaWV3IERldGFpbHMnO1xyXG4gIG1vcmUuaHJlZiA9IERCSGVscGVyLnVybEZvclJlc3RhdXJhbnQocmVzdGF1cmFudCk7XHJcbiAgbGkuYXBwZW5kKG1vcmUpO1xyXG5cclxuICByZXR1cm4gbGk7XHJcbn07XHJcblxyXG4vKipcclxuICogQ2xlYXIgY3VycmVudCByZXN0YXVyYW50cywgdGhlaXIgSFRNTCBhbmQgcmVtb3ZlIHRoZWlyIG1hcCBtYXJrZXJzLlxyXG4gKi9cclxubGV0IHJlc2V0UmVzdGF1cmFudHMgPSAocmVzdGF1cmFudHMpID0+IHtcclxuICAvLyBSZW1vdmUgYWxsIHJlc3RhdXJhbnRzXHJcbiAgcmVzdGF1cmFudHMgPSBbXTtcclxuICBjb25zdCB1bCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXN0YXVyYW50cy1saXN0Jyk7XHJcbiAgdWwuaW5uZXJIVE1MID0gJyc7XHJcblxyXG4gIC8vIFJlbW92ZSBhbGwgbWFwIG1hcmtlcnNcclxuICBtYXJrZXJzLmZvckVhY2gobSA9PiBtLnNldE1hcChudWxsKSk7XHJcbiAgbWFya2VycyA9IFtdO1xyXG4gIHNlbGYucmVzdGF1cmFudHMgPSByZXN0YXVyYW50cztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDcmVhdGUgYWxsIHJlc3RhdXJhbnRzIEhUTUwgYW5kIGFkZCB0aGVtIHRvIHRoZSB3ZWJwYWdlLlxyXG4gKi9cclxubGV0IGZpbGxSZXN0YXVyYW50c0hUTUwgPSAocmVzdGF1cmFudHMpID0+IHtcclxuICBjb25zdCB1bCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXN0YXVyYW50cy1saXN0Jyk7XHJcblxyXG4gIHJlc3RhdXJhbnRzLmZvckVhY2gocmVzdGF1cmFudCA9PiB7XHJcbiAgICB1bC5hcHBlbmQoY3JlYXRlUmVzdGF1cmFudEhUTUwocmVzdGF1cmFudCkpO1xyXG4gIH0pO1xyXG4gIGlmKHR5cGVvZiBnb29nbGUgIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICBhZGRNYXJrZXJzVG9NYXAocmVzdGF1cmFudHMpO1xyXG4gIH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBVcGRhdGUgcGFnZSBhbmQgbWFwIGZvciBjdXJyZW50IHJlc3RhdXJhbnRzIGFuZCBtYWtlIGl0IGdsb2JhbCBzb1xyXG4gKiBpdCBhbGxvd3MgaW5kZXguaHRtbCB1c2UgdGhpcyBmdW5jdGlvbiB0byB1cGRhdGUgdGhlIGNvbnRlbnRcclxuICovXHJcbnNlbGYudXBkYXRlUmVzdGF1cmFudHMgPSAoKSA9PiB7XHJcbiAgY29uc3QgY1NlbGVjdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjdWlzaW5lcy1zZWxlY3QnKTtcclxuICBjb25zdCBuU2VsZWN0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ25laWdoYm9yaG9vZHMtc2VsZWN0Jyk7XHJcbiAgY29uc3QgZlNlbGVjdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmYXZvcml0ZXMtc2VsZWN0Jyk7XHJcblxyXG4gIGNvbnN0IGNJbmRleCA9IGNTZWxlY3Quc2VsZWN0ZWRJbmRleDtcclxuICBjb25zdCBuSW5kZXggPSBuU2VsZWN0LnNlbGVjdGVkSW5kZXg7XHJcbiAgY29uc3QgZkluZGV4ID0gZlNlbGVjdC5zZWxlY3RlZEluZGV4O1xyXG5cclxuICBjb25zdCBjdWlzaW5lID0gY1NlbGVjdFtjSW5kZXhdLnZhbHVlO1xyXG4gIGNvbnN0IG5laWdoYm9yaG9vZCA9IG5TZWxlY3RbbkluZGV4XS52YWx1ZTtcclxuICBjb25zdCBmYXZvcml0ZSA9IGZTZWxlY3RbZkluZGV4XS52YWx1ZTtcclxuXHJcbiAgREJIZWxwZXIuZmV0Y2hSZXN0YXVyYW50QnlDdWlzaW5lTmVpZ2hib3Job29kQW5kRmF2b3JpdGUoY3Vpc2luZSwgbmVpZ2hib3Job29kLCBmYXZvcml0ZSwgKGVycm9yLCByZXN0YXVyYW50cykgPT4ge1xyXG4gICAgaWYgKGVycm9yKSB7IC8vIEdvdCBhbiBlcnJvciFcclxuICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICByZXNldFJlc3RhdXJhbnRzKHJlc3RhdXJhbnRzKTtcclxuICAgICAgZmlsbFJlc3RhdXJhbnRzSFRNTChyZXN0YXVyYW50cyk7XHJcbiAgICB9XHJcbiAgfSk7XHJcbn07XHJcblxyXG5cclxuXHJcbiIsIid1c2Ugc3RyaWN0JztcblxuKGZ1bmN0aW9uKCkge1xuICBmdW5jdGlvbiB0b0FycmF5KGFycikge1xuICAgIHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcnIpO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJvbWlzaWZ5UmVxdWVzdChyZXF1ZXN0KSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVzb2x2ZShyZXF1ZXN0LnJlc3VsdCk7XG4gICAgICB9O1xuXG4gICAgICByZXF1ZXN0Lm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVqZWN0KHJlcXVlc3QuZXJyb3IpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb21pc2lmeVJlcXVlc3RDYWxsKG9iaiwgbWV0aG9kLCBhcmdzKSB7XG4gICAgdmFyIHJlcXVlc3Q7XG4gICAgdmFyIHAgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIHJlcXVlc3QgPSBvYmpbbWV0aG9kXS5hcHBseShvYmosIGFyZ3MpO1xuICAgICAgcHJvbWlzaWZ5UmVxdWVzdChyZXF1ZXN0KS50aGVuKHJlc29sdmUsIHJlamVjdCk7XG4gICAgfSk7XG5cbiAgICBwLnJlcXVlc3QgPSByZXF1ZXN0O1xuICAgIHJldHVybiBwO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJvbWlzaWZ5Q3Vyc29yUmVxdWVzdENhbGwob2JqLCBtZXRob2QsIGFyZ3MpIHtcbiAgICB2YXIgcCA9IHByb21pc2lmeVJlcXVlc3RDYWxsKG9iaiwgbWV0aG9kLCBhcmdzKTtcbiAgICByZXR1cm4gcC50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICBpZiAoIXZhbHVlKSByZXR1cm47XG4gICAgICByZXR1cm4gbmV3IEN1cnNvcih2YWx1ZSwgcC5yZXF1ZXN0KTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb3h5UHJvcGVydGllcyhQcm94eUNsYXNzLCB0YXJnZXRQcm9wLCBwcm9wZXJ0aWVzKSB7XG4gICAgcHJvcGVydGllcy5mb3JFYWNoKGZ1bmN0aW9uKHByb3ApIHtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShQcm94eUNsYXNzLnByb3RvdHlwZSwgcHJvcCwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiB0aGlzW3RhcmdldFByb3BdW3Byb3BdO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgIHRoaXNbdGFyZ2V0UHJvcF1bcHJvcF0gPSB2YWw7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJveHlSZXF1ZXN0TWV0aG9kcyhQcm94eUNsYXNzLCB0YXJnZXRQcm9wLCBDb25zdHJ1Y3RvciwgcHJvcGVydGllcykge1xuICAgIHByb3BlcnRpZXMuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICBpZiAoIShwcm9wIGluIENvbnN0cnVjdG9yLnByb3RvdHlwZSkpIHJldHVybjtcbiAgICAgIFByb3h5Q2xhc3MucHJvdG90eXBlW3Byb3BdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNpZnlSZXF1ZXN0Q2FsbCh0aGlzW3RhcmdldFByb3BdLCBwcm9wLCBhcmd1bWVudHMpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb3h5TWV0aG9kcyhQcm94eUNsYXNzLCB0YXJnZXRQcm9wLCBDb25zdHJ1Y3RvciwgcHJvcGVydGllcykge1xuICAgIHByb3BlcnRpZXMuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICBpZiAoIShwcm9wIGluIENvbnN0cnVjdG9yLnByb3RvdHlwZSkpIHJldHVybjtcbiAgICAgIFByb3h5Q2xhc3MucHJvdG90eXBlW3Byb3BdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzW3RhcmdldFByb3BdW3Byb3BdLmFwcGx5KHRoaXNbdGFyZ2V0UHJvcF0sIGFyZ3VtZW50cyk7XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJveHlDdXJzb3JSZXF1ZXN0TWV0aG9kcyhQcm94eUNsYXNzLCB0YXJnZXRQcm9wLCBDb25zdHJ1Y3RvciwgcHJvcGVydGllcykge1xuICAgIHByb3BlcnRpZXMuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICBpZiAoIShwcm9wIGluIENvbnN0cnVjdG9yLnByb3RvdHlwZSkpIHJldHVybjtcbiAgICAgIFByb3h5Q2xhc3MucHJvdG90eXBlW3Byb3BdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNpZnlDdXJzb3JSZXF1ZXN0Q2FsbCh0aGlzW3RhcmdldFByb3BdLCBwcm9wLCBhcmd1bWVudHMpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIEluZGV4KGluZGV4KSB7XG4gICAgdGhpcy5faW5kZXggPSBpbmRleDtcbiAgfVxuXG4gIHByb3h5UHJvcGVydGllcyhJbmRleCwgJ19pbmRleCcsIFtcbiAgICAnbmFtZScsXG4gICAgJ2tleVBhdGgnLFxuICAgICdtdWx0aUVudHJ5JyxcbiAgICAndW5pcXVlJ1xuICBdKTtcblxuICBwcm94eVJlcXVlc3RNZXRob2RzKEluZGV4LCAnX2luZGV4JywgSURCSW5kZXgsIFtcbiAgICAnZ2V0JyxcbiAgICAnZ2V0S2V5JyxcbiAgICAnZ2V0QWxsJyxcbiAgICAnZ2V0QWxsS2V5cycsXG4gICAgJ2NvdW50J1xuICBdKTtcblxuICBwcm94eUN1cnNvclJlcXVlc3RNZXRob2RzKEluZGV4LCAnX2luZGV4JywgSURCSW5kZXgsIFtcbiAgICAnb3BlbkN1cnNvcicsXG4gICAgJ29wZW5LZXlDdXJzb3InXG4gIF0pO1xuXG4gIGZ1bmN0aW9uIEN1cnNvcihjdXJzb3IsIHJlcXVlc3QpIHtcbiAgICB0aGlzLl9jdXJzb3IgPSBjdXJzb3I7XG4gICAgdGhpcy5fcmVxdWVzdCA9IHJlcXVlc3Q7XG4gIH1cblxuICBwcm94eVByb3BlcnRpZXMoQ3Vyc29yLCAnX2N1cnNvcicsIFtcbiAgICAnZGlyZWN0aW9uJyxcbiAgICAna2V5JyxcbiAgICAncHJpbWFyeUtleScsXG4gICAgJ3ZhbHVlJ1xuICBdKTtcblxuICBwcm94eVJlcXVlc3RNZXRob2RzKEN1cnNvciwgJ19jdXJzb3InLCBJREJDdXJzb3IsIFtcbiAgICAndXBkYXRlJyxcbiAgICAnZGVsZXRlJ1xuICBdKTtcblxuICAvLyBwcm94eSAnbmV4dCcgbWV0aG9kc1xuICBbJ2FkdmFuY2UnLCAnY29udGludWUnLCAnY29udGludWVQcmltYXJ5S2V5J10uZm9yRWFjaChmdW5jdGlvbihtZXRob2ROYW1lKSB7XG4gICAgaWYgKCEobWV0aG9kTmFtZSBpbiBJREJDdXJzb3IucHJvdG90eXBlKSkgcmV0dXJuO1xuICAgIEN1cnNvci5wcm90b3R5cGVbbWV0aG9kTmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBjdXJzb3IgPSB0aGlzO1xuICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgY3Vyc29yLl9jdXJzb3JbbWV0aG9kTmFtZV0uYXBwbHkoY3Vyc29yLl9jdXJzb3IsIGFyZ3MpO1xuICAgICAgICByZXR1cm4gcHJvbWlzaWZ5UmVxdWVzdChjdXJzb3IuX3JlcXVlc3QpLnRoZW4oZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgICBpZiAoIXZhbHVlKSByZXR1cm47XG4gICAgICAgICAgcmV0dXJuIG5ldyBDdXJzb3IodmFsdWUsIGN1cnNvci5fcmVxdWVzdCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfTtcbiAgfSk7XG5cbiAgZnVuY3Rpb24gT2JqZWN0U3RvcmUoc3RvcmUpIHtcbiAgICB0aGlzLl9zdG9yZSA9IHN0b3JlO1xuICB9XG5cbiAgT2JqZWN0U3RvcmUucHJvdG90eXBlLmNyZWF0ZUluZGV4ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBJbmRleCh0aGlzLl9zdG9yZS5jcmVhdGVJbmRleC5hcHBseSh0aGlzLl9zdG9yZSwgYXJndW1lbnRzKSk7XG4gIH07XG5cbiAgT2JqZWN0U3RvcmUucHJvdG90eXBlLmluZGV4ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBJbmRleCh0aGlzLl9zdG9yZS5pbmRleC5hcHBseSh0aGlzLl9zdG9yZSwgYXJndW1lbnRzKSk7XG4gIH07XG5cbiAgcHJveHlQcm9wZXJ0aWVzKE9iamVjdFN0b3JlLCAnX3N0b3JlJywgW1xuICAgICduYW1lJyxcbiAgICAna2V5UGF0aCcsXG4gICAgJ2luZGV4TmFtZXMnLFxuICAgICdhdXRvSW5jcmVtZW50J1xuICBdKTtcblxuICBwcm94eVJlcXVlc3RNZXRob2RzKE9iamVjdFN0b3JlLCAnX3N0b3JlJywgSURCT2JqZWN0U3RvcmUsIFtcbiAgICAncHV0JyxcbiAgICAnYWRkJyxcbiAgICAnZGVsZXRlJyxcbiAgICAnY2xlYXInLFxuICAgICdnZXQnLFxuICAgICdnZXRBbGwnLFxuICAgICdnZXRLZXknLFxuICAgICdnZXRBbGxLZXlzJyxcbiAgICAnY291bnQnXG4gIF0pO1xuXG4gIHByb3h5Q3Vyc29yUmVxdWVzdE1ldGhvZHMoT2JqZWN0U3RvcmUsICdfc3RvcmUnLCBJREJPYmplY3RTdG9yZSwgW1xuICAgICdvcGVuQ3Vyc29yJyxcbiAgICAnb3BlbktleUN1cnNvcidcbiAgXSk7XG5cbiAgcHJveHlNZXRob2RzKE9iamVjdFN0b3JlLCAnX3N0b3JlJywgSURCT2JqZWN0U3RvcmUsIFtcbiAgICAnZGVsZXRlSW5kZXgnXG4gIF0pO1xuXG4gIGZ1bmN0aW9uIFRyYW5zYWN0aW9uKGlkYlRyYW5zYWN0aW9uKSB7XG4gICAgdGhpcy5fdHggPSBpZGJUcmFuc2FjdGlvbjtcbiAgICB0aGlzLmNvbXBsZXRlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICBpZGJUcmFuc2FjdGlvbi5vbmNvbXBsZXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH07XG4gICAgICBpZGJUcmFuc2FjdGlvbi5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlamVjdChpZGJUcmFuc2FjdGlvbi5lcnJvcik7XG4gICAgICB9O1xuICAgICAgaWRiVHJhbnNhY3Rpb24ub25hYm9ydCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZWplY3QoaWRiVHJhbnNhY3Rpb24uZXJyb3IpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIFRyYW5zYWN0aW9uLnByb3RvdHlwZS5vYmplY3RTdG9yZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgT2JqZWN0U3RvcmUodGhpcy5fdHgub2JqZWN0U3RvcmUuYXBwbHkodGhpcy5fdHgsIGFyZ3VtZW50cykpO1xuICB9O1xuXG4gIHByb3h5UHJvcGVydGllcyhUcmFuc2FjdGlvbiwgJ190eCcsIFtcbiAgICAnb2JqZWN0U3RvcmVOYW1lcycsXG4gICAgJ21vZGUnXG4gIF0pO1xuXG4gIHByb3h5TWV0aG9kcyhUcmFuc2FjdGlvbiwgJ190eCcsIElEQlRyYW5zYWN0aW9uLCBbXG4gICAgJ2Fib3J0J1xuICBdKTtcblxuICBmdW5jdGlvbiBVcGdyYWRlREIoZGIsIG9sZFZlcnNpb24sIHRyYW5zYWN0aW9uKSB7XG4gICAgdGhpcy5fZGIgPSBkYjtcbiAgICB0aGlzLm9sZFZlcnNpb24gPSBvbGRWZXJzaW9uO1xuICAgIHRoaXMudHJhbnNhY3Rpb24gPSBuZXcgVHJhbnNhY3Rpb24odHJhbnNhY3Rpb24pO1xuICB9XG5cbiAgVXBncmFkZURCLnByb3RvdHlwZS5jcmVhdGVPYmplY3RTdG9yZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgT2JqZWN0U3RvcmUodGhpcy5fZGIuY3JlYXRlT2JqZWN0U3RvcmUuYXBwbHkodGhpcy5fZGIsIGFyZ3VtZW50cykpO1xuICB9O1xuXG4gIHByb3h5UHJvcGVydGllcyhVcGdyYWRlREIsICdfZGInLCBbXG4gICAgJ25hbWUnLFxuICAgICd2ZXJzaW9uJyxcbiAgICAnb2JqZWN0U3RvcmVOYW1lcydcbiAgXSk7XG5cbiAgcHJveHlNZXRob2RzKFVwZ3JhZGVEQiwgJ19kYicsIElEQkRhdGFiYXNlLCBbXG4gICAgJ2RlbGV0ZU9iamVjdFN0b3JlJyxcbiAgICAnY2xvc2UnXG4gIF0pO1xuXG4gIGZ1bmN0aW9uIERCKGRiKSB7XG4gICAgdGhpcy5fZGIgPSBkYjtcbiAgfVxuXG4gIERCLnByb3RvdHlwZS50cmFuc2FjdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgVHJhbnNhY3Rpb24odGhpcy5fZGIudHJhbnNhY3Rpb24uYXBwbHkodGhpcy5fZGIsIGFyZ3VtZW50cykpO1xuICB9O1xuXG4gIHByb3h5UHJvcGVydGllcyhEQiwgJ19kYicsIFtcbiAgICAnbmFtZScsXG4gICAgJ3ZlcnNpb24nLFxuICAgICdvYmplY3RTdG9yZU5hbWVzJ1xuICBdKTtcblxuICBwcm94eU1ldGhvZHMoREIsICdfZGInLCBJREJEYXRhYmFzZSwgW1xuICAgICdjbG9zZSdcbiAgXSk7XG5cbiAgLy8gQWRkIGN1cnNvciBpdGVyYXRvcnNcbiAgLy8gVE9ETzogcmVtb3ZlIHRoaXMgb25jZSBicm93c2VycyBkbyB0aGUgcmlnaHQgdGhpbmcgd2l0aCBwcm9taXNlc1xuICBbJ29wZW5DdXJzb3InLCAnb3BlbktleUN1cnNvciddLmZvckVhY2goZnVuY3Rpb24oZnVuY05hbWUpIHtcbiAgICBbT2JqZWN0U3RvcmUsIEluZGV4XS5mb3JFYWNoKGZ1bmN0aW9uKENvbnN0cnVjdG9yKSB7XG4gICAgICAvLyBEb24ndCBjcmVhdGUgaXRlcmF0ZUtleUN1cnNvciBpZiBvcGVuS2V5Q3Vyc29yIGRvZXNuJ3QgZXhpc3QuXG4gICAgICBpZiAoIShmdW5jTmFtZSBpbiBDb25zdHJ1Y3Rvci5wcm90b3R5cGUpKSByZXR1cm47XG5cbiAgICAgIENvbnN0cnVjdG9yLnByb3RvdHlwZVtmdW5jTmFtZS5yZXBsYWNlKCdvcGVuJywgJ2l0ZXJhdGUnKV0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSB0b0FycmF5KGFyZ3VtZW50cyk7XG4gICAgICAgIHZhciBjYWxsYmFjayA9IGFyZ3NbYXJncy5sZW5ndGggLSAxXTtcbiAgICAgICAgdmFyIG5hdGl2ZU9iamVjdCA9IHRoaXMuX3N0b3JlIHx8IHRoaXMuX2luZGV4O1xuICAgICAgICB2YXIgcmVxdWVzdCA9IG5hdGl2ZU9iamVjdFtmdW5jTmFtZV0uYXBwbHkobmF0aXZlT2JqZWN0LCBhcmdzLnNsaWNlKDAsIC0xKSk7XG4gICAgICAgIHJlcXVlc3Qub25zdWNjZXNzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgY2FsbGJhY2socmVxdWVzdC5yZXN1bHQpO1xuICAgICAgICB9O1xuICAgICAgfTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgLy8gcG9seWZpbGwgZ2V0QWxsXG4gIFtJbmRleCwgT2JqZWN0U3RvcmVdLmZvckVhY2goZnVuY3Rpb24oQ29uc3RydWN0b3IpIHtcbiAgICBpZiAoQ29uc3RydWN0b3IucHJvdG90eXBlLmdldEFsbCkgcmV0dXJuO1xuICAgIENvbnN0cnVjdG9yLnByb3RvdHlwZS5nZXRBbGwgPSBmdW5jdGlvbihxdWVyeSwgY291bnQpIHtcbiAgICAgIHZhciBpbnN0YW5jZSA9IHRoaXM7XG4gICAgICB2YXIgaXRlbXMgPSBbXTtcblxuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUpIHtcbiAgICAgICAgaW5zdGFuY2UuaXRlcmF0ZUN1cnNvcihxdWVyeSwgZnVuY3Rpb24oY3Vyc29yKSB7XG4gICAgICAgICAgaWYgKCFjdXJzb3IpIHtcbiAgICAgICAgICAgIHJlc29sdmUoaXRlbXMpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpdGVtcy5wdXNoKGN1cnNvci52YWx1ZSk7XG5cbiAgICAgICAgICBpZiAoY291bnQgIT09IHVuZGVmaW5lZCAmJiBpdGVtcy5sZW5ndGggPT0gY291bnQpIHtcbiAgICAgICAgICAgIHJlc29sdmUoaXRlbXMpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjdXJzb3IuY29udGludWUoKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9O1xuICB9KTtcblxuICB2YXIgZXhwID0ge1xuICAgIG9wZW46IGZ1bmN0aW9uKG5hbWUsIHZlcnNpb24sIHVwZ3JhZGVDYWxsYmFjaykge1xuICAgICAgdmFyIHAgPSBwcm9taXNpZnlSZXF1ZXN0Q2FsbChpbmRleGVkREIsICdvcGVuJywgW25hbWUsIHZlcnNpb25dKTtcbiAgICAgIHZhciByZXF1ZXN0ID0gcC5yZXF1ZXN0O1xuXG4gICAgICBpZiAocmVxdWVzdCkge1xuICAgICAgICByZXF1ZXN0Lm9udXBncmFkZW5lZWRlZCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgaWYgKHVwZ3JhZGVDYWxsYmFjaykge1xuICAgICAgICAgICAgdXBncmFkZUNhbGxiYWNrKG5ldyBVcGdyYWRlREIocmVxdWVzdC5yZXN1bHQsIGV2ZW50Lm9sZFZlcnNpb24sIHJlcXVlc3QudHJhbnNhY3Rpb24pKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwLnRoZW4oZnVuY3Rpb24oZGIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBEQihkYik7XG4gICAgICB9KTtcbiAgICB9LFxuICAgIGRlbGV0ZTogZnVuY3Rpb24obmFtZSkge1xuICAgICAgcmV0dXJuIHByb21pc2lmeVJlcXVlc3RDYWxsKGluZGV4ZWREQiwgJ2RlbGV0ZURhdGFiYXNlJywgW25hbWVdKTtcbiAgICB9XG4gIH07XG5cbiAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBleHA7XG4gICAgbW9kdWxlLmV4cG9ydHMuZGVmYXVsdCA9IG1vZHVsZS5leHBvcnRzO1xuICB9XG4gIGVsc2Uge1xuICAgIHNlbGYuaWRiID0gZXhwO1xuICB9XG59KCkpO1xuIl19
