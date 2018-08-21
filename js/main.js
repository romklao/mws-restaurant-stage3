'use strict';

import DBHelper from './dbhelper';

var markers = [];

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  DBHelper.addTitleToMap();
  fetchNeighborhoods();
  fetchCuisines();
});

/**
 * Initialize Google map, called from HTML.
 */
let initMap = () => {
  if (typeof google !== 'undefined') {
    let loc = {
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
 * Fetch all neighborhoods and set their HTML.
 */
let fetchNeighborhoods = () => {
  DBHelper.fetchNeighborhoods((error, neighborhoods) => {
    if (error) { // Got an error
      console.error(error);
    } else {
      fillNeighborhoodsHTML(neighborhoods);
    }
  });
};

/**
 * Set neighborhoods HTML.
 */
let fillNeighborhoodsHTML = (neighborhoods) => {
  const select = document.getElementById('neighborhoods-select');
  neighborhoods.forEach(neighborhood => {
    const option = document.createElement('option');
    option.innerHTML = neighborhood;
    option.setAttribute('value', neighborhood);
    option.setAttribute('role', 'option');
    select.append(option);
  });
};

/**
 * Fetch all cuisines and set their HTML.
 */
let fetchCuisines = () => {
  DBHelper.fetchCuisines((error, cuisines) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      fillCuisinesHTML(cuisines);
    }
  });
};

/**
 * Set cuisines HTML.
 */
let fillCuisinesHTML = (cuisines) => {
  const select = document.getElementById('cuisines-select');

  cuisines.forEach(cuisine => {
    const option = document.createElement('option');
    option.innerHTML = cuisine;
    option.setAttribute('value', cuisine);
    option.setAttribute('role', 'option');
    select.append(option);
  });
};

/**
 * Create restaurant HTML.
 */
let createRestaurantHTML = (restaurant) => {
  const li = document.createElement('li');

  const image = document.createElement('img');
  image.className = 'restaurant-imgs';
  image.src = DBHelper.imageUrlForRestaurant(restaurant);
  image.alt = `${restaurant.name} is ${restaurant.cuisine_type} restaurant`;
  li.append(image);

  const nameWrap = document.createElement('div');
  nameWrap.className = 'name-wrap';
  const name = document.createElement('h3');
  name.innerHTML = restaurant.name;
  nameWrap.append(name);
  //import the fillFavoritesHTML from dbhelper.js
  nameWrap.append(DBHelper.fillFavoritesHTML(restaurant));
  li.append(nameWrap);

  const addressWrap = document.createElement('div');
  addressWrap.className = 'address-wrap';
  const neighborhood = document.createElement('p');
  neighborhood.innerHTML = restaurant.neighborhood;
  addressWrap.append(neighborhood);

  const address = document.createElement('p');
  address.innerHTML = restaurant.address;
  addressWrap.append(address);
  li.append(addressWrap);

  const more = document.createElement('a');
  more.innerHTML = 'View Details';
  more.href = DBHelper.urlForRestaurant(restaurant);
  li.append(more);

  return li;
};

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
let resetRestaurants = (restaurants) => {
  // Remove all restaurants
  restaurants = [];
  const ul = document.getElementById('restaurants-list');
  ul.innerHTML = '';

  // Remove all map markers
  markers.forEach(m => m.setMap(null));
  markers = [];
  self.restaurants = restaurants;
};

/**
 * Add markers for current restaurants to the map.
 */
let addMarkersToMap = (restaurants) => {
  restaurants.forEach(restaurant => {
    // Add marker to the map
    const marker = DBHelper.mapMarkerForRestaurant(restaurant, self.map);
    google.maps.event.addListener(marker, 'click', () => {
      window.location.href = marker.url;
    });
    markers.push(marker);
  });
};
/**
 * Create all restaurants HTML and add them to the webpage.
 */
let fillRestaurantsHTML = (restaurants) => {
  const ul = document.getElementById('restaurants-list');

  restaurants.forEach(restaurant => {
    ul.append(createRestaurantHTML(restaurant));
  });
  if(typeof google !== 'undefined') {
    addMarkersToMap(restaurants);
  }
};

/**
 * Update page and map for current restaurants.
   And make it global so the index.html can use the function
 */
self.updateRestaurants = () => {
  const cSelect = document.getElementById('cuisines-select');
  const nSelect = document.getElementById('neighborhoods-select');
  const fSelect = document.getElementById('favorites-select');

  const cIndex = cSelect.selectedIndex;
  const nIndex = nSelect.selectedIndex;
  const fIndex = fSelect.selectedIndex;

  const cuisine = cSelect[cIndex].value;
  const neighborhood = nSelect[nIndex].value;
  const favorite = fSelect[fIndex].value;

  DBHelper.fetchRestaurantByCuisineNeighborhoodAndFavorite(cuisine, neighborhood, favorite, (error, restaurants) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      resetRestaurants(restaurants);
      fillRestaurantsHTML(restaurants);
    }
  });
};

