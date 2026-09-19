# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WhereShot is a privacy-focused OSINT (Open Source Intelligence) tool for analyzing image metadata to determine when and where images were captured. Image analysis happens locally. Leaflet is loaded from cdnjs; selected map tiles are requested only after loading an image.

**Core Technologies:**
- Pure vanilla JavaScript (no build tools required)
- Leaflet.js for interactive maps
- Self-hosted ExifReader 4.12.0 for metadata extraction
- Self-hosted SunCalc 1.9.0 for solar position calculations

**Privacy Design:**
- 100% client-side processing
- No server-side components
- No external API calls for image analysis
- Tile providers receive the viewed area; assess privacy before sensitive investigations.

## Development Setup

### Running Locally

```bash
python -m http.server 8000
npm test
```

Open http://localhost:8000. Node 22 or later is required for tests; there are no npm dependencies.
Opening index.html via file:// also works, including all 54 stations.
HTTP is recommended for map use because file:// cannot send a valid HTTP Referer.

### File Structure

- js/whereshot-logic.js: pure calculations, no DOM or environment-dependent clock
- js/main.js: DOM, file selection, UTC offset selection, SHA-256, report and preview
- js/exif-parser.js: File.arrayBuffer and ExifReader adapter
- js/sun-calculator.js: SunCalc adapter
- js/map-controller.js: Leaflet, position/direction modes and layers
- js/utils.js: FileUtils, UIUtils and cleanup helpers
- data/stations.json and data/stations.js: the same 54 stations
- vendor/: unmodified ExifReader and SunCalc, licenses and hash documentation
- test/: dependency-free node:test suite, including README and timezone checks
- .github/workflows/test.yml: push and pull_request checks
- .nojekyll: publish vendor files in the legacy Pages root deployment

## Architecture

### Core Module Pattern

The application uses a singleton pattern with global namespace `window.WhereShot*`:

```javascript
window.WhereShotApp          // Main application controller
window.WhereShotExifParser   // Metadata extraction engine
window.WhereShotMapController // Map management
window.WhereShotSunCalculator // Solar position calculations
globalThis.WhereShotLogic    // Pure calculations, also CommonJS-compatible
window.WhereShotUtils        // Shared utilities
window.WhereShotStations     // Weather station data
```

### Module Loading Order (Critical)

All scripts are classic scripts with defer, in this order:

1. Leaflet 1.9.4 (cdnjs, existing SRI)
2. vendor/exifreader/exif-reader.min.js
3. vendor/suncalc/suncalc.js
4. data/stations.js
5. js/whereshot-logic.js
6. js/utils.js
7. js/exif-parser.js
8. js/sun-calculator.js
9. js/map-controller.js
10. js/main.js

### Initialization Flow

1. DOM ready, offset choices and UI event listeners
2. External links initialized as disabled
3. A file is selected: clear old results and markers, then parse metadata
4. Show analysis-results, then initialize the map once
5. Set position, wall-clock time and UTC offset; calculate sun, links and report

No map or tile request is created on startup. No polling for a hidden container is needed.
Use safeInvalidateSize after showing the results.

### Inter-Module Communication

Uses custom DOM events prefixed with `whereshot:`:

```javascript
// Dispatching (map-controller.js)
document.dispatchEvent(new CustomEvent('whereshot:locationChanged', {
    detail: { latitude, longitude }
}));

// Listening (main.js)
document.addEventListener('whereshot:locationChanged', (e) => {
    this.onLocationChanged(e.detail);
});
```

**Available Events:**
- `whereshot:mapInitialized` - Map ready for use
- `whereshot:mapInitializationFailed` - Map initialization error
- `whereshot:locationChanged` - User selected/changed location
- `whereshot:directionChanged` - Camera direction updated

## Key Features Implementation

### 1. EXIF Metadata Extraction

File: js/exif-parser.js. Read File.arrayBuffer, call ExifReader.load with expanded:true,
then WhereShotLogic.normalizeTags. Catch parser exceptions and return all-null metadata.
Always finish loading in finally. Non-ASCII camera names are preserved.
GPSHPositioningError is in meters; GPSDOP is never used as a radius.

### 2. DateTime Estimation from Filenames

File: js/whereshot-logic.js. FILENAME_PATTERNS contains 11 patterns.
Skip overlapping accepted matches; reject invalid calendar values instead of normalizing overflow.
Pixel and Unix names represent UTC. Other names represent wall time at the selected offset.
Confidence is a consistency indicator, at most 0.95, not authenticity evidence.
Exif/file modification times become notes, not conflicts.

### 3. Weather Station Lookup

data/stations.json is authoritative; stations.js contains identical data for HTTP and file://.
nearestStation selects only within 200km. Otherwise link to the JMA top page.
jmaHourlyUrl uses the UTC instant converted to Japan time, and hourly_s1.php.

### 4. Solar Position Calculations

sunReport receives SunCalc as an argument and uses a UTC instant.
sunPhaseKey uses altitude and azimuth, not sunrise/sunset times (polar regions can lack these).
Azimuth is clockwise from true north. Shadows below the horizon are null.
All direction labels use toCardinalJa.

### 5. Map Management

**File:** `js/map-controller.js`

**Initialization:**
Show analysis-results before initializeMap. Initialize once and use safeInvalidateSize on resize.
Position mode and direction mode are mutually exclusive.
directionLayer owns the line and both arrowheads; replacing, disabling or resetting removes it.
Only map-layer-select switches base layers; exactly one tile layer remains active.

**Three Base Layers:**
- OpenStreetMap (default)
- Satellite imagery (Esri)
- Terrain map (OpenTopoMap)

## Important Code Patterns

### Security Practices

- Render external strings with createElement and textContent.
- Use native dialog, hidden/classList, and guarded clipboard access.
- Revoke preview object URLs on hide, replacement and reset.
- Do not save images, Exif, coordinates or reports to persistent browser storage.
- Console warnings/errors must use fixed messages without private values.

CSP in index.html:

```text
default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com;
style-src 'self' https://cdnjs.cloudflare.com;
img-src 'self' data: blob: https://tile.openstreetmap.org https://server.arcgisonline.com https://*.tile.opentopomap.org;
connect-src 'none'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'
```

### Must Not Do

- Do not use local-time Date getters, multi-argument Date, or locale formatting in whereshot-logic.js.
- Do not use DOM, network, storage, randomness or current time inside pure logic.
- Do not change referrer to no-referrer; keep strict-origin-when-cross-origin for OSM.
- Do not restore the {s} subdomain in the OSM tile URL.
- Do not use innerHTML or inline scripts/styles; do not relax CSP.
- Do not edit, format or change versions of vendor files.
- Do not update stations.json without updating stations.js identically.
- Do not add external APIs, npm dependencies, modules or build tools.
- Do not apply longitude-based offset hints automatically.

### Pure Logic API

The complete function list and result shapes are in docs/api_reference.md.
Wall-clock values are {year, month, day, hour, minute, second}; UTC instants are milliseconds.
Browser fallback offsets are calculated only in main.js for the relevant date (including DST).

### External Link Generation

External service URL builders (js/whereshot-logic.js):
- **NASA Worldview:** Satellite imagery for specific date/location
- **GSI Maps:** Japan's Geospatial Information Authority maps
- **JMA Weather:** Historical weather data from nearest station
- **Street View:** Google Street View at coordinates

All links include `target="_blank" rel="noopener noreferrer"` for security.

## Common Development Tasks

### Adding a New File Format

Keep FileUtils.validateFile allowedTypes, index.html accept/hint and README MIME table identical.
Confirm the existing parser actually supports the format.

### Adding a New Datetime Pattern

Add to FILENAME_PATTERNS in whereshot-logic.js.
Order matters: only non-overlapping valid matches are accepted.
Add literal examples to test/logic.test.js and the README table checks.

### Extending External Links

Use pure URL functions and the single getAnalysisTime result in main.js.
Do not introduce a new network API.

## Debugging Tips

- Check analysis-results is visible before map initialization.
- Inspect readFailed for unreadable metadata; the parser returns all-null fields.
- Check selected UTC offset and its source before interpreting solar results.
- Confirm WhereShotStations.length is 54 under both HTTP and file://.
- Do not log coordinates, times, filenames or reports.

## Git Commit History Notes

Recent important fixes:
- `9ba2445` - Added SRI integrity hashes for CDN resources (security)
- `e4edc6c` - Fixed datetime extraction for filenames with dots
- `e9f291d` - Resolved infinite loop in datetime parsing
- `37dc51e` - Fixed "Map size invalidated" error on initial load

## Known Limitations

1. Videos are not supported.
2. HEIC/HEIF preview depends on browser codecs; metadata parsing continues.
3. Leaflet CDN and map tiles need network access.
4. Metadata and filenames can be edited; consistency does not prove authenticity.
5. Magnetic-north camera directions are displayed without correction.

## Testing Approach

Run npm test with Node 22 or later. No network or npm dependencies are needed.
The suite checks exact sample Exif/solar/link/report values, 11 filename patterns,
4 real process timezones, the 54 stations, vendor hashes, README tables, HTML and contrast.
Browser verification covers HTTP and file://, three timezones, malformed images, hostile filenames,
manual position/direction, three map layers, clipboard, preview, dialog and 320/390px screens.

## Security Considerations

Use only for authorized investigation, journalism and education.
Images and Exif are not uploaded, but CDN requests and map tiles expose IP/origin and the viewed area.
External link navigation sends the data encoded in the URL.
Do not promise anonymity or secure erasure of browser memory.
