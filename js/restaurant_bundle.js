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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9kYmhlbHBlci5qcyIsImpzL3Jlc3RhdXJhbnRfaW5mby5qcyIsIm5vZGVfbW9kdWxlcy9pZGIvbGliL2lkYi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBOzs7Ozs7OztBQUVBOzs7Ozs7OztBQUVBOzs7O0lBSU0sUTs7Ozs7Ozs7O0FBV0o7OzsyQ0FHOEIsVSxFQUFZLEcsRUFBSztBQUM3QyxlQUFTLGFBQVQ7QUFDQSxVQUFNLFNBQVMsSUFBSSxPQUFPLElBQVAsQ0FBWSxNQUFoQixDQUF1QjtBQUNwQyxrQkFBVSxXQUFXLE1BRGU7QUFFcEMsZUFBTyxXQUFXLElBRmtCO0FBR3BDLGFBQUssU0FBUyxnQkFBVCxDQUEwQixVQUExQixDQUgrQjtBQUlwQyxhQUFLLEdBSitCO0FBS3BDLG1CQUFXLE9BQU8sSUFBUCxDQUFZLFNBQVosQ0FBc0I7QUFMRyxPQUF2QixDQUFmO0FBT0EsYUFBTyxNQUFQO0FBQ0Q7QUFDRDs7Ozs7O29DQUd1QjtBQUNyQixhQUFPLElBQVAsQ0FBWSxLQUFaLENBQWtCLGVBQWxCLENBQWtDLEdBQWxDLEVBQXVDLE1BQXZDLEVBQStDLFlBQU07QUFDbkQsaUJBQVMsb0JBQVQsQ0FBOEIsUUFBOUIsRUFBd0MsQ0FBeEMsRUFBMkMsS0FBM0MsR0FBbUQsYUFBbkQ7QUFDRCxPQUZEO0FBR0Q7O0FBRUQ7Ozs7OzttQ0FHc0I7QUFDcEIsVUFBSSxDQUFDLFVBQVUsYUFBZixFQUE4QjtBQUM1QixlQUFPLFFBQVEsT0FBUixFQUFQO0FBQ0QsT0FGRCxNQUVPO0FBQ0wsZUFBTyxjQUFJLElBQUosQ0FBUyxhQUFULEVBQXdCLENBQXhCLEVBQTJCLFVBQUMsU0FBRCxFQUFlO0FBQy9DLG9CQUFVLGlCQUFWLENBQTRCLGFBQTVCLEVBQTJDLEVBQUUsU0FBUyxJQUFYLEVBQTNDO0FBQ0EsY0FBSSxjQUFjLFVBQVUsaUJBQVYsQ0FBNEIsU0FBNUIsRUFB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QTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuaW1wb3J0IGlkYiBmcm9tICdpZGInO1xyXG5cclxuLyoqXHJcbiAqIENvbW1vbiBkYXRhYmFzZSBoZWxwZXIgZnVuY3Rpb25zLlxyXG4gKi9cclxuXHJcbmNsYXNzIERCSGVscGVyIHtcclxuICAvKipcclxuICAgKiBEYXRhYmFzZSBVUkwuXHJcbiAgICogQ2hhbmdlIHRoaXMgdG8gcmVzdGF1cmFudHMuanNvbiBmaWxlIGxvY2F0aW9uIG9uIHlvdXIgc2VydmVyLlxyXG4gICAqL1xyXG4gIHN0YXRpYyBnZXQgREFUQUJBU0VfVVJMKCkge1xyXG4gICAgLy9jb25zdCBwb3J0ID0gMTMzNzsvLyBDaGFuZ2UgdGhpcyB0byB5b3VyIHNlcnZlciBwb3J0XHJcbiAgICAvL3JldHVybiBgaHR0cHM6Ly9yZXN0YXVyYW50LXJldmlld3MtYXBpLmhlcm9rdWFwcC5jb20vOiR7cG9ydH1gO1xyXG4gICAgcmV0dXJuICdodHRwczovL3Jlc3RhdXJhbnQtcmV2aWV3cy1hcGkuaGVyb2t1YXBwLmNvbSc7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBATWFwIG1hcmtlciBmb3IgYSByZXN0YXVyYW50LlxyXG4gICAqL1xyXG4gIHN0YXRpYyBtYXBNYXJrZXJGb3JSZXN0YXVyYW50KHJlc3RhdXJhbnQsIG1hcCkge1xyXG4gICAgREJIZWxwZXIuYWRkVGl0bGVUb01hcCgpO1xyXG4gICAgY29uc3QgbWFya2VyID0gbmV3IGdvb2dsZS5tYXBzLk1hcmtlcih7XHJcbiAgICAgIHBvc2l0aW9uOiByZXN0YXVyYW50LmxhdGxuZyxcclxuICAgICAgdGl0bGU6IHJlc3RhdXJhbnQubmFtZSxcclxuICAgICAgdXJsOiBEQkhlbHBlci51cmxGb3JSZXN0YXVyYW50KHJlc3RhdXJhbnQpLFxyXG4gICAgICBtYXA6IG1hcCxcclxuICAgICAgYW5pbWF0aW9uOiBnb29nbGUubWFwcy5BbmltYXRpb24uRFJPUFxyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gbWFya2VyO1xyXG4gIH1cclxuICAvKipcclxuICAgKiBAYWRkIGF0dHJpYnV0ZSB0aXRsZSB0byA8aWZyYW1lPiBpbiBHb29nbGUgTWFwIHRvIGltcHJvdmUgdGhlIGFjY2Vzc2liaWxpdHlcclxuICAgKi9cclxuICBzdGF0aWMgYWRkVGl0bGVUb01hcCgpIHtcclxuICAgIGdvb2dsZS5tYXBzLmV2ZW50LmFkZExpc3RlbmVyT25jZShtYXAsICdpZGxlJywgKCkgPT4ge1xyXG4gICAgICBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaWZyYW1lJylbMF0udGl0bGUgPSAnR29vZ2xlIE1hcHMnO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAb3BlbiBkYXRhYmFzZSB0byBzdG9yZSBkYXRhIHJldHJpZXZlZCBmcm9tIHRoZSBzZXJ2ZXIgaW4gaW5kZXhlZERCIEFQSVxyXG4gICAqL1xyXG4gIHN0YXRpYyBvcGVuRGF0YWJhc2UoKSB7XHJcbiAgICBpZiAoIW5hdmlnYXRvci5zZXJ2aWNlV29ya2VyKSB7XHJcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHJldHVybiBpZGIub3BlbigncmVzdGF1cmFudHMnLCAzLCAodXBncmFkZURiKSA9PiB7XHJcbiAgICAgICAgdXBncmFkZURiLmNyZWF0ZU9iamVjdFN0b3JlKCdyZXN0YXVyYW50cycsIHsga2V5UGF0aDogJ2lkJyB9KTtcclxuICAgICAgICBsZXQgcmV2aWV3U3RvcmUgPSB1cGdyYWRlRGIuY3JlYXRlT2JqZWN0U3RvcmUoJ3Jldmlld3MnLCB7IGtleVBhdGg6ICdpZCcgfSk7XHJcbiAgICAgICAgcmV2aWV3U3RvcmUuY3JlYXRlSW5kZXgoJ3Jlc3RhdXJhbnRfaWQnLCAncmVzdGF1cmFudF9pZCcsIHsgdW5pcXVlOiBmYWxzZSB9KTtcclxuICAgICAgICB1cGdyYWRlRGIuY3JlYXRlT2JqZWN0U3RvcmUoJ29mZmxpbmUtcmV2aWV3cycsIHsga2V5UGF0aDogJ3VwZGF0ZWRBdCcgfSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuICAvKipcclxuICAgKiBAZ2V0IGRhdGEgZnJvbSBhIHN0b3JlIGluIEluZGV4ZWREQiBpZiBpdCBpcyBhdmFpbGFibGVcclxuICAgKi9cclxuICBzdGF0aWMgZ2V0Q2FjaGVkSW5kZXhlZERCKHN0b3JlX25hbWUpIHtcclxuICAgIGxldCBkYlByb21pc2UgPSBEQkhlbHBlci5vcGVuRGF0YWJhc2UoKTtcclxuXHJcbiAgICByZXR1cm4gZGJQcm9taXNlLnRoZW4oZnVuY3Rpb24oZGIpIHtcclxuICAgICAgaWYoIWRiKSByZXR1cm47XHJcbiAgICAgIGxldCB0eCA9IGRiLnRyYW5zYWN0aW9uKHN0b3JlX25hbWUpO1xyXG4gICAgICBsZXQgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShzdG9yZV9uYW1lKTtcclxuICAgICAgcmV0dXJuIHN0b3JlLmdldEFsbCgpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAc3RvcmUgdGhlIGRhdGEgaW4gSW5kZXhlZERCIGFmdGVyIGZldGNoaW5nIGl0IGZyb20gdGhlIHNlcnZlclxyXG4gICAqIEBwYXJhbSBkYXRhczogYXJlIHJldHJpZXZlZCBmcm9tIHRoZSBzZXJ2ZXIsIHN0b3JlX25hbWU6IHtzdHJpbmd9XHJcbiAgICovXHJcbiAgc3RhdGljIHN0b3JlRGF0YUluZGV4ZWREYihkYXRhcywgc3RvcmVfbmFtZSkge1xyXG4gICAgbGV0IGRiUHJvbWlzZSA9IERCSGVscGVyLm9wZW5EYXRhYmFzZSgpO1xyXG5cclxuICAgIGRiUHJvbWlzZS50aGVuKGRiID0+IHtcclxuICAgICAgaWYgKCFkYikgcmV0dXJuO1xyXG4gICAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKHN0b3JlX25hbWUsICdyZWFkd3JpdGUnKTtcclxuICAgICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShzdG9yZV9uYW1lKTtcclxuXHJcbiAgICAgIGRhdGFzLmZvckVhY2goZGF0YSA9PiB7XHJcbiAgICAgICAgc3RvcmUucHV0KGRhdGEpO1xyXG4gICAgICB9KTtcclxuICAgICAgcmV0dXJuIHR4LmNvbXBsZXRlO1xyXG4gICAgfSk7XHJcbiAgfVxyXG4gIC8qKlxyXG4gICAqIEBmZXRjaCBhbGwgcmVzdGF1cmFudHMgZm9ybSBJbmRleGVkREIgaWYgdGhleSBleGlzdCBvdGhlcndpc2UgZmV0Y2ggZnJvbSB0aGUgc2VydmVyLlxyXG4gICAqL1xyXG4gIHN0YXRpYyBmZXRjaFJlc3RhdXJhbnRzKGNhbGxiYWNrKSB7XHJcbiAgICAvL2NoZWNrIGlmIGRhdGEgZXhpc3RzIGluIGluZGV4REIgQVBJIGlmIGl0IGRvZXMgcmV0dXJuIGNhbGxiYWNrXHJcbiAgICBEQkhlbHBlci5nZXRDYWNoZWRJbmRleGVkREIoJ3Jlc3RhdXJhbnRzJykudGhlbihyZXN1bHRzID0+IHtcclxuICAgICAgaWYgKHJlc3VsdHMgJiYgcmVzdWx0cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0cyk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gVXNlIGVsc2UgY29uZGl0aW9uIHRvIGF2b2lkIGZldGNoaW5nIGZyb20gc2FpbHMgc2VydmVyXHJcbiAgICAgICAgLy8gYmVjYXVzZSB1cGRhdGluZyBmYXZvcml0ZSBvbiB0aGUgc2FpbHMgc2VydmVyIGlzIG5vdCBwZXJzaXN0ZW50XHJcbiAgICAgICAgLy8gYW5kIHRvIGdldCBkYXRhIGZyb20gSW5kZXhlZERCIG9ubHlcclxuICAgICAgICBmZXRjaChgJHtEQkhlbHBlci5EQVRBQkFTRV9VUkx9L3Jlc3RhdXJhbnRzYClcclxuICAgICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSlcclxuICAgICAgICAgIC50aGVuKHJlc3RhdXJhbnRzID0+IHtcclxuICAgICAgICAgICAgLy9zdG9yZSBkYXRhIGluIGluZGV4REIgQVBJIGFmdGVyIGZldGNoaW5nXHJcbiAgICAgICAgICAgIERCSGVscGVyLnN0b3JlRGF0YUluZGV4ZWREYihyZXN0YXVyYW50cywgJ3Jlc3RhdXJhbnRzJyk7XHJcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhudWxsLCByZXN0YXVyYW50cyk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgICAgLmNhdGNoKGVyciA9PiB7XHJcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIgLCBudWxsKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcbiAgLyoqXHJcbiAgICogQGZldGNoIGFsbCByZXZpZXdzIGZvcm0gSW5kZXhlZERCIGlmIHRoZXkgZXhpc3Qgb3RoZXJ3aXNlIGZldGNoIGZyb20gdGhlIHNlcnZlci5cclxuICAgKi9cclxuICBzdGF0aWMgZmV0Y2hSZXN0YXVyYW50UmV2aWV3cyhyZXN0YXVyYW50LCBjYWxsYmFjaykge1xyXG4gICAgbGV0IGRiUHJvbWlzZSA9IERCSGVscGVyLm9wZW5EYXRhYmFzZSgpO1xyXG5cclxuICAgIGRiUHJvbWlzZS50aGVuKGRiID0+IHtcclxuICAgICAgaWYgKCFkYikgcmV0dXJuO1xyXG5cclxuICAgICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbigncmV2aWV3cycpO1xyXG4gICAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKCdyZXZpZXdzJyk7XHJcbiAgICAgIGNvbnN0IGluZGV4ID0gc3RvcmUuaW5kZXgoJ3Jlc3RhdXJhbnRfaWQnKTtcclxuXHJcbiAgICAgIGluZGV4LmdldEFsbChyZXN0YXVyYW50LmlkKS50aGVuKHJlc3VsdHMgPT4ge1xyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdHMpO1xyXG5cclxuICAgICAgICBpZiAoIW5hdmlnYXRvci5vbkxpbmUpIHtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZldGNoKGAke0RCSGVscGVyLkRBVEFCQVNFX1VSTH0vcmV2aWV3cy8/cmVzdGF1cmFudF9pZD0ke3Jlc3RhdXJhbnQuaWR9YClcclxuICAgICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24oKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICAgICAudGhlbihyZXZpZXdzID0+IHtcclxuICAgICAgICAgICAgLy9zdG9yZSBkYXRhIGluIGluZGV4REIgQVBJIGFmdGVyIGZldGNoaW5nXHJcbiAgICAgICAgICAgIGxldCByZXZpZXdzTGVuID0gcmV2aWV3cy5sZW5ndGg7XHJcbiAgICAgICAgICAgIGlmIChyZXZpZXdzTGVuID49IDI5KSB7XHJcbiAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZXZpZXdzTGVuIC0gMjA7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgREJIZWxwZXIuZGVsZXRlUmVzdGF1cmFudFJldmlld3MocmV2aWV3c1tpXS5pZCk7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIERCSGVscGVyLnN0b3JlRGF0YUluZGV4ZWREYihyZXZpZXdzLCAncmV2aWV3cycpO1xyXG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCByZXZpZXdzKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICAgICAuY2F0Y2goZXJyID0+IHtcclxuICAgICAgICAgICAgY2FsbGJhY2soZXJyICwgbnVsbCk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEBmZXRjaCBhIHJlc3RhdXJhbnQgYnkgaXRzIElELlxyXG4gICAqL1xyXG4gIHN0YXRpYyBmZXRjaFJlc3RhdXJhbnRCeUlkKGlkLCBjYWxsYmFjaykge1xyXG4gICAgLy8gZmV0Y2ggYWxsIHJlc3RhdXJhbnRzIHdpdGggcHJvcGVyIGVycm9yIGhhbmRsaW5nLlxyXG4gICAgREJIZWxwZXIuZmV0Y2hSZXN0YXVyYW50cygoZXJyb3IsIHJlc3RhdXJhbnRzKSA9PiB7XHJcbiAgICAgIGlmIChlcnJvcikge1xyXG4gICAgICAgIGNhbGxiYWNrKGVycm9yLCBudWxsKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zdCByZXN0YXVyYW50ID0gcmVzdGF1cmFudHMuZmluZChyID0+IHIuaWQgPT0gaWQpO1xyXG4gICAgICAgIGlmIChyZXN0YXVyYW50KSB7IC8vIEdvdCB0aGUgcmVzdGF1cmFudFxyXG4gICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdGF1cmFudCk7XHJcbiAgICAgICAgfSBlbHNlIHsgLy8gUmVzdGF1cmFudCBkb2VzIG5vdCBleGlzdCBpbiB0aGUgZGF0YWJhc2VcclxuICAgICAgICAgIGNhbGxiYWNrKCdSZXN0YXVyYW50IGRvZXMgbm90IGV4aXN0JywgbnVsbCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEBmZXRjaCByZXN0YXVyYW50cyBieSBhIGN1aXNpbmUgdHlwZSB3aXRoIHByb3BlciBlcnJvciBoYW5kbGluZy5cclxuICAgKi9cclxuICBzdGF0aWMgZmV0Y2hSZXN0YXVyYW50QnlDdWlzaW5lKGN1aXNpbmUsIGNhbGxiYWNrKSB7XHJcbiAgICAvLyBGZXRjaCBhbGwgcmVzdGF1cmFudHMgIHdpdGggcHJvcGVyIGVycm9yIGhhbmRsaW5nXHJcbiAgICBEQkhlbHBlci5mZXRjaFJlc3RhdXJhbnRzKChlcnJvciwgcmVzdGF1cmFudHMpID0+IHtcclxuICAgICAgaWYgKGVycm9yKSB7XHJcbiAgICAgICAgY2FsbGJhY2soZXJyb3IsIG51bGwpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIEZpbHRlciByZXN0YXVyYW50cyB0byBoYXZlIG9ubHkgZ2l2ZW4gY3Vpc2luZSB0eXBlXHJcbiAgICAgICAgY29uc3QgcmVzdWx0cyA9IHJlc3RhdXJhbnRzLmZpbHRlcihyID0+IHIuY3Vpc2luZV90eXBlID09IGN1aXNpbmUpO1xyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdHMpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEBmZXRjaCByZXN0YXVyYW50cyBieSBhIG5laWdoYm9yaG9vZCB3aXRoIHByb3BlciBlcnJvciBoYW5kbGluZy5cclxuICAgKi9cclxuICBzdGF0aWMgZmV0Y2hSZXN0YXVyYW50QnlOZWlnaGJvcmhvb2QobmVpZ2hib3Job29kLCBjYWxsYmFjaykge1xyXG4gICAgLy8gRmV0Y2ggYWxsIHJlc3RhdXJhbnRzXHJcbiAgICBEQkhlbHBlci5mZXRjaFJlc3RhdXJhbnRzKChlcnJvciwgcmVzdGF1cmFudHMpID0+IHtcclxuICAgICAgaWYgKGVycm9yKSB7XHJcbiAgICAgICAgY2FsbGJhY2soZXJyb3IsIG51bGwpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIEZpbHRlciByZXN0YXVyYW50cyB0byBoYXZlIG9ubHkgZ2l2ZW4gbmVpZ2hib3Job29kXHJcbiAgICAgICAgY29uc3QgcmVzdWx0cyA9IHJlc3RhdXJhbnRzLmZpbHRlcihyID0+IHIubmVpZ2hib3Job29kID09IG5laWdoYm9yaG9vZCk7XHJcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0cyk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQGZldGNoIHJlc3RhdXJhbnRzIGJ5IGEgY3Vpc2luZSBhbmQgYSBuZWlnaGJvcmhvb2Qgd2l0aCBwcm9wZXIgZXJyb3IgaGFuZGxpbmcuXHJcbiAgICovXHJcbiAgc3RhdGljIGZldGNoUmVzdGF1cmFudEJ5Q3Vpc2luZUFuZE5laWdoYm9yaG9vZChjdWlzaW5lLCBuZWlnaGJvcmhvb2QsIGNhbGxiYWNrKSB7XHJcbiAgICAvLyBGZXRjaCBhbGwgcmVzdGF1cmFudHNcclxuICAgIERCSGVscGVyLmZldGNoUmVzdGF1cmFudHMoKGVycm9yLCByZXN0YXVyYW50cykgPT4ge1xyXG4gICAgICBpZiAoZXJyb3IpIHtcclxuICAgICAgICBjYWxsYmFjayhlcnJvciwgbnVsbCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgbGV0IHJlc3VsdHMgPSByZXN0YXVyYW50cztcclxuICAgICAgICBpZiAoY3Vpc2luZSAhPSAnYWxsJykgeyAvLyBmaWx0ZXIgYnkgY3Vpc2luZVxyXG4gICAgICAgICAgcmVzdWx0cyA9IHJlc3VsdHMuZmlsdGVyKHIgPT4gci5jdWlzaW5lX3R5cGUgPT0gY3Vpc2luZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChuZWlnaGJvcmhvb2QgIT0gJ2FsbCcpIHsgLy8gZmlsdGVyIGJ5IG5laWdoYm9yaG9vZFxyXG4gICAgICAgICAgcmVzdWx0cyA9IHJlc3VsdHMuZmlsdGVyKHIgPT4gci5uZWlnaGJvcmhvb2QgPT0gbmVpZ2hib3Job29kKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0cyk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgc3RhdGljIGZldGNoUmVzdGF1cmFudEJ5Q3Vpc2luZU5laWdoYm9yaG9vZEFuZEZhdm9yaXRlKGN1aXNpbmUsIG5laWdoYm9yaG9vZCwgZmF2b3JpdGUsIGNhbGxiYWNrKSB7XHJcbiAgICAvLyBGZXRjaCBhbGwgcmVzdGF1cmFudHNcclxuICAgIERCSGVscGVyLmZldGNoUmVzdGF1cmFudHMoKGVycm9yLCByZXN0YXVyYW50cykgPT4ge1xyXG4gICAgICBpZiAoZXJyb3IpIHtcclxuICAgICAgICBjYWxsYmFjayhlcnJvciwgbnVsbCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgbGV0IHJlc3VsdHMgPSByZXN0YXVyYW50cztcclxuICAgICAgICBpZiAoY3Vpc2luZSAhPSAnYWxsJykgeyAvLyBmaWx0ZXIgYnkgY3Vpc2luZVxyXG4gICAgICAgICAgcmVzdWx0cyA9IHJlc3VsdHMuZmlsdGVyKHIgPT4gci5jdWlzaW5lX3R5cGUgPT0gY3Vpc2luZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChuZWlnaGJvcmhvb2QgIT0gJ2FsbCcpIHsgLy8gZmlsdGVyIGJ5IG5laWdoYm9yaG9vZFxyXG4gICAgICAgICAgcmVzdWx0cyA9IHJlc3VsdHMuZmlsdGVyKHIgPT4gci5uZWlnaGJvcmhvb2QgPT0gbmVpZ2hib3Job29kKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGZhdm9yaXRlID09ICd0cnVlJykge1xyXG4gICAgICAgICAgcmVzdWx0cyA9IHJlc3VsdHMuZmlsdGVyKHIgPT4gci5pc19mYXZvcml0ZSA9PSAndHJ1ZScpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHRzKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAZmV0Y2ggYWxsIG5laWdoYm9yaG9vZHMgd2l0aCBwcm9wZXIgZXJyb3IgaGFuZGxpbmcuXHJcbiAgICovXHJcbiAgc3RhdGljIGZldGNoTmVpZ2hib3Job29kcyhjYWxsYmFjaykge1xyXG4gICAgLy8gRmV0Y2ggYWxsIHJlc3RhdXJhbnRzXHJcbiAgICBEQkhlbHBlci5mZXRjaFJlc3RhdXJhbnRzKChlcnJvciwgcmVzdGF1cmFudHMpID0+IHtcclxuICAgICAgaWYgKGVycm9yKSB7XHJcbiAgICAgICAgY2FsbGJhY2soZXJyb3IsIG51bGwpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIEdldCBhbGwgbmVpZ2hib3Job29kcyBmcm9tIGFsbCByZXN0YXVyYW50c1xyXG4gICAgICAgIGNvbnN0IG5laWdoYm9yaG9vZHMgPSByZXN0YXVyYW50cy5tYXAoKHYsIGkpID0+IHJlc3RhdXJhbnRzW2ldLm5laWdoYm9yaG9vZCk7XHJcbiAgICAgICAgLy8gUmVtb3ZlIGR1cGxpY2F0ZXMgZnJvbSBuZWlnaGJvcmhvb2RzXHJcbiAgICAgICAgY29uc3QgdW5pcXVlTmVpZ2hib3Job29kcyA9IG5laWdoYm9yaG9vZHMuZmlsdGVyKCh2LCBpKSA9PiBuZWlnaGJvcmhvb2RzLmluZGV4T2YodikgPT0gaSk7XHJcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgdW5pcXVlTmVpZ2hib3Job29kcyk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQGZldGNoIGFsbCBjdWlzaW5lcyB3aXRoIHByb3BlciBlcnJvciBoYW5kbGluZy5cclxuICAgKi9cclxuICBzdGF0aWMgZmV0Y2hDdWlzaW5lcyhjYWxsYmFjaykge1xyXG4gICAgLy8gRmV0Y2ggYWxsIHJlc3RhdXJhbnRzXHJcbiAgICBEQkhlbHBlci5mZXRjaFJlc3RhdXJhbnRzKChlcnJvciwgcmVzdGF1cmFudHMpID0+IHtcclxuICAgICAgaWYgKGVycm9yKSB7XHJcbiAgICAgICAgY2FsbGJhY2soZXJyb3IsIG51bGwpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIEdldCBhbGwgY3Vpc2luZXMgZnJvbSBhbGwgcmVzdGF1cmFudHNcclxuICAgICAgICBjb25zdCBjdWlzaW5lcyA9IHJlc3RhdXJhbnRzLm1hcCgodiwgaSkgPT4gcmVzdGF1cmFudHNbaV0uY3Vpc2luZV90eXBlKTtcclxuICAgICAgICAvLyBSZW1vdmUgZHVwbGljYXRlcyBmcm9tIGN1aXNpbmVzXHJcbiAgICAgICAgY29uc3QgdW5pcXVlQ3Vpc2luZXMgPSBjdWlzaW5lcy5maWx0ZXIoKHYsIGkpID0+IGN1aXNpbmVzLmluZGV4T2YodikgPT0gaSk7XHJcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgdW5pcXVlQ3Vpc2luZXMpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEByZXN0YXVyYW50IHBhZ2UgVVJMLlxyXG4gICAqL1xyXG4gIHN0YXRpYyB1cmxGb3JSZXN0YXVyYW50KHJlc3RhdXJhbnQpIHtcclxuICAgIHJldHVybiAoYC4vcmVzdGF1cmFudC5odG1sP2lkPSR7cmVzdGF1cmFudC5pZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEByZXN0YXVyYW50IGltYWdlIFVSTC5cclxuICAgKi9cclxuICBzdGF0aWMgaW1hZ2VVcmxGb3JSZXN0YXVyYW50KHJlc3RhdXJhbnQpIHtcclxuICAgIGlmIChyZXN0YXVyYW50LnBob3RvZ3JhcGggPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICByZXN0YXVyYW50LnBob3RvZ3JhcGggPSAxMDtcclxuICAgIH1cclxuICAgIHJldHVybiAoYGltZy8ke3Jlc3RhdXJhbnQucGhvdG9ncmFwaH0ud2VicGApO1xyXG4gIH1cclxuXHJcbiAgc3RhdGljIGRlbGV0ZVJlc3RhdXJhbnRSZXZpZXdzKHJldmlld19pZCkge1xyXG4gICAgZmV0Y2goYCR7REJIZWxwZXIuREFUQUJBU0VfVVJMfS9yZXZpZXdzLyR7cmV2aWV3X2lkfWAsIHtcclxuICAgICAgbWV0aG9kOiAnREVMRVRFJ1xyXG4gICAgfSlcclxuICAgICAgLnRoZW4ocmVzcG9uc2UgPT4ge1xyXG4gICAgICAgIHJldHVybiByZXNwb25zZTtcclxuICAgICAgfSlcclxuICAgICAgLnRoZW4oZGF0YSA9PiB7XHJcbiAgICAgICAgcmV0dXJuIGRhdGE7XHJcbiAgICAgIH0pXHJcbiAgICAgIC5jYXRjaChlcnIgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdFcnJvcicsIGVycik7XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQHBvc3QgcmV2aWV3X2RhdGEgdG8gdGhlIHNlcnZlciB3aGVuIGEgdXNlciBzdWJtaXRzIGEgcmV2aWV3XHJcbiAgICogb25saW5lOiBrZWVwIGl0IGluIHRoZSByZXZpZXdzIHN0b3JlIGluIEluZGV4ZWREQlxyXG4gICAqIG9mZmxpbmU6IGtlZXAgaXQgaW4gdGhlIG9mZmxuZS1yZXZpZXdzIGluIEluZGV4ZWREQlxyXG4gICAqIEBwYXJhbSByZXZpZXdfZGF0YSBpcyBmcm9tIGEgdXNlciBmaWxscyBvdXQgdGhlIGZvcm1cclxuICAgKi9cclxuICBzdGF0aWMgY3JlYXRlUmVzdGF1cmFudFJldmlldyhyZXZpZXdfZGF0YSkge1xyXG4gICAgcmV0dXJuIGZldGNoKGAke0RCSGVscGVyLkRBVEFCQVNFX1VSTH0vcmV2aWV3c2AsIHtcclxuICAgICAgbWV0aG9kOiAnUE9TVCcsXHJcbiAgICAgIGNhY2hlOiAnbm8tY2FjaGUnLCAvLyAqZGVmYXVsdCwgbm8tY2FjaGUsIHJlbG9hZCwgZm9yY2UtY2FjaGUsIG9ubHktaWYtY2FjaGVkXHJcbiAgICAgIGNyZWRlbnRpYWxzOiAnc2FtZS1vcmlnaW4nLFxyXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZXZpZXdfZGF0YSksXHJcbiAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXHJcbiAgICAgIH0sXHJcbiAgICAgIG1vZGU6ICdjb3JzJyxcclxuICAgICAgcmVkaXJlY3Q6ICdmb2xsb3cnLFxyXG4gICAgICByZWZlcnJlcjogJ25vLXJlZmVycmVyJyxcclxuICAgIH0pXHJcbiAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcclxuICAgICAgICByZXNwb25zZS5qc29uKClcclxuICAgICAgICAgIC50aGVuKHJldmlld19kYXRhID0+IHtcclxuICAgICAgICAgIC8qIGtlZXAgZGF0YXMgaW4gSW5kZXhlZERCIGFmdGVyIHBvc3RpbmcgZGF0YSB0byB0aGUgc2VydmVyIHdoZW4gb25saW5lICovXHJcbiAgICAgICAgICAgIERCSGVscGVyLnN0b3JlRGF0YUluZGV4ZWREYihbcmV2aWV3X2RhdGFdLCAncmV2aWV3cycpO1xyXG4gICAgICAgICAgICByZXR1cm4gcmV2aWV3X2RhdGE7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgfSlcclxuICAgICAgLmNhdGNoKGVycm9yID0+IHtcclxuICAgICAgICByZXZpZXdfZGF0YVsndXBkYXRlZEF0J10gPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcclxuICAgICAgICAvKiBrZWVwIGRhdGFzIGluIEluZGV4ZWREQiBhZnRlciBwb3N0aW5nIGRhdGEgdG8gdGhlIHNlcnZlciB3aGVuIG9mZmxpbmUqL1xyXG4gICAgICAgIERCSGVscGVyLnN0b3JlRGF0YUluZGV4ZWREYihbcmV2aWV3X2RhdGFdLCAnb2ZmbGluZS1yZXZpZXdzJyk7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ1JldmlldyBzdG9yZWQgb2ZmbGluZSBpbiBJREInKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQGNsZWFyIGRhdGEgaW4gdGhlIG9mZmxpbmUtcmV2aWV3cyBzdG9yZVxyXG4gICAqL1xyXG4gIHN0YXRpYyBjbGVhck9mZmxpbmVSZXZpZXdzKCkge1xyXG4gICAgbGV0IGRiUHJvbWlzZSA9IERCSGVscGVyLm9wZW5EYXRhYmFzZSgpO1xyXG4gICAgZGJQcm9taXNlLnRoZW4oZGIgPT4ge1xyXG4gICAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKCdvZmZsaW5lLXJldmlld3MnLCAncmVhZHdyaXRlJyk7XHJcbiAgICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoJ29mZmxpbmUtcmV2aWV3cycpO1xyXG4gICAgICBzdG9yZS5jbGVhcigpO1xyXG4gICAgfSk7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAZ2V0IHJldmlld3MgZnJvbSBvZmZsaW5lLXN0b3JlcyBpbiBJbmRleGVkREIgd2hlbiBhIHVzZXIgZ28gZnJvbSBvZmZsaW5lIHRvIG9ubGluZVxyXG4gICAqL1xyXG4gIHN0YXRpYyBjcmVhdGVPZmZsaW5lUmV2aWV3KCkge1xyXG4gICAgREJIZWxwZXIub3BlbkRhdGFiYXNlKCkudGhlbihkYiA9PiB7XHJcbiAgICAgIGlmICghZGIpIHJldHVybjtcclxuICAgICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbignb2ZmbGluZS1yZXZpZXdzJywgJ3JlYWR3cml0ZScpO1xyXG4gICAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKCdvZmZsaW5lLXJldmlld3MnKTtcclxuXHJcbiAgICAgIHN0b3JlLmdldEFsbCgpLnRoZW4ob2ZmbGluZVJldmlld3MgPT4ge1xyXG4gICAgICAgIG9mZmxpbmVSZXZpZXdzLmZvckVhY2gocmV2aWV3ID0+IHtcclxuICAgICAgICAgIERCSGVscGVyLmNyZWF0ZVJlc3RhdXJhbnRSZXZpZXcocmV2aWV3KTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBEQkhlbHBlci5jbGVhck9mZmxpbmVSZXZpZXdzKCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG4gIC8qKlxyXG4gICAqQHdoZW4gb25saW5lIHVwZGF0ZSBhIHZhbHVlIG9mIGEgcmVzdGF1cmFudCdzIGZhdm9yaXRlIGJ5IHNlbmRpbmcgdGhlIFBVVCByZXF1ZXN0IHRvIHRoZSBzZXJ2ZXJcclxuICAgKmFuZCBzdG9yZSB0aGUgZGF0YSB0byBJbmRleGVkREIgc28gaXQgY2FuIGJlIHVzZWQgd2hlbiBvZmZsaW5lXHJcbiAgKi9cclxuICBzdGF0aWMgdG9nZ2xlRmF2b3JpdGUocmVzdGF1cmFudCwgaXNGYXZvcml0ZSkge1xyXG4gICAgcmV0dXJuIGZldGNoKGAke0RCSGVscGVyLkRBVEFCQVNFX1VSTH0vcmVzdGF1cmFudHMvJHtyZXN0YXVyYW50LmlkfS8/aXNfZmF2b3JpdGU9JHtpc0Zhdm9yaXRlfWAsIHtcclxuICAgICAgbWV0aG9kOiAnUFVUJyxcclxuICAgIH0pXHJcbiAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcclxuICAgICAgICBjb25zb2xlLmxvZyhgdXBkYXRlZCBBUEkgcmVzdGF1cmFudDogJHtyZXN0YXVyYW50LmlkfSBmYXZvcml0ZSA6ICR7aXNGYXZvcml0ZX1gKTtcclxuICAgICAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpO1xyXG4gICAgICB9KVxyXG4gICAgICAudGhlbihkYXRhID0+IHtcclxuICAgICAgICBEQkhlbHBlci5zdG9yZURhdGFJbmRleGVkRGIoW2RhdGFdLCAncmVzdGF1cmFudHMnKTtcclxuICAgICAgICBjb25zb2xlLmxvZyhgdXBkYXRlZCBJREIgcmVzdGF1cmFudDogJHtyZXN0YXVyYW50LmlkfSBmYXZvcml0ZSA6ICR7aXNGYXZvcml0ZX1gKTtcclxuICAgICAgICByZXR1cm4gZGF0YTtcclxuICAgICAgfSlcclxuICAgICAgLmNhdGNoKGVycm9yID0+IHtcclxuICAgICAgICAvLyBjb252ZXJ0IGZyb20gYm9vbGVhbiB0byBzdHJpbmcgYmVjYXVzZSB0aGUgQVBJIHVzZXMgc3RyaW5ncyAndHJ1ZScgYW5kICdmYWxzZSdcclxuICAgICAgICByZXN0YXVyYW50LmlzX2Zhdm9yaXRlID0gaXNGYXZvcml0ZSA/ICd0cnVlJyA6ICdmYWxzZSc7XHJcblxyXG4gICAgICAgIERCSGVscGVyLnN0b3JlRGF0YUluZGV4ZWREYihbcmVzdGF1cmFudF0sICdyZXN0YXVyYW50cycpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdzdG9yZSBmYXZvcml0ZSBvZmZsaW5lJyk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gKiBAZmlsbCBmYXZvcml0ZXMgaW4gSFRNTCBzbyBpdCBjYW4gYmUgdXNlZCBieSBib3RoIG1haW4gYW5kIHJlc3RhdXJhbnQgcGFnZVxyXG4gKi9cclxuICBzdGF0aWMgZmlsbEZhdm9yaXRlc0hUTUwocmVzdGF1cmFudCkge1xyXG4gICAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsYWJlbCcpO1xyXG4gICAgbGFiZWwuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0xhYmVsIGZvciBjaGVja2luZyBmYXZvcml0ZScpO1xyXG4gICAgbGFiZWwuY2xhc3NOYW1lID0gJ2Zhdi1jb250YWluZXInO1xyXG5cclxuICAgIGNvbnN0IGljb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpJyk7XHJcbiAgICBpY29uLmNsYXNzTmFtZSA9ICdmYXMgZmEtaGVhcnQnO1xyXG4gICAgbGFiZWwuYXBwZW5kKGljb24pO1xyXG5cclxuICAgIGNvbnN0IGlucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcclxuICAgIGlucHV0LnR5cGUgPSAnY2hlY2tib3gnO1xyXG4gICAgaW5wdXQuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ1NlbGVjdCBmYXZvcml0ZScpO1xyXG5cclxuICAgIGlmIChyZXN0YXVyYW50LmlzX2Zhdm9yaXRlID09ICd0cnVlJykge1xyXG4gICAgICBpY29uLnN0eWxlLmNvbG9yID0gJyNkMzJmMmYnO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgaWNvbi5zdHlsZS5jb2xvciA9ICcjYWViMGIxJztcclxuICAgIH1cclxuXHJcbiAgICBpbnB1dC5jaGVja2VkID0gKHJlc3RhdXJhbnQuaXNfZmF2b3JpdGUgID09ICd0cnVlJyk7XHJcbiAgICBpbnB1dC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBldmVudCA9PiB7XHJcbiAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgIGlmIChpbnB1dC5jaGVja2VkID09IHRydWUpIHtcclxuICAgICAgICBEQkhlbHBlci50b2dnbGVGYXZvcml0ZShyZXN0YXVyYW50LCBpbnB1dC5jaGVja2VkKTtcclxuICAgICAgICBpY29uLnN0eWxlLmNvbG9yID0gJyNkMzJmMmYnO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIERCSGVscGVyLnRvZ2dsZUZhdm9yaXRlKHJlc3RhdXJhbnQsIGlucHV0LmNoZWNrZWQpO1xyXG4gICAgICAgIGljb24uc3R5bGUuY29sb3IgPSAnI2FlYjBiMSc7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgbGFiZWwuYXBwZW5kKGlucHV0KTtcclxuICAgIHJldHVybiBsYWJlbDtcclxuICB9XHJcblxyXG4gIC8qQGNyZWF0ZSB0aGVzZSBmdW5jdGlvbnMgdG8gYWRkIG9ubGluZSBzdGF0dXMgdG8gdGhlIGJyb3dzZXJcclxuICAgKiB3aGVuIGl0IGlzIG9mZmxpbmUgaXQgd2lsbCBzdG9yZSByZXZpZXcgc3VibWlzc2lvbnMgaW4gb2ZmbGluZS1yZXZpZXdzIEluZGV4ZWREQlxyXG4gICAqIHdoZW4gY29ubmVjdGl2aXR5IGlzIHJlZXN0YWJsaXNoZWQsIGl0IHdpbGwgY2FsbCB0aGUgZnVuY3Rpb24gdG8gc2hvdyBuZXcgcmV2aWV3cyBvbiB0aGUgcGFnZVxyXG4gICovXHJcbiAgc3RhdGljIG9uR29PbmxpbmUoKSB7XHJcbiAgICBjb25zb2xlLmxvZygnR29pbmcgb25saW5lJyk7XHJcbiAgICBEQkhlbHBlci5jcmVhdGVPZmZsaW5lUmV2aWV3KCk7XHJcbiAgfVxyXG5cclxuICBzdGF0aWMgb25Hb09mZmxpbmUoKSB7XHJcbiAgICBjb25zb2xlLmxvZygnR29pbmcgb2ZmbGluZScpO1xyXG4gIH1cclxufVxyXG5cclxud2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ29ubGluZScsIERCSGVscGVyLm9uR29PbmxpbmUpO1xyXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignb2ZmbGluZScsIERCSGVscGVyLm9uR29PZmZsaW5lKTtcclxuXHJcbi8qIEByZWdpc3RlciBTZXJ2aWNlV29ya2VyIHRvIGNhY2hlIGRhdGEgZm9yIHRoZSBzaXRlXHJcbiAgICogdG8gYWxsb3cgYW55IHBhZ2UgdGhhdCBoYXMgYmVlbiB2aXNpdGVkIGlzIGFjY2Vzc2libGUgb2ZmbGluZVxyXG4gICAqL1xyXG5uYXZpZ2F0b3Iuc2VydmljZVdvcmtlci5yZWdpc3RlcignLi9zdy5qcycpXHJcbiAgLnRoZW4oZnVuY3Rpb24ocmVnKSB7XHJcbiAgLy8gUmVnaXN0cmF0aW9uIHdhcyBzdWNjZXNzZnVsXHJcbiAgICBjb25zb2xlLmxvZygnU2VydmljZVdvcmtlciByZWdpc3RyYXRpb24gc3VjY2Vzc2Z1bCB3aXRoIHNjb3BlOiAnLCByZWcuc2NvcGUpO1xyXG4gICAgaWYgKCFuYXZpZ2F0b3Iuc2VydmljZVdvcmtlci5jb250cm9sbGVyKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGlmIChyZWcud2FpdGluZykge1xyXG4gICAgICBfdXBkYXRlUmVhZHkocmVnLndhaXRpbmcpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBpZiAocmVnLmluc3RhbGxpbmcpIHtcclxuICAgICAgX3RyYWNrSW5zdGFsbGluZyhyZWcuaW5zdGFsbGluZyk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICByZWcuYWRkRXZlbnRMaXN0ZW5lcigndXBkYXRlZm91bmQnLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgIF90cmFja0luc3RhbGxpbmcocmVnLmluc3RhbGxpbmcpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdmFyIHJlZnJlc2hpbmc7XHJcbiAgICBuYXZpZ2F0b3Iuc2VydmljZVdvcmtlci5hZGRFdmVudExpc3RlbmVyKCdjb250cm9sbGVyY2hhbmdlJywgZnVuY3Rpb24gKCkge1xyXG4gICAgICBpZiAocmVmcmVzaGluZykgcmV0dXJuO1xyXG4gICAgICByZWZyZXNoaW5nID0gdHJ1ZTtcclxuICAgIH0pO1xyXG4gIH0pXHJcbiAgLmNhdGNoKGZ1bmN0aW9uICgpIHtcclxuICAgIGNvbnNvbGUubG9nKCdTZXJ2aWNlIHdvcmtlciByZWdpc3RyYXRpb24gZmFpbGVkJyk7XHJcbiAgfSk7XHJcblxyXG5sZXQgX3VwZGF0ZVJlYWR5ID0gKHdvcmtlcikgPT4ge1xyXG4gIHdvcmtlci5wb3N0TWVzc2FnZSh7YWN0aW9uOiAnc2tpcFdhaXRpbmcnfSk7XHJcbn07XHJcblxyXG5sZXQgIF90cmFja0luc3RhbGxpbmcgPSAod29ya2VyKSA9PiB7XHJcbiAgbGV0IGluZGV4Q29udHJvbGxlciA9IHRoaXM7XHJcbiAgd29ya2VyLmFkZEV2ZW50TGlzdGVuZXIoJ3N0YXRlQ2hhbmdlJywgZnVuY3Rpb24oKSB7XHJcbiAgICBpZiAod29ya2VyLnN0YXRlID09ICdpbnN0YWxsZWQnKSB7XHJcbiAgICAgIGluZGV4Q29udHJvbGxlci5fdXBkYXRlUmVhZHkod29ya2VyKTtcclxuICAgIH1cclxuICB9KTtcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IERCSGVscGVyO1xyXG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCBEQkhlbHBlciBmcm9tICcuL2RiaGVscGVyJztcblxuLyoqXG4gKiBAaW5pdGlhbGl6ZSBHb29nbGUgbWFwLCBjYWxsZWQgZnJvbSBIVE1MLlxuICovXG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCAoKSA9PiB7XG4gIGluaXRNYXAoKTtcbn0pO1xuXG5sZXQgaW5pdE1hcCA9ICgpID0+IHtcbiAgZmV0Y2hSZXN0YXVyYW50RnJvbVVSTCgoZXJyb3IsIHJlc3RhdXJhbnQpID0+IHtcbiAgICBpZiAoZXJyb3IpIHsgLy8gR290IGFuIGVycm9yIVxuICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh0eXBlb2YgZ29vZ2xlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBzZWxmLm1hcCA9IG5ldyBnb29nbGUubWFwcy5NYXAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21hcCcpLCB7XG4gICAgICAgICAgem9vbTogMTYsXG4gICAgICAgICAgY2VudGVyOiByZXN0YXVyYW50LmxhdGxuZyxcbiAgICAgICAgICBzY3JvbGx3aGVlbDogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIGZpbGxCcmVhZGNydW1iKHNlbGYucmVzdGF1cmFudCk7XG4gICAgICAgIERCSGVscGVyLm1hcE1hcmtlckZvclJlc3RhdXJhbnQoc2VsZi5yZXN0YXVyYW50LCBzZWxmLm1hcCk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcbn07XG5cbndpbmRvdy5nbV9hdXRoRmFpbHVyZSA9ICgpID0+IHtcbiAgY29uc3QgbWFwVmlldyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtYXAtY29udGFpbmVyJyk7XG4gIG1hcFZpZXcuaW5uZXJIVE1MID0gJzxwIGlkPVwiZXJyb3ItbWFwXCI+QXV0aGVudGljYXRpb24gRXJyb3Igd2l0aCBHb29nbGUgTWFwITwvcD4nO1xufTtcblxuLyoqXG4gKiBAYWRkIHJlc3RhdXJhbnQgbmFtZSB0byB0aGUgYnJlYWRjcnVtYiBuYXZpZ2F0aW9uIG1lbnVcbiAqL1xubGV0IGZpbGxCcmVhZGNydW1iID0gKHJlc3RhdXJhbnQpID0+IHtcbiAgY29uc3QgYnJlYWRjcnVtYiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdicmVhZGNydW1iJyk7XG5cbiAgY29uc3QgbGlOYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKTtcbiAgbGlOYW1lLmlubmVySFRNTCA9IHJlc3RhdXJhbnQubmFtZTtcbiAgbGlOYW1lLmNsYXNzTmFtZSA9ICdicmVhZGNydW0tbmFtZSc7XG4gIGJyZWFkY3J1bWIuYXBwZW5kKGxpTmFtZSk7XG5cbiAgY29uc3QgbGlJY29uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKTtcbiAgLy9nZXQgZmlsbEZhdm9yaXRlc0hUTUwoKSBmcm9tIG1haW4uanNcbiAgbGlJY29uLmFwcGVuZChEQkhlbHBlci5maWxsRmF2b3JpdGVzSFRNTChyZXN0YXVyYW50KSk7XG5cbiAgYnJlYWRjcnVtYi5hcHBlbmQobGlJY29uKTtcbn07XG5cbi8qKlxuICogQGdldCBhIHBhcmFtZXRlciBieSBuYW1lIGZyb20gcGFnZSBVUkwuXG4gKi9cbmxldCBnZXRQYXJhbWV0ZXJCeU5hbWUgPSAobmFtZSwgdXJsKSA9PiB7XG4gIGlmICghdXJsKVxuICAgIHVybCA9IHdpbmRvdy5sb2NhdGlvbi5ocmVmO1xuICBuYW1lID0gbmFtZS5yZXBsYWNlKC9bW1xcXV0vZywgJ1xcXFwkJicpO1xuICBjb25zdCByZWdleCA9IG5ldyBSZWdFeHAoYFs/Jl0ke25hbWV9KD0oW14mI10qKXwmfCN8JClgKSxcbiAgICByZXN1bHRzID0gcmVnZXguZXhlYyh1cmwpO1xuICBpZiAoIXJlc3VsdHMpXG4gICAgcmV0dXJuIG51bGw7XG4gIGlmICghcmVzdWx0c1syXSlcbiAgICByZXR1cm4gJyc7XG4gIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQocmVzdWx0c1syXS5yZXBsYWNlKC9cXCsvZywgJyAnKSk7XG59O1xuXG4vKipcbiAqIEBnZXQgY3VycmVudCByZXN0YXVyYW50IGZyb20gcGFnZSBVUkwuXG4gKi9cbmxldCBmZXRjaFJlc3RhdXJhbnRGcm9tVVJMID0gKGNhbGxiYWNrKSA9PiB7XG4gIGlmIChzZWxmLnJlc3RhdXJhbnQpIHsgLy8gcmVzdGF1cmFudCBhbHJlYWR5IGZldGNoZWQhXG4gICAgY2FsbGJhY2sobnVsbCwgc2VsZi5yZXN0YXVyYW50KTtcbiAgICByZXR1cm47XG4gIH1cbiAgY29uc3QgaWQgPSBnZXRQYXJhbWV0ZXJCeU5hbWUoJ2lkJyk7XG4gIGlmICghaWQpIHsgLy8gbm8gaWQgZm91bmQgaW4gVVJMXG4gICAgY29uc3QgZXJyb3IgPSAnTm8gcmVzdGF1cmFudCBpZCBpbiBVUkwnO1xuICAgIGNhbGxiYWNrKGVycm9yLCBudWxsKTtcbiAgfSBlbHNlIHtcbiAgICBEQkhlbHBlci5mZXRjaFJlc3RhdXJhbnRCeUlkKGlkLCAoZXJyb3IsIHJlc3RhdXJhbnQpID0+IHtcbiAgICAgIHNlbGYucmVzdGF1cmFudCA9IHJlc3RhdXJhbnQ7XG4gICAgICBpZiAoIXJlc3RhdXJhbnQpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIERCSGVscGVyLmZldGNoUmVzdGF1cmFudFJldmlld3Moc2VsZi5yZXN0YXVyYW50LCAoZXJyb3IsIHJldmlld3MpID0+IHtcbiAgICAgICAgc2VsZi5yZXN0YXVyYW50LnJldmlld3MgPSByZXZpZXdzO1xuXG4gICAgICAgIGlmICghcmV2aWV3cykge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgICBmaWxsUmVzdGF1cmFudEhUTUwoc2VsZi5yZXN0YXVyYW50KTtcbiAgICAgIH0pO1xuICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdGF1cmFudCk7XG4gICAgfSk7XG4gIH1cbn07XG5cbi8qKlxuICogQGNyZWF0ZSByZXN0YXVyYW50IEhUTUwgYW5kIGFkZCBpdCB0byB0aGUgd2VicGFnZVxuICovXG5sZXQgZmlsbFJlc3RhdXJhbnRIVE1MID0gKHJlc3RhdXJhbnQpID0+IHtcbiAgY29uc3QgbmFtZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXN0YXVyYW50LW5hbWUnKTtcbiAgbmFtZS5pbm5lckhUTUwgPSByZXN0YXVyYW50Lm5hbWU7XG4gIG5hbWUuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsICcwJyk7XG5cbiAgY29uc3QgaW1hZ2UgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVzdGF1cmFudC1pbWcnKTtcbiAgaW1hZ2Uuc3JjID0gREJIZWxwZXIuaW1hZ2VVcmxGb3JSZXN0YXVyYW50KHJlc3RhdXJhbnQpO1xuICBpbWFnZS5hbHQgPSBgJHtyZXN0YXVyYW50Lm5hbWV9IGlzIHRoZSAke3Jlc3RhdXJhbnQuY3Vpc2luZV90eXBlfSByZXN0YXVyYW50YDtcbiAgaW1hZ2Uuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsICcwJyk7XG5cbiAgY29uc3QgY3Vpc2luZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXN0YXVyYW50LWN1aXNpbmUnKTtcbiAgY3Vpc2luZS5pbm5lckhUTUwgPSByZXN0YXVyYW50LmN1aXNpbmVfdHlwZTtcbiAgY3Vpc2luZS5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJzAnKTtcblxuICBjb25zdCBhZGRyZXNzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc3RhdXJhbnQtYWRkcmVzcycpO1xuICBhZGRyZXNzLmlubmVySFRNTCA9IHJlc3RhdXJhbnQuYWRkcmVzcztcbiAgYWRkcmVzcy5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJzAnKTtcblxuICAvLyBmaWxsIG9wZXJhdGluZyBob3Vyc1xuICBmaWxsUmVzdGF1cmFudEhvdXJzSFRNTChyZXN0YXVyYW50Lm9wZXJhdGluZ19ob3Vycyk7XG5cbiAgLy8gZmlsbCByZXZpZXdzXG4gIGZpbGxSZXZpZXdzSFRNTChyZXN0YXVyYW50LnJldmlld3MpO1xufTtcblxuLyoqXG4gKiBAY3JlYXRlIHJlc3RhdXJhbnQgb3BlcmF0aW5nIGhvdXJzIEhUTUwgdGFibGUgYW5kIGFkZCBpdCB0byB0aGUgd2VicGFnZS5cbiAqL1xubGV0IGZpbGxSZXN0YXVyYW50SG91cnNIVE1MID0gKG9wZXJhdGluZ0hvdXJzKSA9PiB7XG4gIGNvbnN0IGhvdXJzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc3RhdXJhbnQtaG91cnMnKTtcbiAgaG91cnMuaW5uZXJIVE1MID0gJyc7XG4gIGZvciAobGV0IGtleSBpbiBvcGVyYXRpbmdIb3Vycykge1xuICAgIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RyJyk7XG4gICAgcm93LmNsYXNzTmFtZSA9ICd0YWJsZS1yb3cnO1xuXG4gICAgY29uc3QgZGF5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGQnKTtcbiAgICBkYXkuaW5uZXJIVE1MID0ga2V5O1xuICAgIGRheS5jbGFzc05hbWUgPSAnZGF5LWNvbCc7XG4gICAgZGF5LnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnMCcpO1xuXG4gICAgcm93LmFwcGVuZChkYXkpO1xuXG4gICAgY29uc3QgdGltZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RkJyk7XG4gICAgdGltZS5pbm5lckhUTUwgPSBvcGVyYXRpbmdIb3Vyc1trZXldO1xuICAgIHRpbWUuY2xhc3NOYW1lID0gJ3RpbWUtY29sJztcbiAgICB0aW1lLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnMCcpO1xuICAgIHJvdy5hcHBlbmQodGltZSk7XG5cbiAgICBob3Vycy5hcHBlbmQocm93KTtcbiAgfVxufTtcblxuLyoqXG4gKiBAY3JlYXRlIGFsbCByZXZpZXdzIEhUTUwgYW5kIGFkZCB0aGVtIHRvIHRoZSB3ZWJwYWdlLlxuICovXG5sZXQgZmlsbFJldmlld3NIVE1MID0gKHJldmlld3MpID0+IHtcbiAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jldmlld3MtY29udGFpbmVyJyk7XG4gIGNvbnRhaW5lci5pbm5lckhUTUwgPSAnJztcblxuICBjb25zdCB1bCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3VsJyk7XG4gIHVsLmlkID0gJ3Jldmlld3MtbGlzdCc7XG4gIGNvbnRhaW5lci5hcHBlbmQodWwpO1xuXG4gIGNvbnN0IHRpdGxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaDMnKTtcbiAgdGl0bGUuaW5uZXJIVE1MID0gJ1Jldmlld3MnO1xuICB0aXRsZS5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJzAnKTtcbiAgY29udGFpbmVyLmFwcGVuZCh0aXRsZSk7XG5cbiAgaWYgKCFyZXZpZXdzKSB7XG4gICAgY29uc3Qgbm9SZXZpZXdzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgncCcpO1xuICAgIG5vUmV2aWV3cy5pbm5lckhUTUwgPSAnTm8gcmV2aWV3cyB5ZXQhJztcbiAgICBjb250YWluZXIuYXBwZW5kKG5vUmV2aWV3cyk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgbGV0IHNvcnRlZFJldmlld3MgPSByZXZpZXdzLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuICAgIHJldHVybiBuZXcgRGF0ZShiLnVwZGF0ZWRBdCkgLSBuZXcgRGF0ZShhLnVwZGF0ZWRBdCk7XG4gIH0pO1xuXG4gIHNvcnRlZFJldmlld3MuZm9yRWFjaChyZXZpZXcgPT4ge1xuICAgIHVsLmFwcGVuZChjcmVhdGVSZXZpZXdIVE1MKHJldmlldykpO1xuICB9KTtcbiAgY29udGFpbmVyLmFwcGVuZCh1bCk7XG59O1xuXG4vKipcbiAqIEBjcmVhdGUgcmV2aWV3IEhUTUwgYW5kIGFkZCBpdCB0byB0aGUgd2VicGFnZS5cbiAqL1xubGV0IGNyZWF0ZVJldmlld0hUTUwgPSAocmV2aWV3KSA9PiB7XG4gIGNvbnN0IGxpID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKTtcbiAgY29uc3QgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGNvbnN0IG5hbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdwJyk7XG4gIG5hbWUuaW5uZXJIVE1MID0gcmV2aWV3Lm5hbWU7XG4gIG5hbWUuY2xhc3NOYW1lID0gJ3Jldmlldy1uYW1lJztcbiAgbmFtZS5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJzAnKTtcblxuICBkaXYuYXBwZW5kKG5hbWUpO1xuXG4gIGNvbnN0IGRhdGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdwJyk7XG4gIGRhdGUuaW5uZXJIVE1MID0gbmV3IERhdGUocmV2aWV3LnVwZGF0ZWRBdCkudG9EYXRlU3RyaW5nKCk7XG4gIGRhdGUuY2xhc3NOYW1lID0gJ3Jldmlldy1kYXRlJztcbiAgZGF0ZS5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJzAnKTtcblxuICBkaXYuYXBwZW5kKGRhdGUpO1xuICBsaS5hcHBlbmQoZGl2KTtcblxuICBjb25zdCByYXRpbmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdwJyk7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCByZXZpZXcucmF0aW5nOyBpKyspIHtcbiAgICBjb25zdCBpY29uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaScpO1xuICAgIGljb24uY2xhc3NOYW1lID0gJ2ZhcyBmYS1zdGFyJztcbiAgICByYXRpbmcuYXBwZW5kKGljb24pO1xuICB9XG5cbiAgbGkuYXBwZW5kKHJhdGluZyk7XG5cbiAgY29uc3QgY29tbWVudHMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdwJyk7XG4gIGNvbW1lbnRzLmlubmVySFRNTCA9IHJldmlldy5jb21tZW50cztcbiAgY29tbWVudHMuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsICcwJyk7XG4gIGxpLmFwcGVuZChjb21tZW50cyk7XG5cbiAgcmV0dXJuIGxpO1xufTtcblxuLyoqXG4gICAqIEBzaG93IG1lc3NhZ2VzIGFuZCBoaWRlIHdoZW4gdGhlIGJ1dHRvbiBpcyBjbGlja2VkXG4gICAqL1xubGV0IHNob3dNZXNzYWdlID0gKCkgPT4ge1xuICBsZXQgbW9kYWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbW9kYWwtb3ZlcmxheScpO1xuICBsZXQgbW9kYWxNZXNzYWdlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21vZGFsLW1lc3NhZ2UnKTtcblxuICBtb2RhbE1lc3NhZ2UuaW5uZXJIVE1MID0gJ1lvdSBhcmUgb2ZmbGluZSByaWdodCBub3csIHRoZSByZXZpZXcgd2lsbCBiZSBzZW50IHdoZW4geW91IGFyZSBvbmxpbmUgbGF0ZXInO1xuICBtb2RhbC5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcblxuICBsZXQgYnV0dG9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0dG4tY2xvc2UnKTtcbiAgYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgbW9kYWwuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgfSk7XG59O1xuXG4vKipcbiAqIEBzdWJtaXQgdGhlIGZvcm0sIHNlbmQgdG8gdGhlIHNlcnZlciwgYW5kIHNob3cgaXQgb24gYSBwYWdlXG4gKi9cblxuY29uc3QgZm9ybSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXZpZXctZm9ybScpO1xuXG5mb3JtLmFkZEV2ZW50TGlzdGVuZXIoJ3N1Ym1pdCcsIGZ1bmN0aW9uKGUpIHtcbiAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICBsZXQgcmV2aWV3ID0ge1xuICAgICdyZXN0YXVyYW50X2lkJzogc2VsZi5yZXN0YXVyYW50LmlkXG4gIH07XG4gIGNvbnN0IGZvcm1EYXRhID0gbmV3IEZvcm1EYXRhKGZvcm0pO1xuICBmb3IgKGxldCBba2V5LCB2YWx1ZV0gb2YgZm9ybURhdGEuZW50cmllcygpKSB7XG4gICAgcmV2aWV3W2tleV0gPSB2YWx1ZTtcbiAgfVxuICBpZiAoIW5hdmlnYXRvci5vbkxpbmUpIHtcbiAgICBzaG93TWVzc2FnZSgpO1xuICB9XG4gIERCSGVscGVyLmNyZWF0ZVJlc3RhdXJhbnRSZXZpZXcocmV2aWV3KVxuICAgIC50aGVuKCgpID0+IHtcbiAgICAgIGZvcm0ucmVzZXQoKTtcbiAgICAgIERCSGVscGVyLmZldGNoUmVzdGF1cmFudFJldmlld3Moc2VsZi5yZXN0YXVyYW50LCAoZXJyb3IsIHJldmlld3MpID0+IHtcbiAgICAgICAgaWYgKCFyZXZpZXdzKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xuICAgICAgICB9XG4gICAgICAgIGZpbGxSZXZpZXdzSFRNTChyZXZpZXdzKTtcbiAgICAgIH0pO1xuICAgIH0pXG4gICAgLmNhdGNoKGVycm9yID0+IGNvbnNvbGUuZXJyb3IoJ2VycicsIGVycm9yKSk7XG59KTtcblxuXG4iLCIndXNlIHN0cmljdCc7XG5cbihmdW5jdGlvbigpIHtcbiAgZnVuY3Rpb24gdG9BcnJheShhcnIpIHtcbiAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJyKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb21pc2lmeVJlcXVlc3QocmVxdWVzdCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIHJlcXVlc3Qub25zdWNjZXNzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlc29sdmUocmVxdWVzdC5yZXN1bHQpO1xuICAgICAgfTtcblxuICAgICAgcmVxdWVzdC5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlamVjdChyZXF1ZXN0LmVycm9yKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBwcm9taXNpZnlSZXF1ZXN0Q2FsbChvYmosIG1ldGhvZCwgYXJncykge1xuICAgIHZhciByZXF1ZXN0O1xuICAgIHZhciBwID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICByZXF1ZXN0ID0gb2JqW21ldGhvZF0uYXBwbHkob2JqLCBhcmdzKTtcbiAgICAgIHByb21pc2lmeVJlcXVlc3QocmVxdWVzdCkudGhlbihyZXNvbHZlLCByZWplY3QpO1xuICAgIH0pO1xuXG4gICAgcC5yZXF1ZXN0ID0gcmVxdWVzdDtcbiAgICByZXR1cm4gcDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb21pc2lmeUN1cnNvclJlcXVlc3RDYWxsKG9iaiwgbWV0aG9kLCBhcmdzKSB7XG4gICAgdmFyIHAgPSBwcm9taXNpZnlSZXF1ZXN0Q2FsbChvYmosIG1ldGhvZCwgYXJncyk7XG4gICAgcmV0dXJuIHAudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgaWYgKCF2YWx1ZSkgcmV0dXJuO1xuICAgICAgcmV0dXJuIG5ldyBDdXJzb3IodmFsdWUsIHAucmVxdWVzdCk7XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBwcm94eVByb3BlcnRpZXMoUHJveHlDbGFzcywgdGFyZ2V0UHJvcCwgcHJvcGVydGllcykge1xuICAgIHByb3BlcnRpZXMuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoUHJveHlDbGFzcy5wcm90b3R5cGUsIHByb3AsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gdGhpc1t0YXJnZXRQcm9wXVtwcm9wXTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICB0aGlzW3RhcmdldFByb3BdW3Byb3BdID0gdmFsO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb3h5UmVxdWVzdE1ldGhvZHMoUHJveHlDbGFzcywgdGFyZ2V0UHJvcCwgQ29uc3RydWN0b3IsIHByb3BlcnRpZXMpIHtcbiAgICBwcm9wZXJ0aWVzLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgaWYgKCEocHJvcCBpbiBDb25zdHJ1Y3Rvci5wcm90b3R5cGUpKSByZXR1cm47XG4gICAgICBQcm94eUNsYXNzLnByb3RvdHlwZVtwcm9wXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gcHJvbWlzaWZ5UmVxdWVzdENhbGwodGhpc1t0YXJnZXRQcm9wXSwgcHJvcCwgYXJndW1lbnRzKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBwcm94eU1ldGhvZHMoUHJveHlDbGFzcywgdGFyZ2V0UHJvcCwgQ29uc3RydWN0b3IsIHByb3BlcnRpZXMpIHtcbiAgICBwcm9wZXJ0aWVzLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgaWYgKCEocHJvcCBpbiBDb25zdHJ1Y3Rvci5wcm90b3R5cGUpKSByZXR1cm47XG4gICAgICBQcm94eUNsYXNzLnByb3RvdHlwZVtwcm9wXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpc1t0YXJnZXRQcm9wXVtwcm9wXS5hcHBseSh0aGlzW3RhcmdldFByb3BdLCBhcmd1bWVudHMpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb3h5Q3Vyc29yUmVxdWVzdE1ldGhvZHMoUHJveHlDbGFzcywgdGFyZ2V0UHJvcCwgQ29uc3RydWN0b3IsIHByb3BlcnRpZXMpIHtcbiAgICBwcm9wZXJ0aWVzLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgaWYgKCEocHJvcCBpbiBDb25zdHJ1Y3Rvci5wcm90b3R5cGUpKSByZXR1cm47XG4gICAgICBQcm94eUNsYXNzLnByb3RvdHlwZVtwcm9wXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gcHJvbWlzaWZ5Q3Vyc29yUmVxdWVzdENhbGwodGhpc1t0YXJnZXRQcm9wXSwgcHJvcCwgYXJndW1lbnRzKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBJbmRleChpbmRleCkge1xuICAgIHRoaXMuX2luZGV4ID0gaW5kZXg7XG4gIH1cblxuICBwcm94eVByb3BlcnRpZXMoSW5kZXgsICdfaW5kZXgnLCBbXG4gICAgJ25hbWUnLFxuICAgICdrZXlQYXRoJyxcbiAgICAnbXVsdGlFbnRyeScsXG4gICAgJ3VuaXF1ZSdcbiAgXSk7XG5cbiAgcHJveHlSZXF1ZXN0TWV0aG9kcyhJbmRleCwgJ19pbmRleCcsIElEQkluZGV4LCBbXG4gICAgJ2dldCcsXG4gICAgJ2dldEtleScsXG4gICAgJ2dldEFsbCcsXG4gICAgJ2dldEFsbEtleXMnLFxuICAgICdjb3VudCdcbiAgXSk7XG5cbiAgcHJveHlDdXJzb3JSZXF1ZXN0TWV0aG9kcyhJbmRleCwgJ19pbmRleCcsIElEQkluZGV4LCBbXG4gICAgJ29wZW5DdXJzb3InLFxuICAgICdvcGVuS2V5Q3Vyc29yJ1xuICBdKTtcblxuICBmdW5jdGlvbiBDdXJzb3IoY3Vyc29yLCByZXF1ZXN0KSB7XG4gICAgdGhpcy5fY3Vyc29yID0gY3Vyc29yO1xuICAgIHRoaXMuX3JlcXVlc3QgPSByZXF1ZXN0O1xuICB9XG5cbiAgcHJveHlQcm9wZXJ0aWVzKEN1cnNvciwgJ19jdXJzb3InLCBbXG4gICAgJ2RpcmVjdGlvbicsXG4gICAgJ2tleScsXG4gICAgJ3ByaW1hcnlLZXknLFxuICAgICd2YWx1ZSdcbiAgXSk7XG5cbiAgcHJveHlSZXF1ZXN0TWV0aG9kcyhDdXJzb3IsICdfY3Vyc29yJywgSURCQ3Vyc29yLCBbXG4gICAgJ3VwZGF0ZScsXG4gICAgJ2RlbGV0ZSdcbiAgXSk7XG5cbiAgLy8gcHJveHkgJ25leHQnIG1ldGhvZHNcbiAgWydhZHZhbmNlJywgJ2NvbnRpbnVlJywgJ2NvbnRpbnVlUHJpbWFyeUtleSddLmZvckVhY2goZnVuY3Rpb24obWV0aG9kTmFtZSkge1xuICAgIGlmICghKG1ldGhvZE5hbWUgaW4gSURCQ3Vyc29yLnByb3RvdHlwZSkpIHJldHVybjtcbiAgICBDdXJzb3IucHJvdG90eXBlW21ldGhvZE5hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgY3Vyc29yID0gdGhpcztcbiAgICAgIHZhciBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgIGN1cnNvci5fY3Vyc29yW21ldGhvZE5hbWVdLmFwcGx5KGN1cnNvci5fY3Vyc29yLCBhcmdzKTtcbiAgICAgICAgcmV0dXJuIHByb21pc2lmeVJlcXVlc3QoY3Vyc29yLl9yZXF1ZXN0KS50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgICAgaWYgKCF2YWx1ZSkgcmV0dXJuO1xuICAgICAgICAgIHJldHVybiBuZXcgQ3Vyc29yKHZhbHVlLCBjdXJzb3IuX3JlcXVlc3QpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH07XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIE9iamVjdFN0b3JlKHN0b3JlKSB7XG4gICAgdGhpcy5fc3RvcmUgPSBzdG9yZTtcbiAgfVxuXG4gIE9iamVjdFN0b3JlLnByb3RvdHlwZS5jcmVhdGVJbmRleCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgSW5kZXgodGhpcy5fc3RvcmUuY3JlYXRlSW5kZXguYXBwbHkodGhpcy5fc3RvcmUsIGFyZ3VtZW50cykpO1xuICB9O1xuXG4gIE9iamVjdFN0b3JlLnByb3RvdHlwZS5pbmRleCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgSW5kZXgodGhpcy5fc3RvcmUuaW5kZXguYXBwbHkodGhpcy5fc3RvcmUsIGFyZ3VtZW50cykpO1xuICB9O1xuXG4gIHByb3h5UHJvcGVydGllcyhPYmplY3RTdG9yZSwgJ19zdG9yZScsIFtcbiAgICAnbmFtZScsXG4gICAgJ2tleVBhdGgnLFxuICAgICdpbmRleE5hbWVzJyxcbiAgICAnYXV0b0luY3JlbWVudCdcbiAgXSk7XG5cbiAgcHJveHlSZXF1ZXN0TWV0aG9kcyhPYmplY3RTdG9yZSwgJ19zdG9yZScsIElEQk9iamVjdFN0b3JlLCBbXG4gICAgJ3B1dCcsXG4gICAgJ2FkZCcsXG4gICAgJ2RlbGV0ZScsXG4gICAgJ2NsZWFyJyxcbiAgICAnZ2V0JyxcbiAgICAnZ2V0QWxsJyxcbiAgICAnZ2V0S2V5JyxcbiAgICAnZ2V0QWxsS2V5cycsXG4gICAgJ2NvdW50J1xuICBdKTtcblxuICBwcm94eUN1cnNvclJlcXVlc3RNZXRob2RzKE9iamVjdFN0b3JlLCAnX3N0b3JlJywgSURCT2JqZWN0U3RvcmUsIFtcbiAgICAnb3BlbkN1cnNvcicsXG4gICAgJ29wZW5LZXlDdXJzb3InXG4gIF0pO1xuXG4gIHByb3h5TWV0aG9kcyhPYmplY3RTdG9yZSwgJ19zdG9yZScsIElEQk9iamVjdFN0b3JlLCBbXG4gICAgJ2RlbGV0ZUluZGV4J1xuICBdKTtcblxuICBmdW5jdGlvbiBUcmFuc2FjdGlvbihpZGJUcmFuc2FjdGlvbikge1xuICAgIHRoaXMuX3R4ID0gaWRiVHJhbnNhY3Rpb247XG4gICAgdGhpcy5jb21wbGV0ZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgaWRiVHJhbnNhY3Rpb24ub25jb21wbGV0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9O1xuICAgICAgaWRiVHJhbnNhY3Rpb24ub25lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZWplY3QoaWRiVHJhbnNhY3Rpb24uZXJyb3IpO1xuICAgICAgfTtcbiAgICAgIGlkYlRyYW5zYWN0aW9uLm9uYWJvcnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVqZWN0KGlkYlRyYW5zYWN0aW9uLmVycm9yKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBUcmFuc2FjdGlvbi5wcm90b3R5cGUub2JqZWN0U3RvcmUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IE9iamVjdFN0b3JlKHRoaXMuX3R4Lm9iamVjdFN0b3JlLmFwcGx5KHRoaXMuX3R4LCBhcmd1bWVudHMpKTtcbiAgfTtcblxuICBwcm94eVByb3BlcnRpZXMoVHJhbnNhY3Rpb24sICdfdHgnLCBbXG4gICAgJ29iamVjdFN0b3JlTmFtZXMnLFxuICAgICdtb2RlJ1xuICBdKTtcblxuICBwcm94eU1ldGhvZHMoVHJhbnNhY3Rpb24sICdfdHgnLCBJREJUcmFuc2FjdGlvbiwgW1xuICAgICdhYm9ydCdcbiAgXSk7XG5cbiAgZnVuY3Rpb24gVXBncmFkZURCKGRiLCBvbGRWZXJzaW9uLCB0cmFuc2FjdGlvbikge1xuICAgIHRoaXMuX2RiID0gZGI7XG4gICAgdGhpcy5vbGRWZXJzaW9uID0gb2xkVmVyc2lvbjtcbiAgICB0aGlzLnRyYW5zYWN0aW9uID0gbmV3IFRyYW5zYWN0aW9uKHRyYW5zYWN0aW9uKTtcbiAgfVxuXG4gIFVwZ3JhZGVEQi5wcm90b3R5cGUuY3JlYXRlT2JqZWN0U3RvcmUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IE9iamVjdFN0b3JlKHRoaXMuX2RiLmNyZWF0ZU9iamVjdFN0b3JlLmFwcGx5KHRoaXMuX2RiLCBhcmd1bWVudHMpKTtcbiAgfTtcblxuICBwcm94eVByb3BlcnRpZXMoVXBncmFkZURCLCAnX2RiJywgW1xuICAgICduYW1lJyxcbiAgICAndmVyc2lvbicsXG4gICAgJ29iamVjdFN0b3JlTmFtZXMnXG4gIF0pO1xuXG4gIHByb3h5TWV0aG9kcyhVcGdyYWRlREIsICdfZGInLCBJREJEYXRhYmFzZSwgW1xuICAgICdkZWxldGVPYmplY3RTdG9yZScsXG4gICAgJ2Nsb3NlJ1xuICBdKTtcblxuICBmdW5jdGlvbiBEQihkYikge1xuICAgIHRoaXMuX2RiID0gZGI7XG4gIH1cblxuICBEQi5wcm90b3R5cGUudHJhbnNhY3Rpb24gPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IFRyYW5zYWN0aW9uKHRoaXMuX2RiLnRyYW5zYWN0aW9uLmFwcGx5KHRoaXMuX2RiLCBhcmd1bWVudHMpKTtcbiAgfTtcblxuICBwcm94eVByb3BlcnRpZXMoREIsICdfZGInLCBbXG4gICAgJ25hbWUnLFxuICAgICd2ZXJzaW9uJyxcbiAgICAnb2JqZWN0U3RvcmVOYW1lcydcbiAgXSk7XG5cbiAgcHJveHlNZXRob2RzKERCLCAnX2RiJywgSURCRGF0YWJhc2UsIFtcbiAgICAnY2xvc2UnXG4gIF0pO1xuXG4gIC8vIEFkZCBjdXJzb3IgaXRlcmF0b3JzXG4gIC8vIFRPRE86IHJlbW92ZSB0aGlzIG9uY2UgYnJvd3NlcnMgZG8gdGhlIHJpZ2h0IHRoaW5nIHdpdGggcHJvbWlzZXNcbiAgWydvcGVuQ3Vyc29yJywgJ29wZW5LZXlDdXJzb3InXS5mb3JFYWNoKGZ1bmN0aW9uKGZ1bmNOYW1lKSB7XG4gICAgW09iamVjdFN0b3JlLCBJbmRleF0uZm9yRWFjaChmdW5jdGlvbihDb25zdHJ1Y3Rvcikge1xuICAgICAgLy8gRG9uJ3QgY3JlYXRlIGl0ZXJhdGVLZXlDdXJzb3IgaWYgb3BlbktleUN1cnNvciBkb2Vzbid0IGV4aXN0LlxuICAgICAgaWYgKCEoZnVuY05hbWUgaW4gQ29uc3RydWN0b3IucHJvdG90eXBlKSkgcmV0dXJuO1xuXG4gICAgICBDb25zdHJ1Y3Rvci5wcm90b3R5cGVbZnVuY05hbWUucmVwbGFjZSgnb3BlbicsICdpdGVyYXRlJyldID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBhcmdzID0gdG9BcnJheShhcmd1bWVudHMpO1xuICAgICAgICB2YXIgY2FsbGJhY2sgPSBhcmdzW2FyZ3MubGVuZ3RoIC0gMV07XG4gICAgICAgIHZhciBuYXRpdmVPYmplY3QgPSB0aGlzLl9zdG9yZSB8fCB0aGlzLl9pbmRleDtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuYXRpdmVPYmplY3RbZnVuY05hbWVdLmFwcGx5KG5hdGl2ZU9iamVjdCwgYXJncy5zbGljZSgwLCAtMSkpO1xuICAgICAgICByZXF1ZXN0Lm9uc3VjY2VzcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGNhbGxiYWNrKHJlcXVlc3QucmVzdWx0KTtcbiAgICAgICAgfTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH0pO1xuXG4gIC8vIHBvbHlmaWxsIGdldEFsbFxuICBbSW5kZXgsIE9iamVjdFN0b3JlXS5mb3JFYWNoKGZ1bmN0aW9uKENvbnN0cnVjdG9yKSB7XG4gICAgaWYgKENvbnN0cnVjdG9yLnByb3RvdHlwZS5nZXRBbGwpIHJldHVybjtcbiAgICBDb25zdHJ1Y3Rvci5wcm90b3R5cGUuZ2V0QWxsID0gZnVuY3Rpb24ocXVlcnksIGNvdW50KSB7XG4gICAgICB2YXIgaW5zdGFuY2UgPSB0aGlzO1xuICAgICAgdmFyIGl0ZW1zID0gW107XG5cbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlKSB7XG4gICAgICAgIGluc3RhbmNlLml0ZXJhdGVDdXJzb3IocXVlcnksIGZ1bmN0aW9uKGN1cnNvcikge1xuICAgICAgICAgIGlmICghY3Vyc29yKSB7XG4gICAgICAgICAgICByZXNvbHZlKGl0ZW1zKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgaXRlbXMucHVzaChjdXJzb3IudmFsdWUpO1xuXG4gICAgICAgICAgaWYgKGNvdW50ICE9PSB1bmRlZmluZWQgJiYgaXRlbXMubGVuZ3RoID09IGNvdW50KSB7XG4gICAgICAgICAgICByZXNvbHZlKGl0ZW1zKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgY3Vyc29yLmNvbnRpbnVlKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfTtcbiAgfSk7XG5cbiAgdmFyIGV4cCA9IHtcbiAgICBvcGVuOiBmdW5jdGlvbihuYW1lLCB2ZXJzaW9uLCB1cGdyYWRlQ2FsbGJhY2spIHtcbiAgICAgIHZhciBwID0gcHJvbWlzaWZ5UmVxdWVzdENhbGwoaW5kZXhlZERCLCAnb3BlbicsIFtuYW1lLCB2ZXJzaW9uXSk7XG4gICAgICB2YXIgcmVxdWVzdCA9IHAucmVxdWVzdDtcblxuICAgICAgaWYgKHJlcXVlc3QpIHtcbiAgICAgICAgcmVxdWVzdC5vbnVwZ3JhZGVuZWVkZWQgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgIGlmICh1cGdyYWRlQ2FsbGJhY2spIHtcbiAgICAgICAgICAgIHVwZ3JhZGVDYWxsYmFjayhuZXcgVXBncmFkZURCKHJlcXVlc3QucmVzdWx0LCBldmVudC5vbGRWZXJzaW9uLCByZXF1ZXN0LnRyYW5zYWN0aW9uKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcC50aGVuKGZ1bmN0aW9uKGRiKSB7XG4gICAgICAgIHJldHVybiBuZXcgREIoZGIpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgICBkZWxldGU6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIHJldHVybiBwcm9taXNpZnlSZXF1ZXN0Q2FsbChpbmRleGVkREIsICdkZWxldGVEYXRhYmFzZScsIFtuYW1lXSk7XG4gICAgfVxuICB9O1xuXG4gIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZXhwO1xuICAgIG1vZHVsZS5leHBvcnRzLmRlZmF1bHQgPSBtb2R1bGUuZXhwb3J0cztcbiAgfVxuICBlbHNlIHtcbiAgICBzZWxmLmlkYiA9IGV4cDtcbiAgfVxufSgpKTtcbiJdfQ==
