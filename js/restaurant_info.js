'use strict';

import DBHelper from './dbhelper';

/**
 * Initialize Google map, called from HTML.
 */

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  //DBHelper.registerServiceWorker();
});

let initMap = () => {
  fetchRestaurantFromURL((error, restaurant) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      if (typeof google !== 'undefined') {
        self.map = new google.maps.Map(document.getElementById('map'), {
          zoom: 16,
          center: restaurant.latlng,
          scrollwheel: false
        });
        fillBreadcrumb(restaurant);
        DBHelper.mapMarkerForRestaurant(self.restaurant, self.map);
      }
    }
  });
};

window.gm_authFailure = () => {
  const mapView = document.getElementById('map-container');
  mapView.innerHTML = '<p id="error-map">Authentication Error with Google Map!</p>';
};

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
let fillBreadcrumb = (restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb');
  const li = document.createElement('li');
  li.innerHTML = restaurant.name;
  breadcrumb.appendChild(li);
  return li;
};

/**
 * Get a parameter by name from page URL.
 */
let getParameterByName = (name, url) => {
  if (!url)
    url = window.location.href;
  name = name.replace(/[[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results)
    return null;
  if (!results[2])
    return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
};

/**
 * Get current restaurant from page URL.
 */
let fetchRestaurantFromURL = (callback) => {
  if (self.restaurant) { // restaurant already fetched!
    callback(null, self.restaurant);
    return;
  }
  const id = getParameterByName('id');
  if (!id) { // no id found in URL
    const error = 'No restaurant id in URL';
    callback(error, null);
  } else {
    DBHelper.fetchRestaurantById(id, (error, restaurant) => {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.error(error);
        return;
      }
      DBHelper.fetchRestaurantReviews(self.restaurant, (error, reviews) => {
        self.restaurant.reviews = reviews;
        if (!reviews) {
          console.log(error);
        }
        fillRestaurantHTML(self.restaurant);
        callback(null, self.restaurant);
      });
    });
  }
};

/**
 * Create restaurant HTML and add it to the webpage
 */
let fillRestaurantHTML = (restaurant) => {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;
  name.setAttribute('tabindex', '1');

  const image = document.getElementById('restaurant-img');
  image.src = DBHelper.imageUrlForRestaurant(restaurant);
  image.alt = `${restaurant.name} is the ${restaurant.cuisine_type} restaurant`;
  image.setAttribute('tabindex', '2');

  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;
  cuisine.setAttribute('tabindex', '3');

  const address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;
  address.setAttribute('tabindex', '4');

  // fill operating hours
  fillRestaurantHoursHTML(restaurant.operating_hours);

  // fill reviews
  fillReviewsHTML(restaurant.reviews);
  console.log('restaurant', restaurant);
};

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
let fillRestaurantHoursHTML = (operatingHours) => {
  const hours = document.getElementById('restaurant-hours');
  for (let key in operatingHours) {
    const row = document.createElement('tr');
    row.className = 'table-row';

    const day = document.createElement('td');
    day.innerHTML = key;
    day.className = 'day-col';
    day.setAttribute('tabindex', '5');

    row.appendChild(day);

    const time = document.createElement('td');
    time.innerHTML = operatingHours[key];
    time.className = 'time-col';
    time.setAttribute('tabindex', '5');
    row.appendChild(time);

    hours.appendChild(row);
  }
};

/**
 * Create all reviews HTML and add them to the webpage.
 */
let fillReviewsHTML = (reviews) => {
  const container = document.getElementById('reviews-container');
  container.innerHTML = '';

  const ul = document.createElement('ul');
  ul.id = 'reviews-list';
  container.appendChild(ul);

  const title = document.createElement('h2');
  title.innerHTML = 'Reviews';
  title.setAttribute('tabindex', '6');
  container.appendChild(title);

  if (!reviews) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    return;
  }
  //const ul = document.getElementById('reviews-list');

  let sortedReviews = restaurant.reviews.sort(function(a, b) {
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  sortedReviews.forEach(review => {
    ul.appendChild(createReviewHTML(review));
  });
  container.appendChild(ul);
};

/**
 * Create review HTML and add it to the webpage.
 */
let createReviewHTML = (review) => {
  const li = document.createElement('li');
  const div = document.createElement('div');
  const name = document.createElement('p');
  name.innerHTML = review.name;
  name.className = 'review-name';
  name.setAttribute('tabindex', '7');

  div.appendChild(name);

  const date = document.createElement('p');
  date.innerHTML = new Date(review.updatedAt).toDateString();
  date.className = 'review-date';
  date.setAttribute('tabindex', '7');

  div.appendChild(date);
  li.appendChild(div);

  const rating = document.createElement('p');
  rating.innerHTML = `RATING: ${review.rating}`;
  rating.className = 'review-rating';
  rating.setAttribute('tabindex', '7');
  li.appendChild(rating);

  const comments = document.createElement('p');
  comments.innerHTML = review.comments;
  comments.setAttribute('tabindex', '7');
  li.appendChild(comments);

  return li;
};

// Add review

const form = document.getElementById('review-form');

form.addEventListener('submit', function(e) {
  e.preventDefault();
  let review = {
    'restaurant_id': self.restaurant.id
  };
  const formData = new FormData(form);
  for (let [key, value] of formData.entries()) {
    review[key] = value;
  }
  DBHelper.createRestaurantReview(review)
    .then(data => {
      const ul = document.getElementById('reviews-list');
      ul.appendChild(createReviewHTML(review));
      form.reset();

      DBHelper.fetchRestaurantReviews(self.restaurant, (error, reviews) => {
        self.restaurant.reviews = reviews;
        if (!self.restaurant.reviews) {
          console.log(error);
        }
        fillReviewsHTML(self.restaurant.reviews);
      });
    })
    .catch(error => console.error('err', error));
});


