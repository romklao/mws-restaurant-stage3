'use strict';

import idb from 'idb';

/**
 * Common database helper functions.
 */
class DBHelper {

  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    const port = 1337;// Change this to your server port
    return `http://localhost:${port}/restaurants`;
  }

  /**
   * @pen database to store data retrieved from the server in indexedDB API
   */
  static openDatabase() {
    if (!navigator.serviceWorker) {
      return Promise.resolve();
    }

    return idb.open('restaurants', 1, function(upgradeDb) {
      upgradeDb.createObjectStore('restaurants', {
        keyPath: 'id'
      });
    });
  }
  /**
   * @keep data in indexedDB after fetching it from the server
     @param {string} restaurants - retrieved data from the server
   */
  static storeDataIndexedDB(restaurants) {
    let dbPromise = DBHelper.openDatabase();
    dbPromise.then(function(db) {

      if (!db) return db;

      let tx = db.transaction('restaurants', 'readwrite');
      let restaurantsStore = tx.objectStore('restaurants');

      restaurants.forEach(restaurant => restaurantsStore.put(restaurant));

      restaurantsStore.openCursor(null , 'prev').then(function(cursor){
        return cursor.advance(30);
      })
        .then(function deleteRest(cursor){
          if(!cursor) return;
          cursor.delete();
          return cursor.continue().then(deleteRest);
        });
    });
  }
  /**
   * @get data from indexedDB if the data available after
   *  it is collected from fetching
   */
  static getCachedRestaurants() {
    let dbPromise = DBHelper.openDatabase();
    dbPromise.then(function(db) {

      if(!db) return;

      let tx = db.transaction('restaurants');
      let restaurantsStore = tx.objectStore('restaurants');
      return restaurantsStore.getAll();
    })
      .then(function(restaurants) {
        console.log('restaurantsDB', restaurants);
      });
  }

  /**
   * @fetch all restaurants.
   */
  static fetchRestaurants(callback) {

    DBHelper.getCachedRestaurants();

    fetch(DBHelper.DATABASE_URL, {credentials: 'same-origin'})
      .then(response => {
        if (response.ok) {
          return response;
        }
        throw new Error('Network response was not ok.');
      })
      .then(response => response.json())
      .then(restaurants => {

        DBHelper.storeDataIndexedDB(restaurants);
        return callback(null, restaurants);
      })
      .catch(err => {
        return callback(err , null);
      });
  }

  /**
   * @fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {
    // fetch all restaurants with proper error handling.
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        const restaurant = restaurants.find(r => r.id == id);
        if (restaurant) { // Got the restaurant
          callback(null, restaurant);
        } else { // Restaurant does not exist in the database
          callback('Restaurant does not exist', null);
        }
      }
    });
  }

  /**
   * @fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given cuisine type
        const results = restaurants.filter(r => r.cuisine_type == cuisine);
        callback(null, results);
      }
    });
  }

  /**
   * @fetch restaurants by a neighborhood with proper error handling.
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given neighborhood
        const results = restaurants.filter(r => r.neighborhood == neighborhood);
        callback(null, results);
      }
    });
  }

  /**
   * @fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        let results = restaurants;
        if (cuisine != 'all') { // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood != 'all') { // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood);
        }
        callback(null, results);
      }
    });
  }

  /**
   * @fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood);
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i);
        callback(null, uniqueNeighborhoods);
      }
    });
  }

  /**
   * @fetch all cuisines with proper error handling.
   */
  static fetchCuisines(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type);
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i);
        callback(null, uniqueCuisines);
      }
    });
  }

  /**
   * @restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return (`./restaurant.html?id=${restaurant.id}`);
  }

  /**
   * @restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant) {
    if (restaurant.photograph === undefined) {
      restaurant.photograph = 10;
    }
    return (`/img/${restaurant.photograph}.jpg`);
  }

  /**
   * @Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    const marker = new google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant),
      map: map,
      animation: google.maps.Animation.DROP}
    );
    return marker;
  }
  /* @register ServiceWorker to cache data for the site
   * to allow any page that has been visited is accessible offline
   */
  static registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('./sw.js')
          .then(function(registration) {
          // Registration was successful
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
          }, function(err) {
            // registration failed :(
            console.log('ServiceWorker registration failed: ', err);
          });
      });
    }
  }
}


export default DBHelper;