# Mobile Web Specialist Certification Course

## Restaurant Reviews_Stage 1

- Responsive: This project is a fully responsive that all pages elements are usable and visible in any devices, including desktop, tablet, and mobile display.

- Accessible: Use the appropriate semantic elements. Appropriate ARIA roles are defined for those elements in which a semantic element is not available.

- Cache the static site for offline use: Use Cache API and a Service Worker to cache the data for the website so that any page (including images) that has been visited is accessible offline.

## How to Run

1. Clone the project into your local `git clone git@github.com:romklao/mws-restaurant-stage-1.git`.

2. Get your own Google Maps API key https://developers.google.com/maps/documentation/javascript/get-api-key.

3. In the index.html file line 40, replace the text `YOUR_GOOGLE_MAPS_API_KEY` with your own Google Maps API key.

    `<script async defer src="https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&libraries=places&callback=initMap"></script>`

4. In the restaurant.html file line 62, replace the text `YOUR_GOOGLE_MAPS_API_KEY` with your own Google Maps API key.

    `<script async defer src="https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&libraries=places&callback=initMap"></script>`

5. In a terminal, check the version of Python you have: python -V and launch a local client server using Python from your terminal:

    * Python 2: `python -m SimpleHTTPServer 8000`
    * Python 3: `python3 -m http.server 8000`

6. Visit the site in your browser at http://localhost:8000





