# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WhereShot is a privacy-focused OSINT (Open Source Intelligence) tool for analyzing photo/video metadata to determine when and where images were captured. All processing happens locally in the browser - no external data transmission.

**Core Technologies:**
- Pure vanilla JavaScript (no build tools required)
- Leaflet.js for interactive maps
- exif-js for metadata extraction
- SunCalc for solar position calculations

**Privacy Design:**
- 100% client-side processing
- No server-side components
- No external API calls for image analysis
- Suitable for sensitive investigations

## Development Setup

### Running Locally

The application requires an HTTP server to function properly due to JSON file loading:

```bash
# Recommended method
python -m http.server 8000

# Alternative
npx serve .
```

Then access at `http://localhost:8000`

**Important:** Opening `index.html` directly via `file://` protocol will trigger fallback mode with limited weather station data (20 locations instead of full dataset).

### File Protocol Limitations

When accessed via `file://` protocol:
- `data/stations.json` cannot be loaded (CORS restrictions)
- Application falls back to 20 hardcoded weather stations in `main.js:130-287`
- User receives a warning banner suggesting HTTP server usage

## Architecture

### Core Module Pattern

The application uses a singleton pattern with global namespace `window.WhereShot*`:

```javascript
window.WhereShotApp          // Main application controller
window.WhereShotExifParser   // Metadata extraction engine
window.WhereShotMapController // Map management
window.WhereShotSunCalculator // Solar position calculations
window.WhereShotDateTimeEstimator // DateTime from filename
window.WhereShotUtils        // Shared utilities
window.WhereShotStations     // Weather station data
```

### Module Loading Order (Critical)

In `index.html:265-270`, scripts must load in this exact order:
1. `utils.js` - Foundation utilities (must load first)
2. `exif-parser.js` - Depends on WhereShotUtils
3. `datetime-estimator.js` - Depends on WhereShotUtils
4. `sun-calculator.js` - Depends on WhereShotUtils
5. `map-controller.js` - Depends on WhereShotUtils
6. `main.js` - Orchestrates all modules (must load last)

### Initialization Flow

The initialization sequence in `main.js` is carefully ordered to prevent race conditions:

1. **DOM Ready** → `WhereShotApp.initialize()`
2. **UI Event Listeners** → Setup before map initialization
3. **Station Data Loading** → Load `data/stations.json` or fallback
4. **Security Setup** → Configure CSP and crypto checks
5. **External Links Init** → Default states and security attributes
6. **Map Initialization (Deferred)** → 500ms delay via `initializeMapWhenReady()`

**Map Initialization Strategy:**
- Delayed by 500ms to ensure DOM stability (`main.js:64-66`)
- Waits for container visibility with timeout (`map-controller.js:147-186`)
- Multiple size recalculations at 200ms, 500ms, 1000ms intervals
- Custom events: `whereshot:mapInitialized` and `whereshot:mapInitializationFailed`

### Inter-Module Communication

Uses custom DOM events prefixed with `whereshot:`:

```javascript
// Dispatching (map-controller.js:722-727)
document.dispatchEvent(new CustomEvent('whereshot:locationChanged', {
    detail: { latitude, longitude }
}));

// Listening (main.js:472-478)
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

**File:** `js/exif-parser.js`

Handles metadata with security considerations:
- **Sanitization** (`sanitizeString:359-400`): Removes control characters, detects mojibake (garbled text)
- **Security Analysis** (`performSecurityAnalysis:307-353`): Identifies privacy risks (GPS, serial numbers)
- **Data Clearing** (`clearData:535-541`): Secure cleanup of sensitive data

### 2. DateTime Estimation from Filenames

**File:** `js/datetime-estimator.js`

Extracts timestamps from filenames using 50+ patterns:
- Camera formats: `IMG_20240101_123456.jpg`, `DSC_*.jpg`, `VID_*.mp4`
- Screenshot formats: `Screenshot_2024-01-01-12-34-56.png`
- Japanese formats: `2024年1月1日12時34分56秒.jpg`
- Unix timestamps: `1609459200.jpg`

**Reliability Scoring:**
- High (0.9-0.95): Format matches camera conventions
- Medium (0.7-0.85): Partial time information
- Low (0.5-0.7): Date only, ambiguous formats

### 3. Weather Station Lookup

**File:** `data/stations.json` + `main.js:96-124`

Generates links to Japan Meteorological Agency historical weather data:
- Full dataset: 1,000+ observation stations nationwide
- Fallback: 20 major cities when file protocol is used
- Used in `utils.js:URLUtils.generateWeatherURL()` to find nearest station

### 4. Solar Position Calculations

**File:** `js/sun-calculator.js`

Uses SunCalc library to:
- Calculate sun elevation and azimuth at specific time/location
- Determine golden hour, sunset, sunrise times
- Estimate shadow length and direction
- Verify photo authenticity by comparing shadows

### 5. Map Management

**File:** `js/map-controller.js`

**Initialization Challenges:**
The map initialization has been heavily refined to handle timing issues:
- **Container Wait** (`_waitForContainer:121-140`): 5-second timeout to find DOM element
- **Visibility Wait** (`_waitForContainerVisible:147-186`): Checks dimensions every 100ms, max 2 seconds
- **Ready Wait** (`_waitForMapReady:193-216`): Waits for Leaflet's `whenReady()` event
- **Size Invalidation** (`safeInvalidateSize:239-272`): Safe wrapper that checks initialization state

**Three Base Layers:**
- OpenStreetMap (default)
- Satellite imagery (Esri)
- Terrain map (OpenTopoMap)

## Important Code Patterns

### Security Practices

1. **XSS Prevention:** All user input and EXIF data sanitized via `SecurityUtils.escapeHtml()`
2. **CSP Header:** Meta tag in `index.html:11` restricts inline scripts
3. **No eval():** No dynamic code execution
4. **Secure Random:** Uses `window.crypto.getRandomValues()` when available

### Data Sanitization Example

```javascript
// exif-parser.js:359-400
sanitizeString(str) {
    // Remove control characters
    str = str.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

    // Detect mojibake (>50% non-ASCII)
    const nonAsciiMatches = str.match(/[^\x20-\x7E\u3040-\u309F...]/g);
    if (nonAsciiMatches && nonAsciiMatches.length > str.length * 0.5) {
        return null;
    }

    return str.trim();
}
```

### External Link Generation

External service integrations (`js/utils.js:URLUtils`):
- **NASA Worldview:** Satellite imagery for specific date/location
- **GSI Maps:** Japan's Geospatial Information Authority maps
- **JMA Weather:** Historical weather data from nearest station
- **Street View:** Google Street View at coordinates

All links include `target="_blank" rel="noopener noreferrer"` for security.

## Common Development Tasks

### Adding a New File Format

1. Update `FileUtils.ALLOWED_TYPES` in `utils.js`
2. Add validation in `FileUtils.validateFile()`
3. Update UI hint text in `index.html:47`

### Adding a New Datetime Pattern

Add to `dateTimePatterns` array in `datetime-estimator.js:8-200`:

```javascript
{
    pattern: /your_regex_here/,
    format: 'DESCRIPTION',
    reliability: 0.9  // 0.0-1.0 confidence score
}
```

Order matters - patterns are checked sequentially.

### Extending External Links

Add to `URLUtils` in `utils.js` and update UI in `index.html:191-212`.

## Debugging Tips

### Map Initialization Issues

Check console for these log patterns:
```
[WhereShot] Starting map initialization...
[WhereShot] Container found: map
[WhereShot] Container is visible after X attempts
[WhereShot] Map initialization completed successfully
```

If map doesn't display:
1. Verify container has non-zero dimensions
2. Check if `display: none` is preventing visibility detection
3. Use `app.mapInitialized` in console to check state
4. Call `window.WhereShotMapController.safeInvalidateSize()` manually

### EXIF Not Extracting

Common causes:
1. File processed/resized by social media (metadata stripped)
2. PNG files often lack EXIF (format limitation)
3. Camera settings disabled GPS tagging
4. File opened via `file://` protocol in some browsers

Use browser console: `window.WhereShotExifParser.getExtractedData()` to inspect raw data.

### Station Data Not Loading

Check console for:
```
[WhereShot] File protocol detected. Using fallback station data.
```

Solution: Run via HTTP server, not `file://` protocol.

## Git Commit History Notes

Recent important fixes:
- `9ba2445` - Added SRI integrity hashes for CDN resources (security)
- `e4edc6c` - Fixed datetime extraction for filenames with dots
- `e9f291d` - Resolved infinite loop in datetime parsing
- `37dc51e` - Fixed "Map size invalidated" error on initial load

## Known Limitations

1. **Video Files:** Basic metadata only (no frame-by-frame analysis)
2. **RAW Formats:** Not supported (browser limitation)
3. **Offline Mode:** Map tiles require internet connection
4. **Mobile Safari:** Some datetime input limitations
5. **IE11:** Not supported (uses modern ES6+ features)

## Testing Approach

This is a client-side tool with no test suite. Manual testing workflow:

1. **Test with GPS Image:** Use `assets/2016-07-24 10.33.57.jpg` (included sample)
2. **Test without GPS:** Use any screenshot or processed image
3. **Test Datetime Extraction:** Create files with various naming patterns
4. **Test Map Layers:** Switch between OSM/Satellite/Terrain
5. **Test Solar Calculations:** Pick known time/location, verify with SunCalc.org

## Security Considerations

This tool is designed for OSINT investigations:
- **Ethical Use:** Only for authorized security research, journalism, OSINT
- **Privacy Warning:** Shows security analysis of metadata privacy risks
- **No Tracking:** Zero analytics, cookies, or external beacons
- **Offline Capable:** Can run fully offline after initial CDN resource load

When contributing, maintain:
- No external data transmission (except map tiles)
- No logging of sensitive information
- Clear user warnings about metadata privacy risks
