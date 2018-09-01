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

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _dbhelper = require('./dbhelper');

var _dbhelper2 = _interopRequireDefault(_dbhelper);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @initialize Google map, called from HTML.
 */

document.addEventListener('DOMContentLoaded', function () {
  initMap();
});

var initMap = function initMap() {
  fetchRestaurantFromURL(function (error, restaurant) {
    if (error) {
      // Got an error!
      console.error(error);
    } else {
      if (typeof google !== 'undefined') {
        self.map = new google.maps.Map(document.getElementById('map'), {
          zoom: 16,
          center: restaurant.latlng,
          scrollwheel: false
        });
        fillBreadcrumb(self.restaurant);
        _dbhelper2.default.mapMarkerForRestaurant(self.restaurant, self.map);
      }
    }
  });
};

window.gm_authFailure = function () {
  var mapView = document.getElementById('map-container');
  mapView.innerHTML = '<p id="error-map">Authentication Error with Google Map!</p>';
};

/**
 * @add restaurant name to the breadcrumb navigation menu
 */
var fillBreadcrumb = function fillBreadcrumb(restaurant) {
  var breadcrumb = document.getElementById('breadcrumb');

  var liName = document.createElement('li');
  liName.innerHTML = restaurant.name;
  liName.className = 'breadcrum-name';
  breadcrumb.append(liName);

  var liIcon = document.createElement('li');
  //get fillFavoritesHTML() from main.js
  liIcon.append(_dbhelper2.default.fillFavoritesHTML(restaurant));

  breadcrumb.append(liIcon);
};

/**
 * @get a parameter by name from page URL.
 */
var getParameterByName = function getParameterByName(name, url) {
  if (!url) url = window.location.href;
  name = name.replace(/[[\]]/g, '\\$&');
  var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
      results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
};

/**
 * @get current restaurant from page URL.
 */
var fetchRestaurantFromURL = function fetchRestaurantFromURL(callback) {
  if (self.restaurant) {
    // restaurant already fetched!
    callback(null, self.restaurant);
    return;
  }
  var id = getParameterByName('id');
  if (!id) {
    // no id found in URL
    var error = 'No restaurant id in URL';
    callback(error, null);
  } else {
    _dbhelper2.default.fetchRestaurantById(id, function (error, restaurant) {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.error(error);
        return;
      }
      _dbhelper2.default.fetchRestaurantReviews(self.restaurant, function (error, reviews) {
        self.restaurant.reviews = reviews;

        if (!reviews) {
          console.log(error);
        }
        fillRestaurantHTML(self.restaurant);
      });
      callback(null, restaurant);
    });
  }
};

/**
 * @create restaurant HTML and add it to the webpage
 */
var fillRestaurantHTML = function fillRestaurantHTML(restaurant) {
  var name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;
  name.setAttribute('tabindex', '0');

  var image = document.getElementById('restaurant-img');
  image.src = _dbhelper2.default.imageUrlForRestaurant(restaurant);
  image.alt = restaurant.name + ' is the ' + restaurant.cuisine_type + ' restaurant';
  image.setAttribute('tabindex', '0');

  var cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;
  cuisine.setAttribute('tabindex', '0');

  var address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;
  address.setAttribute('tabindex', '0');

  // fill operating hours
  fillRestaurantHoursHTML(restaurant.operating_hours);

  // fill reviews
  fillReviewsHTML(restaurant.reviews);
};

/**
 * @create restaurant operating hours HTML table and add it to the webpage.
 */
var fillRestaurantHoursHTML = function fillRestaurantHoursHTML(operatingHours) {
  var hours = document.getElementById('restaurant-hours');
  hours.innerHTML = '';
  for (var key in operatingHours) {
    var row = document.createElement('tr');
    row.className = 'table-row';

    var day = document.createElement('td');
    day.innerHTML = key;
    day.className = 'day-col';
    day.setAttribute('tabindex', '0');

    row.append(day);

    var time = document.createElement('td');
    time.innerHTML = operatingHours[key];
    time.className = 'time-col';
    time.setAttribute('tabindex', '0');
    row.append(time);

    hours.append(row);
  }
};

/**
 * @create all reviews HTML and add them to the webpage.
 */
var fillReviewsHTML = function fillReviewsHTML(reviews) {
  var container = document.getElementById('reviews-container');
  container.innerHTML = '';

  var ul = document.createElement('ul');
  ul.id = 'reviews-list';
  container.append(ul);

  var title = document.createElement('h3');
  title.innerHTML = 'Reviews';
  title.setAttribute('tabindex', '0');
  container.append(title);

  if (!reviews) {
    var noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.append(noReviews);
    return;
  }

  var sortedReviews = reviews.sort(function (a, b) {
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  sortedReviews.forEach(function (review) {
    ul.append(createReviewHTML(review));
  });
  container.append(ul);
};

/**
 * @create review HTML and add it to the webpage.
 */
var createReviewHTML = function createReviewHTML(review) {
  var li = document.createElement('li');
  var div = document.createElement('div');
  var name = document.createElement('p');
  name.innerHTML = review.name;
  name.className = 'review-name';
  name.setAttribute('tabindex', '0');

  div.append(name);

  var date = document.createElement('p');
  date.innerHTML = new Date(review.updatedAt).toDateString();
  date.className = 'review-date';
  date.setAttribute('tabindex', '0');

  div.append(date);
  li.append(div);

  var rating = document.createElement('p');

  for (var i = 0; i < review.rating; i++) {
    var icon = document.createElement('i');
    icon.className = 'fas fa-star';
    rating.append(icon);
  }

  li.append(rating);

  var comments = document.createElement('p');
  comments.innerHTML = review.comments;
  comments.setAttribute('tabindex', '0');
  li.append(comments);

  return li;
};

/**
   * @show messages and hide when the button is clicked
   */
var showMessage = function showMessage() {
  var modal = document.getElementById('modal-overlay');
  var modalMessage = document.getElementById('modal-message');

  modalMessage.innerHTML = 'You are offline right now, the review will be sent when you are online later';
  modal.style.display = 'block';

  var button = document.getElementById('bttn-close');
  button.addEventListener('click', function () {
    modal.style.display = 'none';
  });
};

/**
 * @submit the form, send to the server, and show it on a page
 */

var form = document.getElementById('review-form');

form.addEventListener('submit', function (e) {
  e.preventDefault();
  var review = {
    'restaurant_id': self.restaurant.id
  };
  var formData = new FormData(form);
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = formData.entries()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var _ref = _step.value;

      var _ref2 = _slicedToArray(_ref, 2);

      var key = _ref2[0];
      var value = _ref2[1];

      review[key] = value;
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  if (!navigator.onLine) {
    showMessage();
  }
  _dbhelper2.default.createRestaurantReview(review).then(function () {
    form.reset();
    _dbhelper2.default.fetchRestaurantReviews(self.restaurant, function (error, reviews) {
      if (!reviews) {
        console.log(error);
      }
      fillReviewsHTML(reviews);
    });
  }).catch(function (error) {
    return console.error('err', error);
  });
});

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9kYmhlbHBlci5qcyIsImpzL3Jlc3RhdXJhbnRfaW5mby5qcyIsIm5vZGVfbW9kdWxlcy9pZGIvbGliL2lkYi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBOzs7Ozs7OztBQUVBOzs7Ozs7OztBQUVBOzs7O0lBSU0sUTs7Ozs7Ozs7O0FBV0o7OzsyQ0FHOEIsVSxFQUFZLEcsRUFBSztBQUM3QyxlQUFTLGFBQVQ7QUFDQSxlQUFTLFdBQVQ7QUFDQSxVQUFNLFNBQVMsSUFBSSxPQUFPLElBQVAsQ0FBWSxNQUFoQixDQUF1QjtBQUNwQyxrQkFBVSxXQUFXLE1BRGU7QUFFcEMsZUFBTyxXQUFXLElBRmtCO0FBR3BDLGFBQUssU0FBUyxnQkFBVCxDQUEwQixVQUExQixDQUgrQjtBQUlwQyxhQUFLLEdBSitCO0FBS3BDLG1CQUFXLE9BQU8sSUFBUCxDQUFZLFNBQVosQ0FBc0I7QUFMRyxPQUF2QixDQUFmO0FBT0EsYUFBTyxNQUFQO0FBQ0Q7QUFDRDs7Ozs7O29DQUd1QjtBQUNyQixhQUFPLElBQVAsQ0FBWSxLQUFaLENBQWtCLGVBQWxCLENBQWtDLEdBQWxDLEVBQXVDLE1BQXZDLEVBQStDLFlBQU07QUFDbkQsaUJBQVMsb0JBQVQsQ0FBOEIsUUFBOUIsRUFBd0MsQ0FBeEMsRUFBMkMsS0FBM0MsR0FBbUQsYUFBbkQ7QUFDRCxPQUZEO0FBR0Q7O0FBRUQ7Ozs7OzttQ0FHc0I7QUFDcEIsVUFBSSxDQUFDLFVBQVUsYUFBZixFQUE4QjtBQUM1QixlQUFPLFFBQVEsT0FBUixFQUFQO0FBQ0QsT0FGRCxNQUVPO0FBQ0wsZUFBTyxjQUFJLElBQUosQ0FBUyxhQUFULEVBQXdCLENBQXhCLEVBQTJCLFVBQUMsU0FBRCxFQUFlO0FBQy9DLG9CQUFVLGlCQUFWLENBQTRCLGFBQTVCLEVBQTJDLEVBQUUsU0FBUyxJQUFYLEVBQTNDO0FBQ0EsY0FBSSxjQUFjLFVBQVUsaUJBQVYsQ0FBNEIsU0FBNUIsRUFBdUMsRUFBRSxTQUFTLElBQVgsRUFBdkMsQ0FBbEI7QUFDQSxzQkFBWSxXQUFaLENBQXdCLGVBQXhCLEVBQXlDLGVBQXpDLEVBQTBELEVBQUUsUUFBUSxLQUFWLEVBQTFEO0FBQ0Esb0JBQVUsaUJBQVYsQ0FBNEIsaUJBQTVCLEVBQStDLEVBQUUsU0FBUyxXQUFYLEVBQS9DO0FBQ0QsU0FMTSxDQUFQO0FBTUQ7QUFDRjtBQUNEOzs7Ozs7dUNBRzBCLFUsRUFBWTtBQUNwQyxVQUFJLFlBQVksU0FBUyxZQUFULEVBQWhCOztBQUVBLGFBQU8sVUFBVSxJQUFWLENBQWUsVUFBUyxFQUFULEVBQWE7QUFDakMsWUFBRyxDQUFDLEVBQUosRUFBUTtBQUNSLFlBQUksS0FBSyxHQUFHLFdBQUgsQ0FBZSxVQUFmLENBQVQ7QUFDQSxZQUFJLFFBQVEsR0FBRyxXQUFILENBQWUsVUFBZixDQUFaO0FBQ0EsZUFBTyxNQUFNLE1BQU4sRUFBUDtBQUNELE9BTE0sQ0FBUDtBQU1EOztBQUVEOzs7Ozs7O3VDQUkwQixLLEVBQU8sVSxFQUFZO0FBQzNDLFVBQUksWUFBWSxTQUFTLFlBQVQsRUFBaEI7O0FBRUEsZ0JBQVUsSUFBVixDQUFlLGNBQU07QUFDbkIsWUFBSSxDQUFDLEVBQUwsRUFBUztBQUNULFlBQU0sS0FBSyxHQUFHLFdBQUgsQ0FBZSxVQUFmLEVBQTJCLFdBQTNCLENBQVg7QUFDQSxZQUFNLFFBQVEsR0FBRyxXQUFILENBQWUsVUFBZixDQUFkOztBQUVBLGNBQU0sT0FBTixDQUFjLGdCQUFRO0FBQ3BCLGdCQUFNLEdBQU4sQ0FBVSxJQUFWO0FBQ0QsU0FGRDtBQUdBLGVBQU8sR0FBRyxRQUFWO0FBQ0QsT0FURDtBQVVEO0FBQ0Q7Ozs7OztxQ0FHd0IsUSxFQUFVO0FBQ2hDO0FBQ0EsZUFBUyxrQkFBVCxDQUE0QixhQUE1QixFQUEyQyxJQUEzQyxDQUFnRCxtQkFBVztBQUN6RCxZQUFJLFdBQVcsUUFBUSxNQUFSLEdBQWlCLENBQWhDLEVBQW1DO0FBQ2pDLG1CQUFTLElBQVQsRUFBZSxPQUFmO0FBQ0QsU0FGRCxNQUVPO0FBQ0w7QUFDQTtBQUNBO0FBQ0EsZ0JBQVMsU0FBUyxZQUFsQixtQkFDRyxJQURILENBQ1E7QUFBQSxtQkFBWSxTQUFTLElBQVQsRUFBWjtBQUFBLFdBRFIsRUFFRyxJQUZILENBRVEsdUJBQWU7QUFDbkI7QUFDQSxxQkFBUyxrQkFBVCxDQUE0QixXQUE1QixFQUF5QyxhQUF6QztBQUNBLG1CQUFPLFNBQVMsSUFBVCxFQUFlLFdBQWYsQ0FBUDtBQUNELFdBTkgsRUFPRyxLQVBILENBT1MsZUFBTztBQUNaLG1CQUFPLFNBQVMsR0FBVCxFQUFlLElBQWYsQ0FBUDtBQUNELFdBVEg7QUFVRDtBQUNGLE9BbEJEO0FBbUJEO0FBQ0Q7Ozs7OzsyQ0FHOEIsVSxFQUFZLFEsRUFBVTtBQUNsRCxVQUFJLFlBQVksU0FBUyxZQUFULEVBQWhCOztBQUVBLGdCQUFVLElBQVYsQ0FBZSxjQUFNO0FBQ25CLFlBQUksQ0FBQyxFQUFMLEVBQVM7O0FBRVQsWUFBTSxLQUFLLEdBQUcsV0FBSCxDQUFlLFNBQWYsQ0FBWDtBQUNBLFlBQU0sUUFBUSxHQUFHLFdBQUgsQ0FBZSxTQUFmLENBQWQ7QUFDQSxZQUFNLFFBQVEsTUFBTSxLQUFOLENBQVksZUFBWixDQUFkOztBQUVBLGNBQU0sTUFBTixDQUFhLFdBQVcsRUFBeEIsRUFBNEIsSUFBNUIsQ0FBaUMsbUJBQVc7QUFDMUMsbUJBQVMsSUFBVCxFQUFlLE9BQWY7O0FBRUEsY0FBSSxDQUFDLFVBQVUsTUFBZixFQUF1QjtBQUNyQjtBQUNEOztBQUVELGdCQUFTLFNBQVMsWUFBbEIsZ0NBQXlELFdBQVcsRUFBcEUsRUFDRyxJQURILENBQ1Esb0JBQVk7QUFDaEIsbUJBQU8sU0FBUyxJQUFULEVBQVA7QUFDRCxXQUhILEVBSUcsSUFKSCxDQUlRLG1CQUFXO0FBQ2Y7QUFDQSxnQkFBSSxhQUFhLFFBQVEsTUFBekI7QUFDQSxnQkFBSSxjQUFjLEVBQWxCLEVBQXNCO0FBQ3BCLG1CQUFLLElBQUksSUFBSSxDQUFiLEVBQWdCLElBQUksYUFBYSxFQUFqQyxFQUFxQyxHQUFyQyxFQUEwQztBQUN4Qyx5QkFBUyx1QkFBVCxDQUFpQyxRQUFRLENBQVIsRUFBVyxFQUE1QztBQUNEO0FBQ0Y7QUFDRCxxQkFBUyxrQkFBVCxDQUE0QixPQUE1QixFQUFxQyxTQUFyQztBQUNBLHFCQUFTLElBQVQsRUFBZSxPQUFmO0FBQ0QsV0FkSCxFQWVHLEtBZkgsQ0FlUyxlQUFPO0FBQ1oscUJBQVMsR0FBVCxFQUFlLElBQWY7QUFDRCxXQWpCSDtBQWtCRCxTQXpCRDtBQTBCRCxPQWpDRDtBQWtDRDs7QUFFRDs7Ozs7O3dDQUcyQixFLEVBQUksUSxFQUFVO0FBQ3ZDO0FBQ0EsZUFBUyxnQkFBVCxDQUEwQixVQUFDLEtBQUQsRUFBUSxXQUFSLEVBQXdCO0FBQ2hELFlBQUksS0FBSixFQUFXO0FBQ1QsbUJBQVMsS0FBVCxFQUFnQixJQUFoQjtBQUNELFNBRkQsTUFFTztBQUNMLGNBQU0sYUFBYSxZQUFZLElBQVosQ0FBaUI7QUFBQSxtQkFBSyxFQUFFLEVBQUYsSUFBUSxFQUFiO0FBQUEsV0FBakIsQ0FBbkI7QUFDQSxjQUFJLFVBQUosRUFBZ0I7QUFBRTtBQUNoQixxQkFBUyxJQUFULEVBQWUsVUFBZjtBQUNELFdBRkQsTUFFTztBQUFFO0FBQ1AscUJBQVMsMkJBQVQsRUFBc0MsSUFBdEM7QUFDRDtBQUNGO0FBQ0YsT0FYRDtBQVlEOztBQUVEOzs7Ozs7NkNBR2dDLE8sRUFBUyxRLEVBQVU7QUFDakQ7QUFDQSxlQUFTLGdCQUFULENBQTBCLFVBQUMsS0FBRCxFQUFRLFdBQVIsRUFBd0I7QUFDaEQsWUFBSSxLQUFKLEVBQVc7QUFDVCxtQkFBUyxLQUFULEVBQWdCLElBQWhCO0FBQ0QsU0FGRCxNQUVPO0FBQ0w7QUFDQSxjQUFNLFVBQVUsWUFBWSxNQUFaLENBQW1CO0FBQUEsbUJBQUssRUFBRSxZQUFGLElBQWtCLE9BQXZCO0FBQUEsV0FBbkIsQ0FBaEI7QUFDQSxtQkFBUyxJQUFULEVBQWUsT0FBZjtBQUNEO0FBQ0YsT0FSRDtBQVNEOztBQUVEOzs7Ozs7a0RBR3FDLFksRUFBYyxRLEVBQVU7QUFDM0Q7QUFDQSxlQUFTLGdCQUFULENBQTBCLFVBQUMsS0FBRCxFQUFRLFdBQVIsRUFBd0I7QUFDaEQsWUFBSSxLQUFKLEVBQVc7QUFDVCxtQkFBUyxLQUFULEVBQWdCLElBQWhCO0FBQ0QsU0FGRCxNQUVPO0FBQ0w7QUFDQSxjQUFNLFVBQVUsWUFBWSxNQUFaLENBQW1CO0FBQUEsbUJBQUssRUFBRSxZQUFGLElBQWtCLFlBQXZCO0FBQUEsV0FBbkIsQ0FBaEI7QUFDQSxtQkFBUyxJQUFULEVBQWUsT0FBZjtBQUNEO0FBQ0YsT0FSRDtBQVNEOztBQUVEOzs7Ozs7NERBRytDLE8sRUFBUyxZLEVBQWMsUSxFQUFVO0FBQzlFO0FBQ0EsZUFBUyxnQkFBVCxDQUEwQixVQUFDLEtBQUQsRUFBUSxXQUFSLEVBQXdCO0FBQ2hELFlBQUksS0FBSixFQUFXO0FBQ1QsbUJBQVMsS0FBVCxFQUFnQixJQUFoQjtBQUNELFNBRkQsTUFFTztBQUNMLGNBQUksVUFBVSxXQUFkO0FBQ0EsY0FBSSxXQUFXLEtBQWYsRUFBc0I7QUFBRTtBQUN0QixzQkFBVSxRQUFRLE1BQVIsQ0FBZTtBQUFBLHFCQUFLLEVBQUUsWUFBRixJQUFrQixPQUF2QjtBQUFBLGFBQWYsQ0FBVjtBQUNEO0FBQ0QsY0FBSSxnQkFBZ0IsS0FBcEIsRUFBMkI7QUFBRTtBQUMzQixzQkFBVSxRQUFRLE1BQVIsQ0FBZTtBQUFBLHFCQUFLLEVBQUUsWUFBRixJQUFrQixZQUF2QjtBQUFBLGFBQWYsQ0FBVjtBQUNEO0FBQ0QsbUJBQVMsSUFBVCxFQUFlLE9BQWY7QUFDRDtBQUNGLE9BYkQ7QUFjRDs7O29FQUVzRCxPLEVBQVMsWSxFQUFjLFEsRUFBVSxRLEVBQVU7QUFDaEc7QUFDQSxlQUFTLGdCQUFULENBQTBCLFVBQUMsS0FBRCxFQUFRLFdBQVIsRUFBd0I7QUFDaEQsWUFBSSxLQUFKLEVBQVc7QUFDVCxtQkFBUyxLQUFULEVBQWdCLElBQWhCO0FBQ0QsU0FGRCxNQUVPO0FBQ0wsY0FBSSxVQUFVLFdBQWQ7QUFDQSxjQUFJLFdBQVcsS0FBZixFQUFzQjtBQUFFO0FBQ3RCLHNCQUFVLFFBQVEsTUFBUixDQUFlO0FBQUEscUJBQUssRUFBRSxZQUFGLElBQWtCLE9BQXZCO0FBQUEsYUFBZixDQUFWO0FBQ0Q7QUFDRCxjQUFJLGdCQUFnQixLQUFwQixFQUEyQjtBQUFFO0FBQzNCLHNCQUFVLFFBQVEsTUFBUixDQUFlO0FBQUEscUJBQUssRUFBRSxZQUFGLElBQWtCLFlBQXZCO0FBQUEsYUFBZixDQUFWO0FBQ0Q7QUFDRCxjQUFJLFlBQVksTUFBaEIsRUFBd0I7QUFDdEIsc0JBQVUsUUFBUSxNQUFSLENBQWU7QUFBQSxxQkFBSyxFQUFFLFdBQUYsSUFBaUIsTUFBdEI7QUFBQSxhQUFmLENBQVY7QUFDRDtBQUNELG1CQUFTLElBQVQsRUFBZSxPQUFmO0FBQ0Q7QUFDRixPQWhCRDtBQWlCRDs7QUFFRDs7Ozs7O3VDQUcwQixRLEVBQVU7QUFDbEM7QUFDQSxlQUFTLGdCQUFULENBQTBCLFVBQUMsS0FBRCxFQUFRLFdBQVIsRUFBd0I7QUFDaEQsWUFBSSxLQUFKLEVBQVc7QUFDVCxtQkFBUyxLQUFULEVBQWdCLElBQWhCO0FBQ0QsU0FGRCxNQUVPO0FBQ0w7QUFDQSxjQUFNLGdCQUFnQixZQUFZLEdBQVosQ0FBZ0IsVUFBQyxDQUFELEVBQUksQ0FBSjtBQUFBLG1CQUFVLFlBQVksQ0FBWixFQUFlLFlBQXpCO0FBQUEsV0FBaEIsQ0FBdEI7QUFDQTtBQUNBLGNBQU0sc0JBQXNCLGNBQWMsTUFBZCxDQUFxQixVQUFDLENBQUQsRUFBSSxDQUFKO0FBQUEsbUJBQVUsY0FBYyxPQUFkLENBQXNCLENBQXRCLEtBQTRCLENBQXRDO0FBQUEsV0FBckIsQ0FBNUI7QUFDQSxtQkFBUyxJQUFULEVBQWUsbUJBQWY7QUFDRDtBQUNGLE9BVkQ7QUFXRDs7QUFFRDs7Ozs7O2tDQUdxQixRLEVBQVU7QUFDN0I7QUFDQSxlQUFTLGdCQUFULENBQTBCLFVBQUMsS0FBRCxFQUFRLFdBQVIsRUFBd0I7QUFDaEQsWUFBSSxLQUFKLEVBQVc7QUFDVCxtQkFBUyxLQUFULEVBQWdCLElBQWhCO0FBQ0QsU0FGRCxNQUVPO0FBQ0w7QUFDQSxjQUFNLFdBQVcsWUFBWSxHQUFaLENBQWdCLFVBQUMsQ0FBRCxFQUFJLENBQUo7QUFBQSxtQkFBVSxZQUFZLENBQVosRUFBZSxZQUF6QjtBQUFBLFdBQWhCLENBQWpCO0FBQ0E7QUFDQSxjQUFNLGlCQUFpQixTQUFTLE1BQVQsQ0FBZ0IsVUFBQyxDQUFELEVBQUksQ0FBSjtBQUFBLG1CQUFVLFNBQVMsT0FBVCxDQUFpQixDQUFqQixLQUF1QixDQUFqQztBQUFBLFdBQWhCLENBQXZCO0FBQ0EsbUJBQVMsSUFBVCxFQUFlLGNBQWY7QUFDRDtBQUNGLE9BVkQ7QUFXRDs7QUFFRDs7Ozs7O3FDQUd3QixVLEVBQVk7QUFDbEMsdUNBQWdDLFdBQVcsRUFBM0M7QUFDRDs7QUFFRDs7Ozs7OzBDQUc2QixVLEVBQVk7QUFDdkMsVUFBSSxXQUFXLFVBQVgsS0FBMEIsU0FBOUIsRUFBeUM7QUFDdkMsbUJBQVcsVUFBWCxHQUF3QixFQUF4QjtBQUNEO0FBQ0Qsc0JBQWUsV0FBVyxVQUExQjtBQUNEOzs7NENBRThCLFMsRUFBVztBQUN4QyxZQUFTLFNBQVMsWUFBbEIsaUJBQTBDLFNBQTFDLEVBQXVEO0FBQ3JELGdCQUFRO0FBRDZDLE9BQXZELEVBR0csSUFISCxDQUdRLG9CQUFZO0FBQ2hCLGVBQU8sUUFBUDtBQUNELE9BTEgsRUFNRyxJQU5ILENBTVEsZ0JBQVE7QUFDWixlQUFPLElBQVA7QUFDRCxPQVJILEVBU0csS0FUSCxDQVNTLGVBQU87QUFDWixnQkFBUSxHQUFSLENBQVksT0FBWixFQUFxQixHQUFyQjtBQUNELE9BWEg7QUFZRDs7QUFFRDs7Ozs7Ozs7OzJDQU04QixXLEVBQWE7QUFDekMsYUFBTyxNQUFTLFNBQVMsWUFBbEIsZUFBMEM7QUFDL0MsZ0JBQVEsTUFEdUM7QUFFL0MsZUFBTyxVQUZ3QyxFQUU1QjtBQUNuQixxQkFBYSxhQUhrQztBQUkvQyxjQUFNLEtBQUssU0FBTCxDQUFlLFdBQWYsQ0FKeUM7QUFLL0MsaUJBQVM7QUFDUCwwQkFBZ0I7QUFEVCxTQUxzQztBQVEvQyxjQUFNLE1BUnlDO0FBUy9DLGtCQUFVLFFBVHFDO0FBVS9DLGtCQUFVO0FBVnFDLE9BQTFDLEVBWUosSUFaSSxDQVlDLG9CQUFZO0FBQ2hCLGlCQUFTLElBQVQsR0FDRyxJQURILENBQ1EsdUJBQWU7QUFDckI7QUFDRSxtQkFBUyxrQkFBVCxDQUE0QixDQUFDLFdBQUQsQ0FBNUIsRUFBMkMsU0FBM0M7QUFDQSxpQkFBTyxXQUFQO0FBQ0QsU0FMSDtBQU1ELE9BbkJJLEVBb0JKLEtBcEJJLENBb0JFLGlCQUFTO0FBQ2Qsb0JBQVksV0FBWixJQUEyQixJQUFJLElBQUosR0FBVyxPQUFYLEVBQTNCO0FBQ0E7QUFDQSxpQkFBUyxrQkFBVCxDQUE0QixDQUFDLFdBQUQsQ0FBNUIsRUFBMkMsaUJBQTNDO0FBQ0EsZ0JBQVEsR0FBUixDQUFZLDhCQUFaO0FBQ0E7QUFDRCxPQTFCSSxDQUFQO0FBMkJEOztBQUVEOzs7Ozs7MENBRzZCO0FBQzNCLFVBQUksWUFBWSxTQUFTLFlBQVQsRUFBaEI7QUFDQSxnQkFBVSxJQUFWLENBQWUsY0FBTTtBQUNuQixZQUFNLEtBQUssR0FBRyxXQUFILENBQWUsaUJBQWYsRUFBa0MsV0FBbEMsQ0FBWDtBQUNBLFlBQU0sUUFBUSxHQUFHLFdBQUgsQ0FBZSxpQkFBZixDQUFkO0FBQ0EsY0FBTSxLQUFOO0FBQ0QsT0FKRDtBQUtBO0FBQ0Q7O0FBRUQ7Ozs7OzswQ0FHNkI7QUFDM0IsZUFBUyxZQUFULEdBQXdCLElBQXhCLENBQTZCLGNBQU07QUFDakMsWUFBSSxDQUFDLEVBQUwsRUFBUztBQUNULFlBQU0sS0FBSyxHQUFHLFdBQUgsQ0FBZSxpQkFBZixFQUFrQyxXQUFsQyxDQUFYO0FBQ0EsWUFBTSxRQUFRLEdBQUcsV0FBSCxDQUFlLGlCQUFmLENBQWQ7O0FBRUEsY0FBTSxNQUFOLEdBQWUsSUFBZixDQUFvQiwwQkFBa0I7QUFDcEMseUJBQWUsT0FBZixDQUF1QixrQkFBVTtBQUMvQixxQkFBUyxzQkFBVCxDQUFnQyxNQUFoQztBQUNELFdBRkQ7QUFHQSxtQkFBUyxtQkFBVDtBQUNELFNBTEQ7QUFNRCxPQVhEO0FBWUQ7QUFDRDs7Ozs7OzttQ0FJc0IsVSxFQUFZLFUsRUFBWTtBQUM1QyxhQUFPLE1BQVMsU0FBUyxZQUFsQixxQkFBOEMsV0FBVyxFQUF6RCxzQkFBNEUsVUFBNUUsRUFBMEY7QUFDL0YsZ0JBQVE7QUFEdUYsT0FBMUYsRUFHSixJQUhJLENBR0Msb0JBQVk7QUFDaEIsZ0JBQVEsR0FBUiw4QkFBdUMsV0FBVyxFQUFsRCxvQkFBbUUsVUFBbkU7QUFDQSxlQUFPLFNBQVMsSUFBVCxFQUFQO0FBQ0QsT0FOSSxFQU9KLElBUEksQ0FPQyxnQkFBUTtBQUNaLGlCQUFTLGtCQUFULENBQTRCLENBQUMsSUFBRCxDQUE1QixFQUFvQyxhQUFwQztBQUNBLGdCQUFRLEdBQVIsOEJBQXVDLFdBQVcsRUFBbEQsb0JBQW1FLFVBQW5FO0FBQ0EsZUFBTyxJQUFQO0FBQ0QsT0FYSSxFQVlKLEtBWkksQ0FZRSxpQkFBUztBQUNkO0FBQ0EsbUJBQVcsV0FBWCxHQUF5QixhQUFhLE1BQWIsR0FBc0IsT0FBL0M7O0FBRUEsaUJBQVMsa0JBQVQsQ0FBNEIsQ0FBQyxVQUFELENBQTVCLEVBQTBDLGFBQTFDO0FBQ0EsZ0JBQVEsR0FBUixDQUFZLHdCQUFaO0FBQ0E7QUFDRCxPQW5CSSxDQUFQO0FBb0JEOztBQUVEOzs7Ozs7c0NBR3lCLFUsRUFBWTtBQUNuQyxVQUFNLFFBQVEsU0FBUyxhQUFULENBQXVCLE9BQXZCLENBQWQ7QUFDQSxZQUFNLFlBQU4sQ0FBbUIsWUFBbkIsRUFBaUMsNkJBQWpDO0FBQ0EsWUFBTSxTQUFOLEdBQWtCLGVBQWxCOztBQUVBLFVBQU0sT0FBTyxTQUFTLGFBQVQsQ0FBdUIsR0FBdkIsQ0FBYjtBQUNBLFdBQUssU0FBTCxHQUFpQixjQUFqQjtBQUNBLFlBQU0sTUFBTixDQUFhLElBQWI7O0FBRUEsVUFBTSxRQUFRLFNBQVMsYUFBVCxDQUF1QixPQUF2QixDQUFkO0FBQ0EsWUFBTSxJQUFOLEdBQWEsVUFBYjtBQUNBLFlBQU0sWUFBTixDQUFtQixZQUFuQixFQUFpQyxpQkFBakM7O0FBRUEsVUFBSSxXQUFXLFdBQVgsSUFBMEIsTUFBOUIsRUFBc0M7QUFDcEMsYUFBSyxLQUFMLENBQVcsS0FBWCxHQUFtQixTQUFuQjtBQUNELE9BRkQsTUFFTztBQUNMLGFBQUssS0FBTCxDQUFXLEtBQVgsR0FBbUIsU0FBbkI7QUFDRDs7QUFFRCxZQUFNLE9BQU4sR0FBaUIsV0FBVyxXQUFYLElBQTJCLE1BQTVDO0FBQ0EsWUFBTSxnQkFBTixDQUF1QixRQUF2QixFQUFpQyxpQkFBUztBQUN4QyxjQUFNLGNBQU47QUFDQSxZQUFJLE1BQU0sT0FBTixJQUFpQixJQUFyQixFQUEyQjtBQUN6QixtQkFBUyxjQUFULENBQXdCLFVBQXhCLEVBQW9DLE1BQU0sT0FBMUM7QUFDQSxlQUFLLEtBQUwsQ0FBVyxLQUFYLEdBQW1CLFNBQW5CO0FBQ0QsU0FIRCxNQUdPO0FBQ0wsbUJBQVMsY0FBVCxDQUF3QixVQUF4QixFQUFvQyxNQUFNLE9BQTFDO0FBQ0EsZUFBSyxLQUFMLENBQVcsS0FBWCxHQUFtQixTQUFuQjtBQUNEO0FBQ0YsT0FURDtBQVVBLFlBQU0sTUFBTixDQUFhLEtBQWI7QUFDQSxhQUFPLEtBQVA7QUFDRDs7QUFFRDs7Ozs7OztpQ0FJb0I7QUFDbEIsY0FBUSxHQUFSLENBQVksY0FBWjtBQUNBLGVBQVMsbUJBQVQ7QUFDRDs7O2tDQUVvQjtBQUNuQixjQUFRLEdBQVIsQ0FBWSxlQUFaO0FBQ0Q7Ozs7QUFsY0Q7Ozs7d0JBSTBCO0FBQ3hCO0FBQ0E7QUFDQSxhQUFPLDhDQUFQO0FBQ0Q7Ozs7OztBQTZiSCxPQUFPLGdCQUFQLENBQXdCLFFBQXhCLEVBQWtDLFNBQVMsVUFBM0M7QUFDQSxPQUFPLGdCQUFQLENBQXdCLFNBQXhCLEVBQW1DLFNBQVMsV0FBNUM7O0FBRUE7OztBQUdBLFVBQVUsYUFBVixDQUF3QixRQUF4QixDQUFpQyxTQUFqQyxFQUNHLElBREgsQ0FDUSxVQUFTLEdBQVQsRUFBYztBQUNwQjtBQUNFLFVBQVEsR0FBUixDQUFZLG9EQUFaLEVBQWtFLElBQUksS0FBdEU7QUFDQSxNQUFJLENBQUMsVUFBVSxhQUFWLENBQXdCLFVBQTdCLEVBQXlDO0FBQ3ZDO0FBQ0Q7QUFDRCxNQUFJLElBQUksT0FBUixFQUFpQjtBQUNmLGlCQUFhLElBQUksT0FBakI7QUFDQTtBQUNEO0FBQ0QsTUFBSSxJQUFJLFVBQVIsRUFBb0I7QUFDbEIscUJBQWlCLElBQUksVUFBckI7QUFDQTtBQUNEOztBQUVELE1BQUksZ0JBQUosQ0FBcUIsYUFBckIsRUFBb0MsWUFBWTtBQUM5QyxxQkFBaUIsSUFBSSxVQUFyQjtBQUNELEdBRkQ7O0FBSUEsTUFBSSxVQUFKO0FBQ0EsWUFBVSxhQUFWLENBQXdCLGdCQUF4QixDQUF5QyxrQkFBekMsRUFBNkQsWUFBWTtBQUN2RSxRQUFJLFVBQUosRUFBZ0I7QUFDaEIsaUJBQWEsSUFBYjtBQUNELEdBSEQ7QUFJRCxDQXpCSCxFQTBCRyxLQTFCSCxDQTBCUyxZQUFZO0FBQ2pCLFVBQVEsR0FBUixDQUFZLG9DQUFaO0FBQ0QsQ0E1Qkg7O0FBOEJBLElBQUksZUFBZSxTQUFmLFlBQWUsQ0FBQyxNQUFELEVBQVk7QUFDN0IsU0FBTyxXQUFQLENBQW1CLEVBQUMsUUFBUSxhQUFULEVBQW5CO0FBQ0QsQ0FGRDs7QUFJQSxJQUFLLG1CQUFtQixTQUFuQixnQkFBbUIsQ0FBQyxNQUFELEVBQVk7QUFDbEMsTUFBSSwyQkFBSjtBQUNBLFNBQU8sZ0JBQVAsQ0FBd0IsYUFBeEIsRUFBdUMsWUFBVztBQUNoRCxRQUFJLE9BQU8sS0FBUCxJQUFnQixXQUFwQixFQUFpQztBQUMvQixzQkFBZ0IsWUFBaEIsQ0FBNkIsTUFBN0I7QUFDRDtBQUNGLEdBSkQ7QUFLRCxDQVBEOztrQkFTZSxROzs7QUMvZmY7Ozs7QUFFQTs7Ozs7O0FBRUE7Ozs7QUFJQSxTQUFTLGdCQUFULENBQTBCLGtCQUExQixFQUE4QyxZQUFNO0FBQ2xEO0FBQ0QsQ0FGRDs7QUFJQSxJQUFJLFVBQVUsU0FBVixPQUFVLEdBQU07QUFDbEIseUJBQXVCLFVBQUMsS0FBRCxFQUFRLFVBQVIsRUFBdUI7QUFDNUMsUUFBSSxLQUFKLEVBQVc7QUFBRTtBQUNYLGNBQVEsS0FBUixDQUFjLEtBQWQ7QUFDRCxLQUZELE1BRU87QUFDTCxVQUFJLE9BQU8sTUFBUCxLQUFrQixXQUF0QixFQUFtQztBQUNqQyxhQUFLLEdBQUwsR0FBVyxJQUFJLE9BQU8sSUFBUCxDQUFZLEdBQWhCLENBQW9CLFNBQVMsY0FBVCxDQUF3QixLQUF4QixDQUFwQixFQUFvRDtBQUM3RCxnQkFBTSxFQUR1RDtBQUU3RCxrQkFBUSxXQUFXLE1BRjBDO0FBRzdELHVCQUFhO0FBSGdELFNBQXBELENBQVg7QUFLQSx1QkFBZSxLQUFLLFVBQXBCO0FBQ0EsMkJBQVMsc0JBQVQsQ0FBZ0MsS0FBSyxVQUFyQyxFQUFpRCxLQUFLLEdBQXREO0FBQ0Q7QUFDRjtBQUNGLEdBZEQ7QUFlRCxDQWhCRDs7QUFrQkEsT0FBTyxjQUFQLEdBQXdCLFlBQU07QUFDNUIsTUFBTSxVQUFVLFNBQVMsY0FBVCxDQUF3QixlQUF4QixDQUFoQjtBQUNBLFVBQVEsU0FBUixHQUFvQiw2REFBcEI7QUFDRCxDQUhEOztBQUtBOzs7QUFHQSxJQUFJLGlCQUFpQixTQUFqQixjQUFpQixDQUFDLFVBQUQsRUFBZ0I7QUFDbkMsTUFBTSxhQUFhLFNBQVMsY0FBVCxDQUF3QixZQUF4QixDQUFuQjs7QUFFQSxNQUFNLFNBQVMsU0FBUyxhQUFULENBQXVCLElBQXZCLENBQWY7QUFDQSxTQUFPLFNBQVAsR0FBbUIsV0FBVyxJQUE5QjtBQUNBLFNBQU8sU0FBUCxHQUFtQixnQkFBbkI7QUFDQSxhQUFXLE1BQVgsQ0FBa0IsTUFBbEI7O0FBRUEsTUFBTSxTQUFTLFNBQVMsYUFBVCxDQUF1QixJQUF2QixDQUFmO0FBQ0E7QUFDQSxTQUFPLE1BQVAsQ0FBYyxtQkFBUyxpQkFBVCxDQUEyQixVQUEzQixDQUFkOztBQUVBLGFBQVcsTUFBWCxDQUFrQixNQUFsQjtBQUNELENBYkQ7O0FBZUE7OztBQUdBLElBQUkscUJBQXFCLFNBQXJCLGtCQUFxQixDQUFDLElBQUQsRUFBTyxHQUFQLEVBQWU7QUFDdEMsTUFBSSxDQUFDLEdBQUwsRUFDRSxNQUFNLE9BQU8sUUFBUCxDQUFnQixJQUF0QjtBQUNGLFNBQU8sS0FBSyxPQUFMLENBQWEsUUFBYixFQUF1QixNQUF2QixDQUFQO0FBQ0EsTUFBTSxRQUFRLElBQUksTUFBSixVQUFrQixJQUFsQix1QkFBZDtBQUFBLE1BQ0UsVUFBVSxNQUFNLElBQU4sQ0FBVyxHQUFYLENBRFo7QUFFQSxNQUFJLENBQUMsT0FBTCxFQUNFLE9BQU8sSUFBUDtBQUNGLE1BQUksQ0FBQyxRQUFRLENBQVIsQ0FBTCxFQUNFLE9BQU8sRUFBUDtBQUNGLFNBQU8sbUJBQW1CLFFBQVEsQ0FBUixFQUFXLE9BQVgsQ0FBbUIsS0FBbkIsRUFBMEIsR0FBMUIsQ0FBbkIsQ0FBUDtBQUNELENBWEQ7O0FBYUE7OztBQUdBLElBQUkseUJBQXlCLFNBQXpCLHNCQUF5QixDQUFDLFFBQUQsRUFBYztBQUN6QyxNQUFJLEtBQUssVUFBVCxFQUFxQjtBQUFFO0FBQ3JCLGFBQVMsSUFBVCxFQUFlLEtBQUssVUFBcEI7QUFDQTtBQUNEO0FBQ0QsTUFBTSxLQUFLLG1CQUFtQixJQUFuQixDQUFYO0FBQ0EsTUFBSSxDQUFDLEVBQUwsRUFBUztBQUFFO0FBQ1QsUUFBTSxRQUFRLHlCQUFkO0FBQ0EsYUFBUyxLQUFULEVBQWdCLElBQWhCO0FBQ0QsR0FIRCxNQUdPO0FBQ0wsdUJBQVMsbUJBQVQsQ0FBNkIsRUFBN0IsRUFBaUMsVUFBQyxLQUFELEVBQVEsVUFBUixFQUF1QjtBQUN0RCxXQUFLLFVBQUwsR0FBa0IsVUFBbEI7QUFDQSxVQUFJLENBQUMsVUFBTCxFQUFpQjtBQUNmLGdCQUFRLEtBQVIsQ0FBYyxLQUFkO0FBQ0E7QUFDRDtBQUNELHlCQUFTLHNCQUFULENBQWdDLEtBQUssVUFBckMsRUFBaUQsVUFBQyxLQUFELEVBQVEsT0FBUixFQUFvQjtBQUNuRSxhQUFLLFVBQUwsQ0FBZ0IsT0FBaEIsR0FBMEIsT0FBMUI7O0FBRUEsWUFBSSxDQUFDLE9BQUwsRUFBYztBQUNaLGtCQUFRLEdBQVIsQ0FBWSxLQUFaO0FBQ0Q7QUFDRCwyQkFBbUIsS0FBSyxVQUF4QjtBQUNELE9BUEQ7QUFRQSxlQUFTLElBQVQsRUFBZSxVQUFmO0FBQ0QsS0FmRDtBQWdCRDtBQUNGLENBM0JEOztBQTZCQTs7O0FBR0EsSUFBSSxxQkFBcUIsU0FBckIsa0JBQXFCLENBQUMsVUFBRCxFQUFnQjtBQUN2QyxNQUFNLE9BQU8sU0FBUyxjQUFULENBQXdCLGlCQUF4QixDQUFiO0FBQ0EsT0FBSyxTQUFMLEdBQWlCLFdBQVcsSUFBNUI7QUFDQSxPQUFLLFlBQUwsQ0FBa0IsVUFBbEIsRUFBOEIsR0FBOUI7O0FBRUEsTUFBTSxRQUFRLFNBQVMsY0FBVCxDQUF3QixnQkFBeEIsQ0FBZDtBQUNBLFFBQU0sR0FBTixHQUFZLG1CQUFTLHFCQUFULENBQStCLFVBQS9CLENBQVo7QUFDQSxRQUFNLEdBQU4sR0FBZSxXQUFXLElBQTFCLGdCQUF5QyxXQUFXLFlBQXBEO0FBQ0EsUUFBTSxZQUFOLENBQW1CLFVBQW5CLEVBQStCLEdBQS9COztBQUVBLE1BQU0sVUFBVSxTQUFTLGNBQVQsQ0FBd0Isb0JBQXhCLENBQWhCO0FBQ0EsVUFBUSxTQUFSLEdBQW9CLFdBQVcsWUFBL0I7QUFDQSxVQUFRLFlBQVIsQ0FBcUIsVUFBckIsRUFBaUMsR0FBakM7O0FBRUEsTUFBTSxVQUFVLFNBQVMsY0FBVCxDQUF3QixvQkFBeEIsQ0FBaEI7QUFDQSxVQUFRLFNBQVIsR0FBb0IsV0FBVyxPQUEvQjtBQUNBLFVBQVEsWUFBUixDQUFxQixVQUFyQixFQUFpQyxHQUFqQzs7QUFFQTtBQUNBLDBCQUF3QixXQUFXLGVBQW5DOztBQUVBO0FBQ0Esa0JBQWdCLFdBQVcsT0FBM0I7QUFDRCxDQXZCRDs7QUF5QkE7OztBQUdBLElBQUksMEJBQTBCLFNBQTFCLHVCQUEwQixDQUFDLGNBQUQsRUFBb0I7QUFDaEQsTUFBTSxRQUFRLFNBQVMsY0FBVCxDQUF3QixrQkFBeEIsQ0FBZDtBQUNBLFFBQU0sU0FBTixHQUFrQixFQUFsQjtBQUNBLE9BQUssSUFBSSxHQUFULElBQWdCLGNBQWhCLEVBQWdDO0FBQzlCLFFBQU0sTUFBTSxTQUFTLGFBQVQsQ0FBdUIsSUFBdkIsQ0FBWjtBQUNBLFFBQUksU0FBSixHQUFnQixXQUFoQjs7QUFFQSxRQUFNLE1BQU0sU0FBUyxhQUFULENBQXVCLElBQXZCLENBQVo7QUFDQSxRQUFJLFNBQUosR0FBZ0IsR0FBaEI7QUFDQSxRQUFJLFNBQUosR0FBZ0IsU0FBaEI7QUFDQSxRQUFJLFlBQUosQ0FBaUIsVUFBakIsRUFBNkIsR0FBN0I7O0FBRUEsUUFBSSxNQUFKLENBQVcsR0FBWDs7QUFFQSxRQUFNLE9BQU8sU0FBUyxhQUFULENBQXVCLElBQXZCLENBQWI7QUFDQSxTQUFLLFNBQUwsR0FBaUIsZUFBZSxHQUFmLENBQWpCO0FBQ0EsU0FBSyxTQUFMLEdBQWlCLFVBQWpCO0FBQ0EsU0FBSyxZQUFMLENBQWtCLFVBQWxCLEVBQThCLEdBQTlCO0FBQ0EsUUFBSSxNQUFKLENBQVcsSUFBWDs7QUFFQSxVQUFNLE1BQU4sQ0FBYSxHQUFiO0FBQ0Q7QUFDRixDQXRCRDs7QUF3QkE7OztBQUdBLElBQUksa0JBQWtCLFNBQWxCLGVBQWtCLENBQUMsT0FBRCxFQUFhO0FBQ2pDLE1BQU0sWUFBWSxTQUFTLGNBQVQsQ0FBd0IsbUJBQXhCLENBQWxCO0FBQ0EsWUFBVSxTQUFWLEdBQXNCLEVBQXRCOztBQUVBLE1BQU0sS0FBSyxTQUFTLGFBQVQsQ0FBdUIsSUFBdkIsQ0FBWDtBQUNBLEtBQUcsRUFBSCxHQUFRLGNBQVI7QUFDQSxZQUFVLE1BQVYsQ0FBaUIsRUFBakI7O0FBRUEsTUFBTSxRQUFRLFNBQVMsYUFBVCxDQUF1QixJQUF2QixDQUFkO0FBQ0EsUUFBTSxTQUFOLEdBQWtCLFNBQWxCO0FBQ0EsUUFBTSxZQUFOLENBQW1CLFVBQW5CLEVBQStCLEdBQS9CO0FBQ0EsWUFBVSxNQUFWLENBQWlCLEtBQWpCOztBQUVBLE1BQUksQ0FBQyxPQUFMLEVBQWM7QUFDWixRQUFNLFlBQVksU0FBUyxhQUFULENBQXVCLEdBQXZCLENBQWxCO0FBQ0EsY0FBVSxTQUFWLEdBQXNCLGlCQUF0QjtBQUNBLGNBQVUsTUFBVixDQUFpQixTQUFqQjtBQUNBO0FBQ0Q7O0FBRUQsTUFBSSxnQkFBZ0IsUUFBUSxJQUFSLENBQWEsVUFBUyxDQUFULEVBQVksQ0FBWixFQUFlO0FBQzlDLFdBQU8sSUFBSSxJQUFKLENBQVMsRUFBRSxTQUFYLElBQXdCLElBQUksSUFBSixDQUFTLEVBQUUsU0FBWCxDQUEvQjtBQUNELEdBRm1CLENBQXBCOztBQUlBLGdCQUFjLE9BQWQsQ0FBc0Isa0JBQVU7QUFDOUIsT0FBRyxNQUFILENBQVUsaUJBQWlCLE1BQWpCLENBQVY7QUFDRCxHQUZEO0FBR0EsWUFBVSxNQUFWLENBQWlCLEVBQWpCO0FBQ0QsQ0E1QkQ7O0FBOEJBOzs7QUFHQSxJQUFJLG1CQUFtQixTQUFuQixnQkFBbUIsQ0FBQyxNQUFELEVBQVk7QUFDakMsTUFBTSxLQUFLLFNBQVMsYUFBVCxDQUF1QixJQUF2QixDQUFYO0FBQ0EsTUFBTSxNQUFNLFNBQVMsYUFBVCxDQUF1QixLQUF2QixDQUFaO0FBQ0EsTUFBTSxPQUFPLFNBQVMsYUFBVCxDQUF1QixHQUF2QixDQUFiO0FBQ0EsT0FBSyxTQUFMLEdBQWlCLE9BQU8sSUFBeEI7QUFDQSxPQUFLLFNBQUwsR0FBaUIsYUFBakI7QUFDQSxPQUFLLFlBQUwsQ0FBa0IsVUFBbEIsRUFBOEIsR0FBOUI7O0FBRUEsTUFBSSxNQUFKLENBQVcsSUFBWDs7QUFFQSxNQUFNLE9BQU8sU0FBUyxhQUFULENBQXVCLEdBQXZCLENBQWI7QUFDQSxPQUFLLFNBQUwsR0FBaUIsSUFBSSxJQUFKLENBQVMsT0FBTyxTQUFoQixFQUEyQixZQUEzQixFQUFqQjtBQUNBLE9BQUssU0FBTCxHQUFpQixhQUFqQjtBQUNBLE9BQUssWUFBTCxDQUFrQixVQUFsQixFQUE4QixHQUE5Qjs7QUFFQSxNQUFJLE1BQUosQ0FBVyxJQUFYO0FBQ0EsS0FBRyxNQUFILENBQVUsR0FBVjs7QUFFQSxNQUFNLFNBQVMsU0FBUyxhQUFULENBQXVCLEdBQXZCLENBQWY7O0FBRUEsT0FBSyxJQUFJLElBQUksQ0FBYixFQUFnQixJQUFJLE9BQU8sTUFBM0IsRUFBbUMsR0FBbkMsRUFBd0M7QUFDdEMsUUFBTSxPQUFPLFNBQVMsYUFBVCxDQUF1QixHQUF2QixDQUFiO0FBQ0EsU0FBSyxTQUFMLEdBQWlCLGFBQWpCO0FBQ0EsV0FBTyxNQUFQLENBQWMsSUFBZDtBQUNEOztBQUVELEtBQUcsTUFBSCxDQUFVLE1BQVY7O0FBRUEsTUFBTSxXQUFXLFNBQVMsYUFBVCxDQUF1QixHQUF2QixDQUFqQjtBQUNBLFdBQVMsU0FBVCxHQUFxQixPQUFPLFFBQTVCO0FBQ0EsV0FBUyxZQUFULENBQXNCLFVBQXRCLEVBQWtDLEdBQWxDO0FBQ0EsS0FBRyxNQUFILENBQVUsUUFBVjs7QUFFQSxTQUFPLEVBQVA7QUFDRCxDQWxDRDs7QUFvQ0E7OztBQUdBLElBQUksY0FBYyxTQUFkLFdBQWMsR0FBTTtBQUN0QixNQUFJLFFBQVEsU0FBUyxjQUFULENBQXdCLGVBQXhCLENBQVo7QUFDQSxNQUFJLGVBQWUsU0FBUyxjQUFULENBQXdCLGVBQXhCLENBQW5COztBQUVBLGVBQWEsU0FBYixHQUF5Qiw4RUFBekI7QUFDQSxRQUFNLEtBQU4sQ0FBWSxPQUFaLEdBQXNCLE9BQXRCOztBQUVBLE1BQUksU0FBUyxTQUFTLGNBQVQsQ0FBd0IsWUFBeEIsQ0FBYjtBQUNBLFNBQU8sZ0JBQVAsQ0FBd0IsT0FBeEIsRUFBaUMsWUFBVztBQUMxQyxVQUFNLEtBQU4sQ0FBWSxPQUFaLEdBQXNCLE1BQXRCO0FBQ0QsR0FGRDtBQUdELENBWEQ7O0FBYUE7Ozs7QUFJQSxJQUFNLE9BQU8sU0FBUyxjQUFULENBQXdCLGFBQXhCLENBQWI7O0FBRUEsS0FBSyxnQkFBTCxDQUFzQixRQUF0QixFQUFnQyxVQUFTLENBQVQsRUFBWTtBQUMxQyxJQUFFLGNBQUY7QUFDQSxNQUFJLFNBQVM7QUFDWCxxQkFBaUIsS0FBSyxVQUFMLENBQWdCO0FBRHRCLEdBQWI7QUFHQSxNQUFNLFdBQVcsSUFBSSxRQUFKLENBQWEsSUFBYixDQUFqQjtBQUwwQztBQUFBO0FBQUE7O0FBQUE7QUFNMUMseUJBQXlCLFNBQVMsT0FBVCxFQUF6Qiw4SEFBNkM7QUFBQTs7QUFBQTs7QUFBQSxVQUFuQyxHQUFtQztBQUFBLFVBQTlCLEtBQThCOztBQUMzQyxhQUFPLEdBQVAsSUFBYyxLQUFkO0FBQ0Q7QUFSeUM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTs7QUFTMUMsTUFBSSxDQUFDLFVBQVUsTUFBZixFQUF1QjtBQUNyQjtBQUNEO0FBQ0QscUJBQVMsc0JBQVQsQ0FBZ0MsTUFBaEMsRUFDRyxJQURILENBQ1EsWUFBTTtBQUNWLFNBQUssS0FBTDtBQUNBLHVCQUFTLHNCQUFULENBQWdDLEtBQUssVUFBckMsRUFBaUQsVUFBQyxLQUFELEVBQVEsT0FBUixFQUFvQjtBQUNuRSxVQUFJLENBQUMsT0FBTCxFQUFjO0FBQ1osZ0JBQVEsR0FBUixDQUFZLEtBQVo7QUFDRDtBQUNELHNCQUFnQixPQUFoQjtBQUNELEtBTEQ7QUFNRCxHQVRILEVBVUcsS0FWSCxDQVVTO0FBQUEsV0FBUyxRQUFRLEtBQVIsQ0FBYyxLQUFkLEVBQXFCLEtBQXJCLENBQVQ7QUFBQSxHQVZUO0FBV0QsQ0F2QkQ7OztBQzFQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuaW1wb3J0IGlkYiBmcm9tICdpZGInO1xyXG5cclxuLyoqXHJcbiAqIENvbW1vbiBkYXRhYmFzZSBoZWxwZXIgZnVuY3Rpb25zLlxyXG4gKi9cclxuXHJcbmNsYXNzIERCSGVscGVyIHtcclxuICAvKipcclxuICAgKiBEYXRhYmFzZSBVUkwuXHJcbiAgICogQ2hhbmdlIHRoaXMgdG8gcmVzdGF1cmFudHMuanNvbiBmaWxlIGxvY2F0aW9uIG9uIHlvdXIgc2VydmVyLlxyXG4gICAqL1xyXG4gIHN0YXRpYyBnZXQgREFUQUJBU0VfVVJMKCkge1xyXG4gICAgLy9jb25zdCBwb3J0ID0gMTMzNzsvLyBDaGFuZ2UgdGhpcyB0byB5b3VyIHNlcnZlciBwb3J0XHJcbiAgICAvL3JldHVybiBgaHR0cHM6Ly9yZXN0YXVyYW50LXJldmlld3MtYXBpLmhlcm9rdWFwcC5jb20vOiR7cG9ydH1gO1xyXG4gICAgcmV0dXJuICdodHRwczovL3Jlc3RhdXJhbnQtcmV2aWV3cy1hcGkuaGVyb2t1YXBwLmNvbSc7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBATWFwIG1hcmtlciBmb3IgYSByZXN0YXVyYW50LlxyXG4gICAqL1xyXG4gIHN0YXRpYyBtYXBNYXJrZXJGb3JSZXN0YXVyYW50KHJlc3RhdXJhbnQsIG1hcCkge1xyXG4gICAgREJIZWxwZXIuYWRkVGl0bGVUb01hcCgpO1xyXG4gICAgREJIZWxwZXIuYWRkQWx0VG9NYXAoKTtcclxuICAgIGNvbnN0IG1hcmtlciA9IG5ldyBnb29nbGUubWFwcy5NYXJrZXIoe1xyXG4gICAgICBwb3NpdGlvbjogcmVzdGF1cmFudC5sYXRsbmcsXHJcbiAgICAgIHRpdGxlOiByZXN0YXVyYW50Lm5hbWUsXHJcbiAgICAgIHVybDogREJIZWxwZXIudXJsRm9yUmVzdGF1cmFudChyZXN0YXVyYW50KSxcclxuICAgICAgbWFwOiBtYXAsXHJcbiAgICAgIGFuaW1hdGlvbjogZ29vZ2xlLm1hcHMuQW5pbWF0aW9uLkRST1BcclxuICAgIH0pO1xyXG4gICAgcmV0dXJuIG1hcmtlcjtcclxuICB9XHJcbiAgLyoqXHJcbiAgICogQGFkZCBhdHRyaWJ1dGUgdGl0bGUgdG8gPGlmcmFtZT4gaW4gR29vZ2xlIE1hcCB0byBpbXByb3ZlIHRoZSBhY2Nlc3NpYmlsaXR5XHJcbiAgICovXHJcbiAgc3RhdGljIGFkZFRpdGxlVG9NYXAoKSB7XHJcbiAgICBnb29nbGUubWFwcy5ldmVudC5hZGRMaXN0ZW5lck9uY2UobWFwLCAnaWRsZScsICgpID0+IHtcclxuICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2lmcmFtZScpWzBdLnRpdGxlID0gJ0dvb2dsZSBNYXBzJztcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQG9wZW4gZGF0YWJhc2UgdG8gc3RvcmUgZGF0YSByZXRyaWV2ZWQgZnJvbSB0aGUgc2VydmVyIGluIGluZGV4ZWREQiBBUElcclxuICAgKi9cclxuICBzdGF0aWMgb3BlbkRhdGFiYXNlKCkge1xyXG4gICAgaWYgKCFuYXZpZ2F0b3Iuc2VydmljZVdvcmtlcikge1xyXG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICByZXR1cm4gaWRiLm9wZW4oJ3Jlc3RhdXJhbnRzJywgMywgKHVwZ3JhZGVEYikgPT4ge1xyXG4gICAgICAgIHVwZ3JhZGVEYi5jcmVhdGVPYmplY3RTdG9yZSgncmVzdGF1cmFudHMnLCB7IGtleVBhdGg6ICdpZCcgfSk7XHJcbiAgICAgICAgbGV0IHJldmlld1N0b3JlID0gdXBncmFkZURiLmNyZWF0ZU9iamVjdFN0b3JlKCdyZXZpZXdzJywgeyBrZXlQYXRoOiAnaWQnIH0pO1xyXG4gICAgICAgIHJldmlld1N0b3JlLmNyZWF0ZUluZGV4KCdyZXN0YXVyYW50X2lkJywgJ3Jlc3RhdXJhbnRfaWQnLCB7IHVuaXF1ZTogZmFsc2UgfSk7XHJcbiAgICAgICAgdXBncmFkZURiLmNyZWF0ZU9iamVjdFN0b3JlKCdvZmZsaW5lLXJldmlld3MnLCB7IGtleVBhdGg6ICd1cGRhdGVkQXQnIH0pO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcbiAgLyoqXHJcbiAgICogQGdldCBkYXRhIGZyb20gYSBzdG9yZSBpbiBJbmRleGVkREIgaWYgaXQgaXMgYXZhaWxhYmxlXHJcbiAgICovXHJcbiAgc3RhdGljIGdldENhY2hlZEluZGV4ZWREQihzdG9yZV9uYW1lKSB7XHJcbiAgICBsZXQgZGJQcm9taXNlID0gREJIZWxwZXIub3BlbkRhdGFiYXNlKCk7XHJcblxyXG4gICAgcmV0dXJuIGRiUHJvbWlzZS50aGVuKGZ1bmN0aW9uKGRiKSB7XHJcbiAgICAgIGlmKCFkYikgcmV0dXJuO1xyXG4gICAgICBsZXQgdHggPSBkYi50cmFuc2FjdGlvbihzdG9yZV9uYW1lKTtcclxuICAgICAgbGV0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoc3RvcmVfbmFtZSk7XHJcbiAgICAgIHJldHVybiBzdG9yZS5nZXRBbGwoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQHN0b3JlIHRoZSBkYXRhIGluIEluZGV4ZWREQiBhZnRlciBmZXRjaGluZyBpdCBmcm9tIHRoZSBzZXJ2ZXJcclxuICAgKiBAcGFyYW0gZGF0YXM6IGFyZSByZXRyaWV2ZWQgZnJvbSB0aGUgc2VydmVyLCBzdG9yZV9uYW1lOiB7c3RyaW5nfVxyXG4gICAqL1xyXG4gIHN0YXRpYyBzdG9yZURhdGFJbmRleGVkRGIoZGF0YXMsIHN0b3JlX25hbWUpIHtcclxuICAgIGxldCBkYlByb21pc2UgPSBEQkhlbHBlci5vcGVuRGF0YWJhc2UoKTtcclxuXHJcbiAgICBkYlByb21pc2UudGhlbihkYiA9PiB7XHJcbiAgICAgIGlmICghZGIpIHJldHVybjtcclxuICAgICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihzdG9yZV9uYW1lLCAncmVhZHdyaXRlJyk7XHJcbiAgICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoc3RvcmVfbmFtZSk7XHJcblxyXG4gICAgICBkYXRhcy5mb3JFYWNoKGRhdGEgPT4ge1xyXG4gICAgICAgIHN0b3JlLnB1dChkYXRhKTtcclxuICAgICAgfSk7XHJcbiAgICAgIHJldHVybiB0eC5jb21wbGV0ZTtcclxuICAgIH0pO1xyXG4gIH1cclxuICAvKipcclxuICAgKiBAZmV0Y2ggYWxsIHJlc3RhdXJhbnRzIGZvcm0gSW5kZXhlZERCIGlmIHRoZXkgZXhpc3Qgb3RoZXJ3aXNlIGZldGNoIGZyb20gdGhlIHNlcnZlci5cclxuICAgKi9cclxuICBzdGF0aWMgZmV0Y2hSZXN0YXVyYW50cyhjYWxsYmFjaykge1xyXG4gICAgLy9jaGVjayBpZiBkYXRhIGV4aXN0cyBpbiBpbmRleERCIEFQSSBpZiBpdCBkb2VzIHJldHVybiBjYWxsYmFja1xyXG4gICAgREJIZWxwZXIuZ2V0Q2FjaGVkSW5kZXhlZERCKCdyZXN0YXVyYW50cycpLnRoZW4ocmVzdWx0cyA9PiB7XHJcbiAgICAgIGlmIChyZXN1bHRzICYmIHJlc3VsdHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdHMpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIFVzZSBlbHNlIGNvbmRpdGlvbiB0byBhdm9pZCBmZXRjaGluZyBmcm9tIHNhaWxzIHNlcnZlclxyXG4gICAgICAgIC8vIGJlY2F1c2UgdXBkYXRpbmcgZmF2b3JpdGUgb24gdGhlIHNhaWxzIHNlcnZlciBpcyBub3QgcGVyc2lzdGVudFxyXG4gICAgICAgIC8vIGFuZCB0byBnZXQgZGF0YSBmcm9tIEluZGV4ZWREQiBvbmx5XHJcbiAgICAgICAgZmV0Y2goYCR7REJIZWxwZXIuREFUQUJBU0VfVVJMfS9yZXN0YXVyYW50c2ApXHJcbiAgICAgICAgICAudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpXHJcbiAgICAgICAgICAudGhlbihyZXN0YXVyYW50cyA9PiB7XHJcbiAgICAgICAgICAgIC8vc3RvcmUgZGF0YSBpbiBpbmRleERCIEFQSSBhZnRlciBmZXRjaGluZ1xyXG4gICAgICAgICAgICBEQkhlbHBlci5zdG9yZURhdGFJbmRleGVkRGIocmVzdGF1cmFudHMsICdyZXN0YXVyYW50cycpO1xyXG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCwgcmVzdGF1cmFudHMpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgICAgIC5jYXRjaChlcnIgPT4ge1xyXG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyICwgbnVsbCk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG4gIC8qKlxyXG4gICAqIEBmZXRjaCBhbGwgcmV2aWV3cyBmb3JtIEluZGV4ZWREQiBpZiB0aGV5IGV4aXN0IG90aGVyd2lzZSBmZXRjaCBmcm9tIHRoZSBzZXJ2ZXIuXHJcbiAgICovXHJcbiAgc3RhdGljIGZldGNoUmVzdGF1cmFudFJldmlld3MocmVzdGF1cmFudCwgY2FsbGJhY2spIHtcclxuICAgIGxldCBkYlByb21pc2UgPSBEQkhlbHBlci5vcGVuRGF0YWJhc2UoKTtcclxuXHJcbiAgICBkYlByb21pc2UudGhlbihkYiA9PiB7XHJcbiAgICAgIGlmICghZGIpIHJldHVybjtcclxuXHJcbiAgICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oJ3Jldmlld3MnKTtcclxuICAgICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZSgncmV2aWV3cycpO1xyXG4gICAgICBjb25zdCBpbmRleCA9IHN0b3JlLmluZGV4KCdyZXN0YXVyYW50X2lkJyk7XHJcblxyXG4gICAgICBpbmRleC5nZXRBbGwocmVzdGF1cmFudC5pZCkudGhlbihyZXN1bHRzID0+IHtcclxuICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHRzKTtcclxuXHJcbiAgICAgICAgaWYgKCFuYXZpZ2F0b3Iub25MaW5lKSB7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmZXRjaChgJHtEQkhlbHBlci5EQVRBQkFTRV9VUkx9L3Jldmlld3MvP3Jlc3RhdXJhbnRfaWQ9JHtyZXN0YXVyYW50LmlkfWApXHJcbiAgICAgICAgICAudGhlbihyZXNwb25zZSA9PiB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5qc29uKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgICAgLnRoZW4ocmV2aWV3cyA9PiB7XHJcbiAgICAgICAgICAgIC8vc3RvcmUgZGF0YSBpbiBpbmRleERCIEFQSSBhZnRlciBmZXRjaGluZ1xyXG4gICAgICAgICAgICBsZXQgcmV2aWV3c0xlbiA9IHJldmlld3MubGVuZ3RoO1xyXG4gICAgICAgICAgICBpZiAocmV2aWV3c0xlbiA+PSAyOSkge1xyXG4gICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmV2aWV3c0xlbiAtIDIwOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIERCSGVscGVyLmRlbGV0ZVJlc3RhdXJhbnRSZXZpZXdzKHJldmlld3NbaV0uaWQpO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBEQkhlbHBlci5zdG9yZURhdGFJbmRleGVkRGIocmV2aWV3cywgJ3Jldmlld3MnKTtcclxuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmV2aWV3cyk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgICAgLmNhdGNoKGVyciA9PiB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrKGVyciAsIG51bGwpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAZmV0Y2ggYSByZXN0YXVyYW50IGJ5IGl0cyBJRC5cclxuICAgKi9cclxuICBzdGF0aWMgZmV0Y2hSZXN0YXVyYW50QnlJZChpZCwgY2FsbGJhY2spIHtcclxuICAgIC8vIGZldGNoIGFsbCByZXN0YXVyYW50cyB3aXRoIHByb3BlciBlcnJvciBoYW5kbGluZy5cclxuICAgIERCSGVscGVyLmZldGNoUmVzdGF1cmFudHMoKGVycm9yLCByZXN0YXVyYW50cykgPT4ge1xyXG4gICAgICBpZiAoZXJyb3IpIHtcclxuICAgICAgICBjYWxsYmFjayhlcnJvciwgbnVsbCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc3QgcmVzdGF1cmFudCA9IHJlc3RhdXJhbnRzLmZpbmQociA9PiByLmlkID09IGlkKTtcclxuICAgICAgICBpZiAocmVzdGF1cmFudCkgeyAvLyBHb3QgdGhlIHJlc3RhdXJhbnRcclxuICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3RhdXJhbnQpO1xyXG4gICAgICAgIH0gZWxzZSB7IC8vIFJlc3RhdXJhbnQgZG9lcyBub3QgZXhpc3QgaW4gdGhlIGRhdGFiYXNlXHJcbiAgICAgICAgICBjYWxsYmFjaygnUmVzdGF1cmFudCBkb2VzIG5vdCBleGlzdCcsIG51bGwpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAZmV0Y2ggcmVzdGF1cmFudHMgYnkgYSBjdWlzaW5lIHR5cGUgd2l0aCBwcm9wZXIgZXJyb3IgaGFuZGxpbmcuXHJcbiAgICovXHJcbiAgc3RhdGljIGZldGNoUmVzdGF1cmFudEJ5Q3Vpc2luZShjdWlzaW5lLCBjYWxsYmFjaykge1xyXG4gICAgLy8gRmV0Y2ggYWxsIHJlc3RhdXJhbnRzICB3aXRoIHByb3BlciBlcnJvciBoYW5kbGluZ1xyXG4gICAgREJIZWxwZXIuZmV0Y2hSZXN0YXVyYW50cygoZXJyb3IsIHJlc3RhdXJhbnRzKSA9PiB7XHJcbiAgICAgIGlmIChlcnJvcikge1xyXG4gICAgICAgIGNhbGxiYWNrKGVycm9yLCBudWxsKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBGaWx0ZXIgcmVzdGF1cmFudHMgdG8gaGF2ZSBvbmx5IGdpdmVuIGN1aXNpbmUgdHlwZVxyXG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSByZXN0YXVyYW50cy5maWx0ZXIociA9PiByLmN1aXNpbmVfdHlwZSA9PSBjdWlzaW5lKTtcclxuICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHRzKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAZmV0Y2ggcmVzdGF1cmFudHMgYnkgYSBuZWlnaGJvcmhvb2Qgd2l0aCBwcm9wZXIgZXJyb3IgaGFuZGxpbmcuXHJcbiAgICovXHJcbiAgc3RhdGljIGZldGNoUmVzdGF1cmFudEJ5TmVpZ2hib3Job29kKG5laWdoYm9yaG9vZCwgY2FsbGJhY2spIHtcclxuICAgIC8vIEZldGNoIGFsbCByZXN0YXVyYW50c1xyXG4gICAgREJIZWxwZXIuZmV0Y2hSZXN0YXVyYW50cygoZXJyb3IsIHJlc3RhdXJhbnRzKSA9PiB7XHJcbiAgICAgIGlmIChlcnJvcikge1xyXG4gICAgICAgIGNhbGxiYWNrKGVycm9yLCBudWxsKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBGaWx0ZXIgcmVzdGF1cmFudHMgdG8gaGF2ZSBvbmx5IGdpdmVuIG5laWdoYm9yaG9vZFxyXG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSByZXN0YXVyYW50cy5maWx0ZXIociA9PiByLm5laWdoYm9yaG9vZCA9PSBuZWlnaGJvcmhvb2QpO1xyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdHMpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEBmZXRjaCByZXN0YXVyYW50cyBieSBhIGN1aXNpbmUgYW5kIGEgbmVpZ2hib3Job29kIHdpdGggcHJvcGVyIGVycm9yIGhhbmRsaW5nLlxyXG4gICAqL1xyXG4gIHN0YXRpYyBmZXRjaFJlc3RhdXJhbnRCeUN1aXNpbmVBbmROZWlnaGJvcmhvb2QoY3Vpc2luZSwgbmVpZ2hib3Job29kLCBjYWxsYmFjaykge1xyXG4gICAgLy8gRmV0Y2ggYWxsIHJlc3RhdXJhbnRzXHJcbiAgICBEQkhlbHBlci5mZXRjaFJlc3RhdXJhbnRzKChlcnJvciwgcmVzdGF1cmFudHMpID0+IHtcclxuICAgICAgaWYgKGVycm9yKSB7XHJcbiAgICAgICAgY2FsbGJhY2soZXJyb3IsIG51bGwpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGxldCByZXN1bHRzID0gcmVzdGF1cmFudHM7XHJcbiAgICAgICAgaWYgKGN1aXNpbmUgIT0gJ2FsbCcpIHsgLy8gZmlsdGVyIGJ5IGN1aXNpbmVcclxuICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLmZpbHRlcihyID0+IHIuY3Vpc2luZV90eXBlID09IGN1aXNpbmUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAobmVpZ2hib3Job29kICE9ICdhbGwnKSB7IC8vIGZpbHRlciBieSBuZWlnaGJvcmhvb2RcclxuICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLmZpbHRlcihyID0+IHIubmVpZ2hib3Job29kID09IG5laWdoYm9yaG9vZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdHMpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHN0YXRpYyBmZXRjaFJlc3RhdXJhbnRCeUN1aXNpbmVOZWlnaGJvcmhvb2RBbmRGYXZvcml0ZShjdWlzaW5lLCBuZWlnaGJvcmhvb2QsIGZhdm9yaXRlLCBjYWxsYmFjaykge1xyXG4gICAgLy8gRmV0Y2ggYWxsIHJlc3RhdXJhbnRzXHJcbiAgICBEQkhlbHBlci5mZXRjaFJlc3RhdXJhbnRzKChlcnJvciwgcmVzdGF1cmFudHMpID0+IHtcclxuICAgICAgaWYgKGVycm9yKSB7XHJcbiAgICAgICAgY2FsbGJhY2soZXJyb3IsIG51bGwpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGxldCByZXN1bHRzID0gcmVzdGF1cmFudHM7XHJcbiAgICAgICAgaWYgKGN1aXNpbmUgIT0gJ2FsbCcpIHsgLy8gZmlsdGVyIGJ5IGN1aXNpbmVcclxuICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLmZpbHRlcihyID0+IHIuY3Vpc2luZV90eXBlID09IGN1aXNpbmUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAobmVpZ2hib3Job29kICE9ICdhbGwnKSB7IC8vIGZpbHRlciBieSBuZWlnaGJvcmhvb2RcclxuICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLmZpbHRlcihyID0+IHIubmVpZ2hib3Job29kID09IG5laWdoYm9yaG9vZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChmYXZvcml0ZSA9PSAndHJ1ZScpIHtcclxuICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLmZpbHRlcihyID0+IHIuaXNfZmF2b3JpdGUgPT0gJ3RydWUnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0cyk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQGZldGNoIGFsbCBuZWlnaGJvcmhvb2RzIHdpdGggcHJvcGVyIGVycm9yIGhhbmRsaW5nLlxyXG4gICAqL1xyXG4gIHN0YXRpYyBmZXRjaE5laWdoYm9yaG9vZHMoY2FsbGJhY2spIHtcclxuICAgIC8vIEZldGNoIGFsbCByZXN0YXVyYW50c1xyXG4gICAgREJIZWxwZXIuZmV0Y2hSZXN0YXVyYW50cygoZXJyb3IsIHJlc3RhdXJhbnRzKSA9PiB7XHJcbiAgICAgIGlmIChlcnJvcikge1xyXG4gICAgICAgIGNhbGxiYWNrKGVycm9yLCBudWxsKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBHZXQgYWxsIG5laWdoYm9yaG9vZHMgZnJvbSBhbGwgcmVzdGF1cmFudHNcclxuICAgICAgICBjb25zdCBuZWlnaGJvcmhvb2RzID0gcmVzdGF1cmFudHMubWFwKCh2LCBpKSA9PiByZXN0YXVyYW50c1tpXS5uZWlnaGJvcmhvb2QpO1xyXG4gICAgICAgIC8vIFJlbW92ZSBkdXBsaWNhdGVzIGZyb20gbmVpZ2hib3Job29kc1xyXG4gICAgICAgIGNvbnN0IHVuaXF1ZU5laWdoYm9yaG9vZHMgPSBuZWlnaGJvcmhvb2RzLmZpbHRlcigodiwgaSkgPT4gbmVpZ2hib3Job29kcy5pbmRleE9mKHYpID09IGkpO1xyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHVuaXF1ZU5laWdoYm9yaG9vZHMpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEBmZXRjaCBhbGwgY3Vpc2luZXMgd2l0aCBwcm9wZXIgZXJyb3IgaGFuZGxpbmcuXHJcbiAgICovXHJcbiAgc3RhdGljIGZldGNoQ3Vpc2luZXMoY2FsbGJhY2spIHtcclxuICAgIC8vIEZldGNoIGFsbCByZXN0YXVyYW50c1xyXG4gICAgREJIZWxwZXIuZmV0Y2hSZXN0YXVyYW50cygoZXJyb3IsIHJlc3RhdXJhbnRzKSA9PiB7XHJcbiAgICAgIGlmIChlcnJvcikge1xyXG4gICAgICAgIGNhbGxiYWNrKGVycm9yLCBudWxsKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBHZXQgYWxsIGN1aXNpbmVzIGZyb20gYWxsIHJlc3RhdXJhbnRzXHJcbiAgICAgICAgY29uc3QgY3Vpc2luZXMgPSByZXN0YXVyYW50cy5tYXAoKHYsIGkpID0+IHJlc3RhdXJhbnRzW2ldLmN1aXNpbmVfdHlwZSk7XHJcbiAgICAgICAgLy8gUmVtb3ZlIGR1cGxpY2F0ZXMgZnJvbSBjdWlzaW5lc1xyXG4gICAgICAgIGNvbnN0IHVuaXF1ZUN1aXNpbmVzID0gY3Vpc2luZXMuZmlsdGVyKCh2LCBpKSA9PiBjdWlzaW5lcy5pbmRleE9mKHYpID09IGkpO1xyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHVuaXF1ZUN1aXNpbmVzKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAcmVzdGF1cmFudCBwYWdlIFVSTC5cclxuICAgKi9cclxuICBzdGF0aWMgdXJsRm9yUmVzdGF1cmFudChyZXN0YXVyYW50KSB7XHJcbiAgICByZXR1cm4gKGAuL3Jlc3RhdXJhbnQuaHRtbD9pZD0ke3Jlc3RhdXJhbnQuaWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAcmVzdGF1cmFudCBpbWFnZSBVUkwuXHJcbiAgICovXHJcbiAgc3RhdGljIGltYWdlVXJsRm9yUmVzdGF1cmFudChyZXN0YXVyYW50KSB7XHJcbiAgICBpZiAocmVzdGF1cmFudC5waG90b2dyYXBoID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgcmVzdGF1cmFudC5waG90b2dyYXBoID0gMTA7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gKGBpbWcvJHtyZXN0YXVyYW50LnBob3RvZ3JhcGh9LndlYnBgKTtcclxuICB9XHJcblxyXG4gIHN0YXRpYyBkZWxldGVSZXN0YXVyYW50UmV2aWV3cyhyZXZpZXdfaWQpIHtcclxuICAgIGZldGNoKGAke0RCSGVscGVyLkRBVEFCQVNFX1VSTH0vcmV2aWV3cy8ke3Jldmlld19pZH1gLCB7XHJcbiAgICAgIG1ldGhvZDogJ0RFTEVURSdcclxuICAgIH0pXHJcbiAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcclxuICAgICAgICByZXR1cm4gcmVzcG9uc2U7XHJcbiAgICAgIH0pXHJcbiAgICAgIC50aGVuKGRhdGEgPT4ge1xyXG4gICAgICAgIHJldHVybiBkYXRhO1xyXG4gICAgICB9KVxyXG4gICAgICAuY2F0Y2goZXJyID0+IHtcclxuICAgICAgICBjb25zb2xlLmxvZygnRXJyb3InLCBlcnIpO1xyXG4gICAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEBwb3N0IHJldmlld19kYXRhIHRvIHRoZSBzZXJ2ZXIgd2hlbiBhIHVzZXIgc3VibWl0cyBhIHJldmlld1xyXG4gICAqIG9ubGluZToga2VlcCBpdCBpbiB0aGUgcmV2aWV3cyBzdG9yZSBpbiBJbmRleGVkREJcclxuICAgKiBvZmZsaW5lOiBrZWVwIGl0IGluIHRoZSBvZmZsbmUtcmV2aWV3cyBpbiBJbmRleGVkREJcclxuICAgKiBAcGFyYW0gcmV2aWV3X2RhdGEgaXMgZnJvbSBhIHVzZXIgZmlsbHMgb3V0IHRoZSBmb3JtXHJcbiAgICovXHJcbiAgc3RhdGljIGNyZWF0ZVJlc3RhdXJhbnRSZXZpZXcocmV2aWV3X2RhdGEpIHtcclxuICAgIHJldHVybiBmZXRjaChgJHtEQkhlbHBlci5EQVRBQkFTRV9VUkx9L3Jldmlld3NgLCB7XHJcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxyXG4gICAgICBjYWNoZTogJ25vLWNhY2hlJywgLy8gKmRlZmF1bHQsIG5vLWNhY2hlLCByZWxvYWQsIGZvcmNlLWNhY2hlLCBvbmx5LWlmLWNhY2hlZFxyXG4gICAgICBjcmVkZW50aWFsczogJ3NhbWUtb3JpZ2luJyxcclxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocmV2aWV3X2RhdGEpLFxyXG4gICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgJ2NvbnRlbnQtdHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xyXG4gICAgICB9LFxyXG4gICAgICBtb2RlOiAnY29ycycsXHJcbiAgICAgIHJlZGlyZWN0OiAnZm9sbG93JyxcclxuICAgICAgcmVmZXJyZXI6ICduby1yZWZlcnJlcicsXHJcbiAgICB9KVxyXG4gICAgICAudGhlbihyZXNwb25zZSA9PiB7XHJcbiAgICAgICAgcmVzcG9uc2UuanNvbigpXHJcbiAgICAgICAgICAudGhlbihyZXZpZXdfZGF0YSA9PiB7XHJcbiAgICAgICAgICAvKiBrZWVwIGRhdGFzIGluIEluZGV4ZWREQiBhZnRlciBwb3N0aW5nIGRhdGEgdG8gdGhlIHNlcnZlciB3aGVuIG9ubGluZSAqL1xyXG4gICAgICAgICAgICBEQkhlbHBlci5zdG9yZURhdGFJbmRleGVkRGIoW3Jldmlld19kYXRhXSwgJ3Jldmlld3MnKTtcclxuICAgICAgICAgICAgcmV0dXJuIHJldmlld19kYXRhO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgIH0pXHJcbiAgICAgIC5jYXRjaChlcnJvciA9PiB7XHJcbiAgICAgICAgcmV2aWV3X2RhdGFbJ3VwZGF0ZWRBdCddID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XHJcbiAgICAgICAgLyoga2VlcCBkYXRhcyBpbiBJbmRleGVkREIgYWZ0ZXIgcG9zdGluZyBkYXRhIHRvIHRoZSBzZXJ2ZXIgd2hlbiBvZmZsaW5lKi9cclxuICAgICAgICBEQkhlbHBlci5zdG9yZURhdGFJbmRleGVkRGIoW3Jldmlld19kYXRhXSwgJ29mZmxpbmUtcmV2aWV3cycpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdSZXZpZXcgc3RvcmVkIG9mZmxpbmUgaW4gSURCJyk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEBjbGVhciBkYXRhIGluIHRoZSBvZmZsaW5lLXJldmlld3Mgc3RvcmVcclxuICAgKi9cclxuICBzdGF0aWMgY2xlYXJPZmZsaW5lUmV2aWV3cygpIHtcclxuICAgIGxldCBkYlByb21pc2UgPSBEQkhlbHBlci5vcGVuRGF0YWJhc2UoKTtcclxuICAgIGRiUHJvbWlzZS50aGVuKGRiID0+IHtcclxuICAgICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbignb2ZmbGluZS1yZXZpZXdzJywgJ3JlYWR3cml0ZScpO1xyXG4gICAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKCdvZmZsaW5lLXJldmlld3MnKTtcclxuICAgICAgc3RvcmUuY2xlYXIoKTtcclxuICAgIH0pO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQGdldCByZXZpZXdzIGZyb20gb2ZmbGluZS1zdG9yZXMgaW4gSW5kZXhlZERCIHdoZW4gYSB1c2VyIGdvIGZyb20gb2ZmbGluZSB0byBvbmxpbmVcclxuICAgKi9cclxuICBzdGF0aWMgY3JlYXRlT2ZmbGluZVJldmlldygpIHtcclxuICAgIERCSGVscGVyLm9wZW5EYXRhYmFzZSgpLnRoZW4oZGIgPT4ge1xyXG4gICAgICBpZiAoIWRiKSByZXR1cm47XHJcbiAgICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oJ29mZmxpbmUtcmV2aWV3cycsICdyZWFkd3JpdGUnKTtcclxuICAgICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZSgnb2ZmbGluZS1yZXZpZXdzJyk7XHJcblxyXG4gICAgICBzdG9yZS5nZXRBbGwoKS50aGVuKG9mZmxpbmVSZXZpZXdzID0+IHtcclxuICAgICAgICBvZmZsaW5lUmV2aWV3cy5mb3JFYWNoKHJldmlldyA9PiB7XHJcbiAgICAgICAgICBEQkhlbHBlci5jcmVhdGVSZXN0YXVyYW50UmV2aWV3KHJldmlldyk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgREJIZWxwZXIuY2xlYXJPZmZsaW5lUmV2aWV3cygpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuICAvKipcclxuICAgKkB3aGVuIG9ubGluZSB1cGRhdGUgYSB2YWx1ZSBvZiBhIHJlc3RhdXJhbnQncyBmYXZvcml0ZSBieSBzZW5kaW5nIHRoZSBQVVQgcmVxdWVzdCB0byB0aGUgc2VydmVyXHJcbiAgICphbmQgc3RvcmUgdGhlIGRhdGEgdG8gSW5kZXhlZERCIHNvIGl0IGNhbiBiZSB1c2VkIHdoZW4gb2ZmbGluZVxyXG4gICovXHJcbiAgc3RhdGljIHRvZ2dsZUZhdm9yaXRlKHJlc3RhdXJhbnQsIGlzRmF2b3JpdGUpIHtcclxuICAgIHJldHVybiBmZXRjaChgJHtEQkhlbHBlci5EQVRBQkFTRV9VUkx9L3Jlc3RhdXJhbnRzLyR7cmVzdGF1cmFudC5pZH0vP2lzX2Zhdm9yaXRlPSR7aXNGYXZvcml0ZX1gLCB7XHJcbiAgICAgIG1ldGhvZDogJ1BVVCcsXHJcbiAgICB9KVxyXG4gICAgICAudGhlbihyZXNwb25zZSA9PiB7XHJcbiAgICAgICAgY29uc29sZS5sb2coYHVwZGF0ZWQgQVBJIHJlc3RhdXJhbnQ6ICR7cmVzdGF1cmFudC5pZH0gZmF2b3JpdGUgOiAke2lzRmF2b3JpdGV9YCk7XHJcbiAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24oKTtcclxuICAgICAgfSlcclxuICAgICAgLnRoZW4oZGF0YSA9PiB7XHJcbiAgICAgICAgREJIZWxwZXIuc3RvcmVEYXRhSW5kZXhlZERiKFtkYXRhXSwgJ3Jlc3RhdXJhbnRzJyk7XHJcbiAgICAgICAgY29uc29sZS5sb2coYHVwZGF0ZWQgSURCIHJlc3RhdXJhbnQ6ICR7cmVzdGF1cmFudC5pZH0gZmF2b3JpdGUgOiAke2lzRmF2b3JpdGV9YCk7XHJcbiAgICAgICAgcmV0dXJuIGRhdGE7XHJcbiAgICAgIH0pXHJcbiAgICAgIC5jYXRjaChlcnJvciA9PiB7XHJcbiAgICAgICAgLy8gY29udmVydCBmcm9tIGJvb2xlYW4gdG8gc3RyaW5nIGJlY2F1c2UgdGhlIEFQSSB1c2VzIHN0cmluZ3MgJ3RydWUnIGFuZCAnZmFsc2UnXHJcbiAgICAgICAgcmVzdGF1cmFudC5pc19mYXZvcml0ZSA9IGlzRmF2b3JpdGUgPyAndHJ1ZScgOiAnZmFsc2UnO1xyXG5cclxuICAgICAgICBEQkhlbHBlci5zdG9yZURhdGFJbmRleGVkRGIoW3Jlc3RhdXJhbnRdLCAncmVzdGF1cmFudHMnKTtcclxuICAgICAgICBjb25zb2xlLmxvZygnc3RvcmUgZmF2b3JpdGUgb2ZmbGluZScpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICogQGZpbGwgZmF2b3JpdGVzIGluIEhUTUwgc28gaXQgY2FuIGJlIHVzZWQgYnkgYm90aCBtYWluIGFuZCByZXN0YXVyYW50IHBhZ2VcclxuICovXHJcbiAgc3RhdGljIGZpbGxGYXZvcml0ZXNIVE1MKHJlc3RhdXJhbnQpIHtcclxuICAgIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGFiZWwnKTtcclxuICAgIGxhYmVsLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdMYWJlbCBmb3IgY2hlY2tpbmcgZmF2b3JpdGUnKTtcclxuICAgIGxhYmVsLmNsYXNzTmFtZSA9ICdmYXYtY29udGFpbmVyJztcclxuXHJcbiAgICBjb25zdCBpY29uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaScpO1xyXG4gICAgaWNvbi5jbGFzc05hbWUgPSAnZmFzIGZhLWhlYXJ0JztcclxuICAgIGxhYmVsLmFwcGVuZChpY29uKTtcclxuXHJcbiAgICBjb25zdCBpbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XHJcbiAgICBpbnB1dC50eXBlID0gJ2NoZWNrYm94JztcclxuICAgIGlucHV0LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdTZWxlY3QgZmF2b3JpdGUnKTtcclxuXHJcbiAgICBpZiAocmVzdGF1cmFudC5pc19mYXZvcml0ZSA9PSAndHJ1ZScpIHtcclxuICAgICAgaWNvbi5zdHlsZS5jb2xvciA9ICcjZDMyZjJmJztcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGljb24uc3R5bGUuY29sb3IgPSAnI2FlYjBiMSc7XHJcbiAgICB9XHJcblxyXG4gICAgaW5wdXQuY2hlY2tlZCA9IChyZXN0YXVyYW50LmlzX2Zhdm9yaXRlICA9PSAndHJ1ZScpO1xyXG4gICAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgZXZlbnQgPT4ge1xyXG4gICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICBpZiAoaW5wdXQuY2hlY2tlZCA9PSB0cnVlKSB7XHJcbiAgICAgICAgREJIZWxwZXIudG9nZ2xlRmF2b3JpdGUocmVzdGF1cmFudCwgaW5wdXQuY2hlY2tlZCk7XHJcbiAgICAgICAgaWNvbi5zdHlsZS5jb2xvciA9ICcjZDMyZjJmJztcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBEQkhlbHBlci50b2dnbGVGYXZvcml0ZShyZXN0YXVyYW50LCBpbnB1dC5jaGVja2VkKTtcclxuICAgICAgICBpY29uLnN0eWxlLmNvbG9yID0gJyNhZWIwYjEnO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICAgIGxhYmVsLmFwcGVuZChpbnB1dCk7XHJcbiAgICByZXR1cm4gbGFiZWw7XHJcbiAgfVxyXG5cclxuICAvKkBjcmVhdGUgdGhlc2UgZnVuY3Rpb25zIHRvIGFkZCBvbmxpbmUgc3RhdHVzIHRvIHRoZSBicm93c2VyXHJcbiAgICogd2hlbiBpdCBpcyBvZmZsaW5lIGl0IHdpbGwgc3RvcmUgcmV2aWV3IHN1Ym1pc3Npb25zIGluIG9mZmxpbmUtcmV2aWV3cyBJbmRleGVkREJcclxuICAgKiB3aGVuIGNvbm5lY3Rpdml0eSBpcyByZWVzdGFibGlzaGVkLCBpdCB3aWxsIGNhbGwgdGhlIGZ1bmN0aW9uIHRvIHNob3cgbmV3IHJldmlld3Mgb24gdGhlIHBhZ2VcclxuICAqL1xyXG4gIHN0YXRpYyBvbkdvT25saW5lKCkge1xyXG4gICAgY29uc29sZS5sb2coJ0dvaW5nIG9ubGluZScpO1xyXG4gICAgREJIZWxwZXIuY3JlYXRlT2ZmbGluZVJldmlldygpO1xyXG4gIH1cclxuXHJcbiAgc3RhdGljIG9uR29PZmZsaW5lKCkge1xyXG4gICAgY29uc29sZS5sb2coJ0dvaW5nIG9mZmxpbmUnKTtcclxuICB9XHJcbn1cclxuXHJcbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdvbmxpbmUnLCBEQkhlbHBlci5vbkdvT25saW5lKTtcclxud2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ29mZmxpbmUnLCBEQkhlbHBlci5vbkdvT2ZmbGluZSk7XHJcblxyXG4vKiBAcmVnaXN0ZXIgU2VydmljZVdvcmtlciB0byBjYWNoZSBkYXRhIGZvciB0aGUgc2l0ZVxyXG4gICAqIHRvIGFsbG93IGFueSBwYWdlIHRoYXQgaGFzIGJlZW4gdmlzaXRlZCBpcyBhY2Nlc3NpYmxlIG9mZmxpbmVcclxuICAgKi9cclxubmF2aWdhdG9yLnNlcnZpY2VXb3JrZXIucmVnaXN0ZXIoJy4vc3cuanMnKVxyXG4gIC50aGVuKGZ1bmN0aW9uKHJlZykge1xyXG4gIC8vIFJlZ2lzdHJhdGlvbiB3YXMgc3VjY2Vzc2Z1bFxyXG4gICAgY29uc29sZS5sb2coJ1NlcnZpY2VXb3JrZXIgcmVnaXN0cmF0aW9uIHN1Y2Nlc3NmdWwgd2l0aCBzY29wZTogJywgcmVnLnNjb3BlKTtcclxuICAgIGlmICghbmF2aWdhdG9yLnNlcnZpY2VXb3JrZXIuY29udHJvbGxlcikge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBpZiAocmVnLndhaXRpbmcpIHtcclxuICAgICAgX3VwZGF0ZVJlYWR5KHJlZy53YWl0aW5nKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgaWYgKHJlZy5pbnN0YWxsaW5nKSB7XHJcbiAgICAgIF90cmFja0luc3RhbGxpbmcocmVnLmluc3RhbGxpbmcpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgcmVnLmFkZEV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWZvdW5kJywgZnVuY3Rpb24gKCkge1xyXG4gICAgICBfdHJhY2tJbnN0YWxsaW5nKHJlZy5pbnN0YWxsaW5nKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHZhciByZWZyZXNoaW5nO1xyXG4gICAgbmF2aWdhdG9yLnNlcnZpY2VXb3JrZXIuYWRkRXZlbnRMaXN0ZW5lcignY29udHJvbGxlcmNoYW5nZScsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgaWYgKHJlZnJlc2hpbmcpIHJldHVybjtcclxuICAgICAgcmVmcmVzaGluZyA9IHRydWU7XHJcbiAgICB9KTtcclxuICB9KVxyXG4gIC5jYXRjaChmdW5jdGlvbiAoKSB7XHJcbiAgICBjb25zb2xlLmxvZygnU2VydmljZSB3b3JrZXIgcmVnaXN0cmF0aW9uIGZhaWxlZCcpO1xyXG4gIH0pO1xyXG5cclxubGV0IF91cGRhdGVSZWFkeSA9ICh3b3JrZXIpID0+IHtcclxuICB3b3JrZXIucG9zdE1lc3NhZ2Uoe2FjdGlvbjogJ3NraXBXYWl0aW5nJ30pO1xyXG59O1xyXG5cclxubGV0ICBfdHJhY2tJbnN0YWxsaW5nID0gKHdvcmtlcikgPT4ge1xyXG4gIGxldCBpbmRleENvbnRyb2xsZXIgPSB0aGlzO1xyXG4gIHdvcmtlci5hZGRFdmVudExpc3RlbmVyKCdzdGF0ZUNoYW5nZScsIGZ1bmN0aW9uKCkge1xyXG4gICAgaWYgKHdvcmtlci5zdGF0ZSA9PSAnaW5zdGFsbGVkJykge1xyXG4gICAgICBpbmRleENvbnRyb2xsZXIuX3VwZGF0ZVJlYWR5KHdvcmtlcik7XHJcbiAgICB9XHJcbiAgfSk7XHJcbn07XHJcblxyXG5leHBvcnQgZGVmYXVsdCBEQkhlbHBlcjtcclxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQgREJIZWxwZXIgZnJvbSAnLi9kYmhlbHBlcic7XG5cbi8qKlxuICogQGluaXRpYWxpemUgR29vZ2xlIG1hcCwgY2FsbGVkIGZyb20gSFRNTC5cbiAqL1xuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgKCkgPT4ge1xuICBpbml0TWFwKCk7XG59KTtcblxubGV0IGluaXRNYXAgPSAoKSA9PiB7XG4gIGZldGNoUmVzdGF1cmFudEZyb21VUkwoKGVycm9yLCByZXN0YXVyYW50KSA9PiB7XG4gICAgaWYgKGVycm9yKSB7IC8vIEdvdCBhbiBlcnJvciFcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAodHlwZW9mIGdvb2dsZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgc2VsZi5tYXAgPSBuZXcgZ29vZ2xlLm1hcHMuTWFwKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtYXAnKSwge1xuICAgICAgICAgIHpvb206IDE2LFxuICAgICAgICAgIGNlbnRlcjogcmVzdGF1cmFudC5sYXRsbmcsXG4gICAgICAgICAgc2Nyb2xsd2hlZWw6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICBmaWxsQnJlYWRjcnVtYihzZWxmLnJlc3RhdXJhbnQpO1xuICAgICAgICBEQkhlbHBlci5tYXBNYXJrZXJGb3JSZXN0YXVyYW50KHNlbGYucmVzdGF1cmFudCwgc2VsZi5tYXApO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG59O1xuXG53aW5kb3cuZ21fYXV0aEZhaWx1cmUgPSAoKSA9PiB7XG4gIGNvbnN0IG1hcFZpZXcgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWFwLWNvbnRhaW5lcicpO1xuICBtYXBWaWV3LmlubmVySFRNTCA9ICc8cCBpZD1cImVycm9yLW1hcFwiPkF1dGhlbnRpY2F0aW9uIEVycm9yIHdpdGggR29vZ2xlIE1hcCE8L3A+Jztcbn07XG5cbi8qKlxuICogQGFkZCByZXN0YXVyYW50IG5hbWUgdG8gdGhlIGJyZWFkY3J1bWIgbmF2aWdhdGlvbiBtZW51XG4gKi9cbmxldCBmaWxsQnJlYWRjcnVtYiA9IChyZXN0YXVyYW50KSA9PiB7XG4gIGNvbnN0IGJyZWFkY3J1bWIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnJlYWRjcnVtYicpO1xuXG4gIGNvbnN0IGxpTmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJyk7XG4gIGxpTmFtZS5pbm5lckhUTUwgPSByZXN0YXVyYW50Lm5hbWU7XG4gIGxpTmFtZS5jbGFzc05hbWUgPSAnYnJlYWRjcnVtLW5hbWUnO1xuICBicmVhZGNydW1iLmFwcGVuZChsaU5hbWUpO1xuXG4gIGNvbnN0IGxpSWNvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJyk7XG4gIC8vZ2V0IGZpbGxGYXZvcml0ZXNIVE1MKCkgZnJvbSBtYWluLmpzXG4gIGxpSWNvbi5hcHBlbmQoREJIZWxwZXIuZmlsbEZhdm9yaXRlc0hUTUwocmVzdGF1cmFudCkpO1xuXG4gIGJyZWFkY3J1bWIuYXBwZW5kKGxpSWNvbik7XG59O1xuXG4vKipcbiAqIEBnZXQgYSBwYXJhbWV0ZXIgYnkgbmFtZSBmcm9tIHBhZ2UgVVJMLlxuICovXG5sZXQgZ2V0UGFyYW1ldGVyQnlOYW1lID0gKG5hbWUsIHVybCkgPT4ge1xuICBpZiAoIXVybClcbiAgICB1cmwgPSB3aW5kb3cubG9jYXRpb24uaHJlZjtcbiAgbmFtZSA9IG5hbWUucmVwbGFjZSgvW1tcXF1dL2csICdcXFxcJCYnKTtcbiAgY29uc3QgcmVnZXggPSBuZXcgUmVnRXhwKGBbPyZdJHtuYW1lfSg9KFteJiNdKil8JnwjfCQpYCksXG4gICAgcmVzdWx0cyA9IHJlZ2V4LmV4ZWModXJsKTtcbiAgaWYgKCFyZXN1bHRzKVxuICAgIHJldHVybiBudWxsO1xuICBpZiAoIXJlc3VsdHNbMl0pXG4gICAgcmV0dXJuICcnO1xuICByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KHJlc3VsdHNbMl0ucmVwbGFjZSgvXFwrL2csICcgJykpO1xufTtcblxuLyoqXG4gKiBAZ2V0IGN1cnJlbnQgcmVzdGF1cmFudCBmcm9tIHBhZ2UgVVJMLlxuICovXG5sZXQgZmV0Y2hSZXN0YXVyYW50RnJvbVVSTCA9IChjYWxsYmFjaykgPT4ge1xuICBpZiAoc2VsZi5yZXN0YXVyYW50KSB7IC8vIHJlc3RhdXJhbnQgYWxyZWFkeSBmZXRjaGVkIVxuICAgIGNhbGxiYWNrKG51bGwsIHNlbGYucmVzdGF1cmFudCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IGlkID0gZ2V0UGFyYW1ldGVyQnlOYW1lKCdpZCcpO1xuICBpZiAoIWlkKSB7IC8vIG5vIGlkIGZvdW5kIGluIFVSTFxuICAgIGNvbnN0IGVycm9yID0gJ05vIHJlc3RhdXJhbnQgaWQgaW4gVVJMJztcbiAgICBjYWxsYmFjayhlcnJvciwgbnVsbCk7XG4gIH0gZWxzZSB7XG4gICAgREJIZWxwZXIuZmV0Y2hSZXN0YXVyYW50QnlJZChpZCwgKGVycm9yLCByZXN0YXVyYW50KSA9PiB7XG4gICAgICBzZWxmLnJlc3RhdXJhbnQgPSByZXN0YXVyYW50O1xuICAgICAgaWYgKCFyZXN0YXVyYW50KSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBEQkhlbHBlci5mZXRjaFJlc3RhdXJhbnRSZXZpZXdzKHNlbGYucmVzdGF1cmFudCwgKGVycm9yLCByZXZpZXdzKSA9PiB7XG4gICAgICAgIHNlbGYucmVzdGF1cmFudC5yZXZpZXdzID0gcmV2aWV3cztcblxuICAgICAgICBpZiAoIXJldmlld3MpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhlcnJvcik7XG4gICAgICAgIH1cbiAgICAgICAgZmlsbFJlc3RhdXJhbnRIVE1MKHNlbGYucmVzdGF1cmFudCk7XG4gICAgICB9KTtcbiAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3RhdXJhbnQpO1xuICAgIH0pO1xuICB9XG59O1xuXG4vKipcbiAqIEBjcmVhdGUgcmVzdGF1cmFudCBIVE1MIGFuZCBhZGQgaXQgdG8gdGhlIHdlYnBhZ2VcbiAqL1xubGV0IGZpbGxSZXN0YXVyYW50SFRNTCA9IChyZXN0YXVyYW50KSA9PiB7XG4gIGNvbnN0IG5hbWUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVzdGF1cmFudC1uYW1lJyk7XG4gIG5hbWUuaW5uZXJIVE1MID0gcmVzdGF1cmFudC5uYW1lO1xuICBuYW1lLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnMCcpO1xuXG4gIGNvbnN0IGltYWdlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc3RhdXJhbnQtaW1nJyk7XG4gIGltYWdlLnNyYyA9IERCSGVscGVyLmltYWdlVXJsRm9yUmVzdGF1cmFudChyZXN0YXVyYW50KTtcbiAgaW1hZ2UuYWx0ID0gYCR7cmVzdGF1cmFudC5uYW1lfSBpcyB0aGUgJHtyZXN0YXVyYW50LmN1aXNpbmVfdHlwZX0gcmVzdGF1cmFudGA7XG4gIGltYWdlLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnMCcpO1xuXG4gIGNvbnN0IGN1aXNpbmUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVzdGF1cmFudC1jdWlzaW5lJyk7XG4gIGN1aXNpbmUuaW5uZXJIVE1MID0gcmVzdGF1cmFudC5jdWlzaW5lX3R5cGU7XG4gIGN1aXNpbmUuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsICcwJyk7XG5cbiAgY29uc3QgYWRkcmVzcyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXN0YXVyYW50LWFkZHJlc3MnKTtcbiAgYWRkcmVzcy5pbm5lckhUTUwgPSByZXN0YXVyYW50LmFkZHJlc3M7XG4gIGFkZHJlc3Muc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsICcwJyk7XG5cbiAgLy8gZmlsbCBvcGVyYXRpbmcgaG91cnNcbiAgZmlsbFJlc3RhdXJhbnRIb3Vyc0hUTUwocmVzdGF1cmFudC5vcGVyYXRpbmdfaG91cnMpO1xuXG4gIC8vIGZpbGwgcmV2aWV3c1xuICBmaWxsUmV2aWV3c0hUTUwocmVzdGF1cmFudC5yZXZpZXdzKTtcbn07XG5cbi8qKlxuICogQGNyZWF0ZSByZXN0YXVyYW50IG9wZXJhdGluZyBob3VycyBIVE1MIHRhYmxlIGFuZCBhZGQgaXQgdG8gdGhlIHdlYnBhZ2UuXG4gKi9cbmxldCBmaWxsUmVzdGF1cmFudEhvdXJzSFRNTCA9IChvcGVyYXRpbmdIb3VycykgPT4ge1xuICBjb25zdCBob3VycyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXN0YXVyYW50LWhvdXJzJyk7XG4gIGhvdXJzLmlubmVySFRNTCA9ICcnO1xuICBmb3IgKGxldCBrZXkgaW4gb3BlcmF0aW5nSG91cnMpIHtcbiAgICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0cicpO1xuICAgIHJvdy5jbGFzc05hbWUgPSAndGFibGUtcm93JztcblxuICAgIGNvbnN0IGRheSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RkJyk7XG4gICAgZGF5LmlubmVySFRNTCA9IGtleTtcbiAgICBkYXkuY2xhc3NOYW1lID0gJ2RheS1jb2wnO1xuICAgIGRheS5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJzAnKTtcblxuICAgIHJvdy5hcHBlbmQoZGF5KTtcblxuICAgIGNvbnN0IHRpbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZCcpO1xuICAgIHRpbWUuaW5uZXJIVE1MID0gb3BlcmF0aW5nSG91cnNba2V5XTtcbiAgICB0aW1lLmNsYXNzTmFtZSA9ICd0aW1lLWNvbCc7XG4gICAgdGltZS5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJzAnKTtcbiAgICByb3cuYXBwZW5kKHRpbWUpO1xuXG4gICAgaG91cnMuYXBwZW5kKHJvdyk7XG4gIH1cbn07XG5cbi8qKlxuICogQGNyZWF0ZSBhbGwgcmV2aWV3cyBIVE1MIGFuZCBhZGQgdGhlbSB0byB0aGUgd2VicGFnZS5cbiAqL1xubGV0IGZpbGxSZXZpZXdzSFRNTCA9IChyZXZpZXdzKSA9PiB7XG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXZpZXdzLWNvbnRhaW5lcicpO1xuICBjb250YWluZXIuaW5uZXJIVE1MID0gJyc7XG5cbiAgY29uc3QgdWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd1bCcpO1xuICB1bC5pZCA9ICdyZXZpZXdzLWxpc3QnO1xuICBjb250YWluZXIuYXBwZW5kKHVsKTtcblxuICBjb25zdCB0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2gzJyk7XG4gIHRpdGxlLmlubmVySFRNTCA9ICdSZXZpZXdzJztcbiAgdGl0bGUuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsICcwJyk7XG4gIGNvbnRhaW5lci5hcHBlbmQodGl0bGUpO1xuXG4gIGlmICghcmV2aWV3cykge1xuICAgIGNvbnN0IG5vUmV2aWV3cyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3AnKTtcbiAgICBub1Jldmlld3MuaW5uZXJIVE1MID0gJ05vIHJldmlld3MgeWV0ISc7XG4gICAgY29udGFpbmVyLmFwcGVuZChub1Jldmlld3MpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGxldCBzb3J0ZWRSZXZpZXdzID0gcmV2aWV3cy5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICByZXR1cm4gbmV3IERhdGUoYi51cGRhdGVkQXQpIC0gbmV3IERhdGUoYS51cGRhdGVkQXQpO1xuICB9KTtcblxuICBzb3J0ZWRSZXZpZXdzLmZvckVhY2gocmV2aWV3ID0+IHtcbiAgICB1bC5hcHBlbmQoY3JlYXRlUmV2aWV3SFRNTChyZXZpZXcpKTtcbiAgfSk7XG4gIGNvbnRhaW5lci5hcHBlbmQodWwpO1xufTtcblxuLyoqXG4gKiBAY3JlYXRlIHJldmlldyBIVE1MIGFuZCBhZGQgaXQgdG8gdGhlIHdlYnBhZ2UuXG4gKi9cbmxldCBjcmVhdGVSZXZpZXdIVE1MID0gKHJldmlldykgPT4ge1xuICBjb25zdCBsaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJyk7XG4gIGNvbnN0IGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBjb25zdCBuYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgncCcpO1xuICBuYW1lLmlubmVySFRNTCA9IHJldmlldy5uYW1lO1xuICBuYW1lLmNsYXNzTmFtZSA9ICdyZXZpZXctbmFtZSc7XG4gIG5hbWUuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsICcwJyk7XG5cbiAgZGl2LmFwcGVuZChuYW1lKTtcblxuICBjb25zdCBkYXRlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgncCcpO1xuICBkYXRlLmlubmVySFRNTCA9IG5ldyBEYXRlKHJldmlldy51cGRhdGVkQXQpLnRvRGF0ZVN0cmluZygpO1xuICBkYXRlLmNsYXNzTmFtZSA9ICdyZXZpZXctZGF0ZSc7XG4gIGRhdGUuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsICcwJyk7XG5cbiAgZGl2LmFwcGVuZChkYXRlKTtcbiAgbGkuYXBwZW5kKGRpdik7XG5cbiAgY29uc3QgcmF0aW5nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgncCcpO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcmV2aWV3LnJhdGluZzsgaSsrKSB7XG4gICAgY29uc3QgaWNvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2knKTtcbiAgICBpY29uLmNsYXNzTmFtZSA9ICdmYXMgZmEtc3Rhcic7XG4gICAgcmF0aW5nLmFwcGVuZChpY29uKTtcbiAgfVxuXG4gIGxpLmFwcGVuZChyYXRpbmcpO1xuXG4gIGNvbnN0IGNvbW1lbnRzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgncCcpO1xuICBjb21tZW50cy5pbm5lckhUTUwgPSByZXZpZXcuY29tbWVudHM7XG4gIGNvbW1lbnRzLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnMCcpO1xuICBsaS5hcHBlbmQoY29tbWVudHMpO1xuXG4gIHJldHVybiBsaTtcbn07XG5cbi8qKlxuICAgKiBAc2hvdyBtZXNzYWdlcyBhbmQgaGlkZSB3aGVuIHRoZSBidXR0b24gaXMgY2xpY2tlZFxuICAgKi9cbmxldCBzaG93TWVzc2FnZSA9ICgpID0+IHtcbiAgbGV0IG1vZGFsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21vZGFsLW92ZXJsYXknKTtcbiAgbGV0IG1vZGFsTWVzc2FnZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtb2RhbC1tZXNzYWdlJyk7XG5cbiAgbW9kYWxNZXNzYWdlLmlubmVySFRNTCA9ICdZb3UgYXJlIG9mZmxpbmUgcmlnaHQgbm93LCB0aGUgcmV2aWV3IHdpbGwgYmUgc2VudCB3aGVuIHlvdSBhcmUgb25saW5lIGxhdGVyJztcbiAgbW9kYWwuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cbiAgbGV0IGJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidHRuLWNsb3NlJyk7XG4gIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgIG1vZGFsLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBAc3VibWl0IHRoZSBmb3JtLCBzZW5kIHRvIHRoZSBzZXJ2ZXIsIGFuZCBzaG93IGl0IG9uIGEgcGFnZVxuICovXG5cbmNvbnN0IGZvcm0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmV2aWV3LWZvcm0nKTtcblxuZm9ybS5hZGRFdmVudExpc3RlbmVyKCdzdWJtaXQnLCBmdW5jdGlvbihlKSB7XG4gIGUucHJldmVudERlZmF1bHQoKTtcbiAgbGV0IHJldmlldyA9IHtcbiAgICAncmVzdGF1cmFudF9pZCc6IHNlbGYucmVzdGF1cmFudC5pZFxuICB9O1xuICBjb25zdCBmb3JtRGF0YSA9IG5ldyBGb3JtRGF0YShmb3JtKTtcbiAgZm9yIChsZXQgW2tleSwgdmFsdWVdIG9mIGZvcm1EYXRhLmVudHJpZXMoKSkge1xuICAgIHJldmlld1trZXldID0gdmFsdWU7XG4gIH1cbiAgaWYgKCFuYXZpZ2F0b3Iub25MaW5lKSB7XG4gICAgc2hvd01lc3NhZ2UoKTtcbiAgfVxuICBEQkhlbHBlci5jcmVhdGVSZXN0YXVyYW50UmV2aWV3KHJldmlldylcbiAgICAudGhlbigoKSA9PiB7XG4gICAgICBmb3JtLnJlc2V0KCk7XG4gICAgICBEQkhlbHBlci5mZXRjaFJlc3RhdXJhbnRSZXZpZXdzKHNlbGYucmVzdGF1cmFudCwgKGVycm9yLCByZXZpZXdzKSA9PiB7XG4gICAgICAgIGlmICghcmV2aWV3cykge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgICBmaWxsUmV2aWV3c0hUTUwocmV2aWV3cyk7XG4gICAgICB9KTtcbiAgICB9KVxuICAgIC5jYXRjaChlcnJvciA9PiBjb25zb2xlLmVycm9yKCdlcnInLCBlcnJvcikpO1xufSk7XG5cblxuIiwiJ3VzZSBzdHJpY3QnO1xuXG4oZnVuY3Rpb24oKSB7XG4gIGZ1bmN0aW9uIHRvQXJyYXkoYXJyKSB7XG4gICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFycik7XG4gIH1cblxuICBmdW5jdGlvbiBwcm9taXNpZnlSZXF1ZXN0KHJlcXVlc3QpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICByZXF1ZXN0Lm9uc3VjY2VzcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXNvbHZlKHJlcXVlc3QucmVzdWx0KTtcbiAgICAgIH07XG5cbiAgICAgIHJlcXVlc3Qub25lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZWplY3QocmVxdWVzdC5lcnJvcik7XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJvbWlzaWZ5UmVxdWVzdENhbGwob2JqLCBtZXRob2QsIGFyZ3MpIHtcbiAgICB2YXIgcmVxdWVzdDtcbiAgICB2YXIgcCA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgcmVxdWVzdCA9IG9ialttZXRob2RdLmFwcGx5KG9iaiwgYXJncyk7XG4gICAgICBwcm9taXNpZnlSZXF1ZXN0KHJlcXVlc3QpLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICB9KTtcblxuICAgIHAucmVxdWVzdCA9IHJlcXVlc3Q7XG4gICAgcmV0dXJuIHA7XG4gIH1cblxuICBmdW5jdGlvbiBwcm9taXNpZnlDdXJzb3JSZXF1ZXN0Q2FsbChvYmosIG1ldGhvZCwgYXJncykge1xuICAgIHZhciBwID0gcHJvbWlzaWZ5UmVxdWVzdENhbGwob2JqLCBtZXRob2QsIGFyZ3MpO1xuICAgIHJldHVybiBwLnRoZW4oZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIGlmICghdmFsdWUpIHJldHVybjtcbiAgICAgIHJldHVybiBuZXcgQ3Vyc29yKHZhbHVlLCBwLnJlcXVlc3QpO1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJveHlQcm9wZXJ0aWVzKFByb3h5Q2xhc3MsIHRhcmdldFByb3AsIHByb3BlcnRpZXMpIHtcbiAgICBwcm9wZXJ0aWVzLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFByb3h5Q2xhc3MucHJvdG90eXBlLCBwcm9wLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXNbdGFyZ2V0UHJvcF1bcHJvcF07XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgdGhpc1t0YXJnZXRQcm9wXVtwcm9wXSA9IHZhbDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBwcm94eVJlcXVlc3RNZXRob2RzKFByb3h5Q2xhc3MsIHRhcmdldFByb3AsIENvbnN0cnVjdG9yLCBwcm9wZXJ0aWVzKSB7XG4gICAgcHJvcGVydGllcy5mb3JFYWNoKGZ1bmN0aW9uKHByb3ApIHtcbiAgICAgIGlmICghKHByb3AgaW4gQ29uc3RydWN0b3IucHJvdG90eXBlKSkgcmV0dXJuO1xuICAgICAgUHJveHlDbGFzcy5wcm90b3R5cGVbcHJvcF0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHByb21pc2lmeVJlcXVlc3RDYWxsKHRoaXNbdGFyZ2V0UHJvcF0sIHByb3AsIGFyZ3VtZW50cyk7XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJveHlNZXRob2RzKFByb3h5Q2xhc3MsIHRhcmdldFByb3AsIENvbnN0cnVjdG9yLCBwcm9wZXJ0aWVzKSB7XG4gICAgcHJvcGVydGllcy5mb3JFYWNoKGZ1bmN0aW9uKHByb3ApIHtcbiAgICAgIGlmICghKHByb3AgaW4gQ29uc3RydWN0b3IucHJvdG90eXBlKSkgcmV0dXJuO1xuICAgICAgUHJveHlDbGFzcy5wcm90b3R5cGVbcHJvcF0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXNbdGFyZ2V0UHJvcF1bcHJvcF0uYXBwbHkodGhpc1t0YXJnZXRQcm9wXSwgYXJndW1lbnRzKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBwcm94eUN1cnNvclJlcXVlc3RNZXRob2RzKFByb3h5Q2xhc3MsIHRhcmdldFByb3AsIENvbnN0cnVjdG9yLCBwcm9wZXJ0aWVzKSB7XG4gICAgcHJvcGVydGllcy5mb3JFYWNoKGZ1bmN0aW9uKHByb3ApIHtcbiAgICAgIGlmICghKHByb3AgaW4gQ29uc3RydWN0b3IucHJvdG90eXBlKSkgcmV0dXJuO1xuICAgICAgUHJveHlDbGFzcy5wcm90b3R5cGVbcHJvcF0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHByb21pc2lmeUN1cnNvclJlcXVlc3RDYWxsKHRoaXNbdGFyZ2V0UHJvcF0sIHByb3AsIGFyZ3VtZW50cyk7XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gSW5kZXgoaW5kZXgpIHtcbiAgICB0aGlzLl9pbmRleCA9IGluZGV4O1xuICB9XG5cbiAgcHJveHlQcm9wZXJ0aWVzKEluZGV4LCAnX2luZGV4JywgW1xuICAgICduYW1lJyxcbiAgICAna2V5UGF0aCcsXG4gICAgJ211bHRpRW50cnknLFxuICAgICd1bmlxdWUnXG4gIF0pO1xuXG4gIHByb3h5UmVxdWVzdE1ldGhvZHMoSW5kZXgsICdfaW5kZXgnLCBJREJJbmRleCwgW1xuICAgICdnZXQnLFxuICAgICdnZXRLZXknLFxuICAgICdnZXRBbGwnLFxuICAgICdnZXRBbGxLZXlzJyxcbiAgICAnY291bnQnXG4gIF0pO1xuXG4gIHByb3h5Q3Vyc29yUmVxdWVzdE1ldGhvZHMoSW5kZXgsICdfaW5kZXgnLCBJREJJbmRleCwgW1xuICAgICdvcGVuQ3Vyc29yJyxcbiAgICAnb3BlbktleUN1cnNvcidcbiAgXSk7XG5cbiAgZnVuY3Rpb24gQ3Vyc29yKGN1cnNvciwgcmVxdWVzdCkge1xuICAgIHRoaXMuX2N1cnNvciA9IGN1cnNvcjtcbiAgICB0aGlzLl9yZXF1ZXN0ID0gcmVxdWVzdDtcbiAgfVxuXG4gIHByb3h5UHJvcGVydGllcyhDdXJzb3IsICdfY3Vyc29yJywgW1xuICAgICdkaXJlY3Rpb24nLFxuICAgICdrZXknLFxuICAgICdwcmltYXJ5S2V5JyxcbiAgICAndmFsdWUnXG4gIF0pO1xuXG4gIHByb3h5UmVxdWVzdE1ldGhvZHMoQ3Vyc29yLCAnX2N1cnNvcicsIElEQkN1cnNvciwgW1xuICAgICd1cGRhdGUnLFxuICAgICdkZWxldGUnXG4gIF0pO1xuXG4gIC8vIHByb3h5ICduZXh0JyBtZXRob2RzXG4gIFsnYWR2YW5jZScsICdjb250aW51ZScsICdjb250aW51ZVByaW1hcnlLZXknXS5mb3JFYWNoKGZ1bmN0aW9uKG1ldGhvZE5hbWUpIHtcbiAgICBpZiAoIShtZXRob2ROYW1lIGluIElEQkN1cnNvci5wcm90b3R5cGUpKSByZXR1cm47XG4gICAgQ3Vyc29yLnByb3RvdHlwZVttZXRob2ROYW1lXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGN1cnNvciA9IHRoaXM7XG4gICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICBjdXJzb3IuX2N1cnNvclttZXRob2ROYW1lXS5hcHBseShjdXJzb3IuX2N1cnNvciwgYXJncyk7XG4gICAgICAgIHJldHVybiBwcm9taXNpZnlSZXF1ZXN0KGN1cnNvci5fcmVxdWVzdCkudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICAgIGlmICghdmFsdWUpIHJldHVybjtcbiAgICAgICAgICByZXR1cm4gbmV3IEN1cnNvcih2YWx1ZSwgY3Vyc29yLl9yZXF1ZXN0KTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9O1xuICB9KTtcblxuICBmdW5jdGlvbiBPYmplY3RTdG9yZShzdG9yZSkge1xuICAgIHRoaXMuX3N0b3JlID0gc3RvcmU7XG4gIH1cblxuICBPYmplY3RTdG9yZS5wcm90b3R5cGUuY3JlYXRlSW5kZXggPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IEluZGV4KHRoaXMuX3N0b3JlLmNyZWF0ZUluZGV4LmFwcGx5KHRoaXMuX3N0b3JlLCBhcmd1bWVudHMpKTtcbiAgfTtcblxuICBPYmplY3RTdG9yZS5wcm90b3R5cGUuaW5kZXggPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IEluZGV4KHRoaXMuX3N0b3JlLmluZGV4LmFwcGx5KHRoaXMuX3N0b3JlLCBhcmd1bWVudHMpKTtcbiAgfTtcblxuICBwcm94eVByb3BlcnRpZXMoT2JqZWN0U3RvcmUsICdfc3RvcmUnLCBbXG4gICAgJ25hbWUnLFxuICAgICdrZXlQYXRoJyxcbiAgICAnaW5kZXhOYW1lcycsXG4gICAgJ2F1dG9JbmNyZW1lbnQnXG4gIF0pO1xuXG4gIHByb3h5UmVxdWVzdE1ldGhvZHMoT2JqZWN0U3RvcmUsICdfc3RvcmUnLCBJREJPYmplY3RTdG9yZSwgW1xuICAgICdwdXQnLFxuICAgICdhZGQnLFxuICAgICdkZWxldGUnLFxuICAgICdjbGVhcicsXG4gICAgJ2dldCcsXG4gICAgJ2dldEFsbCcsXG4gICAgJ2dldEtleScsXG4gICAgJ2dldEFsbEtleXMnLFxuICAgICdjb3VudCdcbiAgXSk7XG5cbiAgcHJveHlDdXJzb3JSZXF1ZXN0TWV0aG9kcyhPYmplY3RTdG9yZSwgJ19zdG9yZScsIElEQk9iamVjdFN0b3JlLCBbXG4gICAgJ29wZW5DdXJzb3InLFxuICAgICdvcGVuS2V5Q3Vyc29yJ1xuICBdKTtcblxuICBwcm94eU1ldGhvZHMoT2JqZWN0U3RvcmUsICdfc3RvcmUnLCBJREJPYmplY3RTdG9yZSwgW1xuICAgICdkZWxldGVJbmRleCdcbiAgXSk7XG5cbiAgZnVuY3Rpb24gVHJhbnNhY3Rpb24oaWRiVHJhbnNhY3Rpb24pIHtcbiAgICB0aGlzLl90eCA9IGlkYlRyYW5zYWN0aW9uO1xuICAgIHRoaXMuY29tcGxldGUgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIGlkYlRyYW5zYWN0aW9uLm9uY29tcGxldGUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgfTtcbiAgICAgIGlkYlRyYW5zYWN0aW9uLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVqZWN0KGlkYlRyYW5zYWN0aW9uLmVycm9yKTtcbiAgICAgIH07XG4gICAgICBpZGJUcmFuc2FjdGlvbi5vbmFib3J0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlamVjdChpZGJUcmFuc2FjdGlvbi5lcnJvcik7XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgVHJhbnNhY3Rpb24ucHJvdG90eXBlLm9iamVjdFN0b3JlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBPYmplY3RTdG9yZSh0aGlzLl90eC5vYmplY3RTdG9yZS5hcHBseSh0aGlzLl90eCwgYXJndW1lbnRzKSk7XG4gIH07XG5cbiAgcHJveHlQcm9wZXJ0aWVzKFRyYW5zYWN0aW9uLCAnX3R4JywgW1xuICAgICdvYmplY3RTdG9yZU5hbWVzJyxcbiAgICAnbW9kZSdcbiAgXSk7XG5cbiAgcHJveHlNZXRob2RzKFRyYW5zYWN0aW9uLCAnX3R4JywgSURCVHJhbnNhY3Rpb24sIFtcbiAgICAnYWJvcnQnXG4gIF0pO1xuXG4gIGZ1bmN0aW9uIFVwZ3JhZGVEQihkYiwgb2xkVmVyc2lvbiwgdHJhbnNhY3Rpb24pIHtcbiAgICB0aGlzLl9kYiA9IGRiO1xuICAgIHRoaXMub2xkVmVyc2lvbiA9IG9sZFZlcnNpb247XG4gICAgdGhpcy50cmFuc2FjdGlvbiA9IG5ldyBUcmFuc2FjdGlvbih0cmFuc2FjdGlvbik7XG4gIH1cblxuICBVcGdyYWRlREIucHJvdG90eXBlLmNyZWF0ZU9iamVjdFN0b3JlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBPYmplY3RTdG9yZSh0aGlzLl9kYi5jcmVhdGVPYmplY3RTdG9yZS5hcHBseSh0aGlzLl9kYiwgYXJndW1lbnRzKSk7XG4gIH07XG5cbiAgcHJveHlQcm9wZXJ0aWVzKFVwZ3JhZGVEQiwgJ19kYicsIFtcbiAgICAnbmFtZScsXG4gICAgJ3ZlcnNpb24nLFxuICAgICdvYmplY3RTdG9yZU5hbWVzJ1xuICBdKTtcblxuICBwcm94eU1ldGhvZHMoVXBncmFkZURCLCAnX2RiJywgSURCRGF0YWJhc2UsIFtcbiAgICAnZGVsZXRlT2JqZWN0U3RvcmUnLFxuICAgICdjbG9zZSdcbiAgXSk7XG5cbiAgZnVuY3Rpb24gREIoZGIpIHtcbiAgICB0aGlzLl9kYiA9IGRiO1xuICB9XG5cbiAgREIucHJvdG90eXBlLnRyYW5zYWN0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBUcmFuc2FjdGlvbih0aGlzLl9kYi50cmFuc2FjdGlvbi5hcHBseSh0aGlzLl9kYiwgYXJndW1lbnRzKSk7XG4gIH07XG5cbiAgcHJveHlQcm9wZXJ0aWVzKERCLCAnX2RiJywgW1xuICAgICduYW1lJyxcbiAgICAndmVyc2lvbicsXG4gICAgJ29iamVjdFN0b3JlTmFtZXMnXG4gIF0pO1xuXG4gIHByb3h5TWV0aG9kcyhEQiwgJ19kYicsIElEQkRhdGFiYXNlLCBbXG4gICAgJ2Nsb3NlJ1xuICBdKTtcblxuICAvLyBBZGQgY3Vyc29yIGl0ZXJhdG9yc1xuICAvLyBUT0RPOiByZW1vdmUgdGhpcyBvbmNlIGJyb3dzZXJzIGRvIHRoZSByaWdodCB0aGluZyB3aXRoIHByb21pc2VzXG4gIFsnb3BlbkN1cnNvcicsICdvcGVuS2V5Q3Vyc29yJ10uZm9yRWFjaChmdW5jdGlvbihmdW5jTmFtZSkge1xuICAgIFtPYmplY3RTdG9yZSwgSW5kZXhdLmZvckVhY2goZnVuY3Rpb24oQ29uc3RydWN0b3IpIHtcbiAgICAgIC8vIERvbid0IGNyZWF0ZSBpdGVyYXRlS2V5Q3Vyc29yIGlmIG9wZW5LZXlDdXJzb3IgZG9lc24ndCBleGlzdC5cbiAgICAgIGlmICghKGZ1bmNOYW1lIGluIENvbnN0cnVjdG9yLnByb3RvdHlwZSkpIHJldHVybjtcblxuICAgICAgQ29uc3RydWN0b3IucHJvdG90eXBlW2Z1bmNOYW1lLnJlcGxhY2UoJ29wZW4nLCAnaXRlcmF0ZScpXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgYXJncyA9IHRvQXJyYXkoYXJndW1lbnRzKTtcbiAgICAgICAgdmFyIGNhbGxiYWNrID0gYXJnc1thcmdzLmxlbmd0aCAtIDFdO1xuICAgICAgICB2YXIgbmF0aXZlT2JqZWN0ID0gdGhpcy5fc3RvcmUgfHwgdGhpcy5faW5kZXg7XG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmF0aXZlT2JqZWN0W2Z1bmNOYW1lXS5hcHBseShuYXRpdmVPYmplY3QsIGFyZ3Muc2xpY2UoMCwgLTEpKTtcbiAgICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICBjYWxsYmFjayhyZXF1ZXN0LnJlc3VsdCk7XG4gICAgICAgIH07XG4gICAgICB9O1xuICAgIH0pO1xuICB9KTtcblxuICAvLyBwb2x5ZmlsbCBnZXRBbGxcbiAgW0luZGV4LCBPYmplY3RTdG9yZV0uZm9yRWFjaChmdW5jdGlvbihDb25zdHJ1Y3Rvcikge1xuICAgIGlmIChDb25zdHJ1Y3Rvci5wcm90b3R5cGUuZ2V0QWxsKSByZXR1cm47XG4gICAgQ29uc3RydWN0b3IucHJvdG90eXBlLmdldEFsbCA9IGZ1bmN0aW9uKHF1ZXJ5LCBjb3VudCkge1xuICAgICAgdmFyIGluc3RhbmNlID0gdGhpcztcbiAgICAgIHZhciBpdGVtcyA9IFtdO1xuXG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSkge1xuICAgICAgICBpbnN0YW5jZS5pdGVyYXRlQ3Vyc29yKHF1ZXJ5LCBmdW5jdGlvbihjdXJzb3IpIHtcbiAgICAgICAgICBpZiAoIWN1cnNvcikge1xuICAgICAgICAgICAgcmVzb2x2ZShpdGVtcyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGl0ZW1zLnB1c2goY3Vyc29yLnZhbHVlKTtcblxuICAgICAgICAgIGlmIChjb3VudCAhPT0gdW5kZWZpbmVkICYmIGl0ZW1zLmxlbmd0aCA9PSBjb3VudCkge1xuICAgICAgICAgICAgcmVzb2x2ZShpdGVtcyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGN1cnNvci5jb250aW51ZSgpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH07XG4gIH0pO1xuXG4gIHZhciBleHAgPSB7XG4gICAgb3BlbjogZnVuY3Rpb24obmFtZSwgdmVyc2lvbiwgdXBncmFkZUNhbGxiYWNrKSB7XG4gICAgICB2YXIgcCA9IHByb21pc2lmeVJlcXVlc3RDYWxsKGluZGV4ZWREQiwgJ29wZW4nLCBbbmFtZSwgdmVyc2lvbl0pO1xuICAgICAgdmFyIHJlcXVlc3QgPSBwLnJlcXVlc3Q7XG5cbiAgICAgIGlmIChyZXF1ZXN0KSB7XG4gICAgICAgIHJlcXVlc3Qub251cGdyYWRlbmVlZGVkID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICBpZiAodXBncmFkZUNhbGxiYWNrKSB7XG4gICAgICAgICAgICB1cGdyYWRlQ2FsbGJhY2sobmV3IFVwZ3JhZGVEQihyZXF1ZXN0LnJlc3VsdCwgZXZlbnQub2xkVmVyc2lvbiwgcmVxdWVzdC50cmFuc2FjdGlvbikpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHAudGhlbihmdW5jdGlvbihkYikge1xuICAgICAgICByZXR1cm4gbmV3IERCKGRiKTtcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgZGVsZXRlOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgICByZXR1cm4gcHJvbWlzaWZ5UmVxdWVzdENhbGwoaW5kZXhlZERCLCAnZGVsZXRlRGF0YWJhc2UnLCBbbmFtZV0pO1xuICAgIH1cbiAgfTtcblxuICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGV4cDtcbiAgICBtb2R1bGUuZXhwb3J0cy5kZWZhdWx0ID0gbW9kdWxlLmV4cG9ydHM7XG4gIH1cbiAgZWxzZSB7XG4gICAgc2VsZi5pZGIgPSBleHA7XG4gIH1cbn0oKSk7XG4iXX0=
