# Mobile Web Specialist Certification Course

## Restaurant Reviews_Stage 2

- The Restaurant Reviews projects is incrementally convert a static webpage to a mobile-ready web application. We take the responsive design we built in Stage One and connect it to an external server and retrieving data by using `fetch()` instead of local memory.

- Use IndexedDB to cache JSON responses In order to maintain offline use with the development server, we update the service worker to store the JSON received by our requests using the IndexedDB API. Any page (including images) that has been visited by the user is available offline, with data pulled from the shell database.

- Responsive: This project is a fully responsive that all pages elements are usable and visible in any devices, including desktop, tablet, and mobile display.

- Accessible: Use the appropriate semantic elements. Appropriate ARIA roles are defined for those elements in which a semantic element is not available.

## How to start the server

Refer to https://github.com/udacity/mws-restaurant-stage-2

## How to start the app

1. Clone the project into your local `git@github.com:romklao/mws-restaurant-stage-2-update.git`.

2. Get your own Google Maps API key https://developers.google.com/maps/documentation/javascript/get-api-key.

3. In the index.html file line 40, replace the text `YOUR_GOOGLE_MAPS_API_KEY` with your own Google Maps API key.

    `<script async defer src="https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&libraries=places&callback=initMap"></script>`

4. In the restaurant.html file line 62, replace the text `YOUR_GOOGLE_MAPS_API_KEY` with your own Google Maps API key.

    `<script async defer src="https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&libraries=places&callback=initMap"></script>`

## How to run

1. Install glup

```
npm install gulp-cli -g
```

2. Install project dependencies

```
npm install
```

3. Serve the web app

```
gulp
```






