/**
 * WhereShot - 時刻・Exif・太陽位置・地理情報の純粋ロジック
 * Created by IPUSIRON - セキュリティ重視のOSINTツール
 * 壁時計とUTCの瞬間を分離し、閲覧環境に依存せず計算する。
 */
'use strict';

const WhereShotLogic = (() => {
  const DAY_MS = 86400000;
  const pad = (n) => String(n).padStart(2, '0');
  const rad = (d) => d * Math.PI / 180;
  const deg = (r) => r * 180 / Math.PI;
  const normalizeDegrees = (d) => ((d % 360) + 360) % 360;

  // ========== 日付・時刻ユーティリティ ==========
  function isValidWall(w) {
    if (!w || typeof w !== 'object') return false;
    const keys = ['year', 'month', 'day', 'hour', 'minute', 'second'];
    if (!keys.every((k) => Number.isInteger(w[k]))) return false;
    if (w.year < 1900 || w.year > 2100 || w.month < 1 || w.month > 12) return false;
    const days = new Date(Date.UTC(w.year, w.month, 0)).getUTCDate();
    return w.day >= 1 && w.day <= days && w.hour >= 0 && w.hour <= 23
      && w.minute >= 0 && w.minute <= 59 && w.second >= 0 && w.second <= 59;
  }

  function wallFromMatch(m, hasTime = true) {
    return {
      year: +m[1], month: +m[2], day: +m[3],
      hour: hasTime ? +m[4] : 12,
      minute: hasTime ? +m[5] : 0,
      second: hasTime ? +(m[6] || 0) : 0,
    };
  }

  function parseExifDateTime(str) {
    if (typeof str !== 'string') return null;
    const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(str);
    const w = m ? wallFromMatch(m) : null;
    return isValidWall(w) ? w : null;
  }

  function validOffset(n) {
    return Number.isInteger(n) && n >= -720 && n <= 840;
  }

  function parseOffset(str) {
    if (typeof str !== 'string') return null;
    if (str === 'Z') return 0;
    const m = /^([+-])(\d{2}):(\d{2})$/.exec(str);
    if (!m || +m[3] > 59) return null;
    const n = (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]);
    return validOffset(n) ? n : null;
  }

  function formatOffset(n) {
    if (!validOffset(n)) return '';
    const a = Math.abs(n);
    return `${n < 0 ? '-' : '+'}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
  }

  function wallToUtcMs(w, offsetMin) {
    if (!isValidWall(w) || !validOffset(offsetMin)) return null;
    return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - offsetMin * 60000;
  }

  function utcMsToWall(ms, offsetMin) {
    if (!Number.isFinite(ms) || !validOffset(offsetMin)) return null;
    const d = new Date(ms + offsetMin * 60000);
    if (!Number.isFinite(d.getTime())) return null;
    return {
      year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
      hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds(),
    };
  }

  function formatWall(w, offsetMin = null) {
    if (!isValidWall(w)) return '不明';
    const base = `${w.year}/${pad(w.month)}/${pad(w.day)} ${pad(w.hour)}:${pad(w.minute)}:${pad(w.second)}`;
    return offsetMin === null ? base : `${base}（UTC${formatOffset(offsetMin)}）`;
  }

  function formatUtc(ms) {
    const w = utcMsToWall(ms, 0);
    if (!w) return '不明';
    return `${w.year}-${pad(w.month)}-${pad(w.day)} ${pad(w.hour)}:${pad(w.minute)}:${pad(w.second)} UTC`;
  }

  function wallToInputValue(w) {
    if (!isValidWall(w)) return '';
    return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}:${pad(w.second)}`;
  }

  function inputValueToWall(v) {
    if (typeof v !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(v);
    const w = m ? wallFromMatch(m) : null;
    return isValidWall(w) ? w : null;
  }

  function gpsDateTimeToUtcMs(dateStamp, timeStamp) {
    if (typeof dateStamp !== 'string' || !Array.isArray(timeStamp) || timeStamp.length !== 3) return null;
    const m = /^(\d{4}):(\d{2}):(\d{2})$/.exec(dateStamp);
    if (!m || !timeStamp.every(Number.isFinite)) return null;
    const [hour, minute, seconds] = timeStamp;
    if (seconds < 0 || seconds >= 60) return null;
    const w = { year: +m[1], month: +m[2], day: +m[3], hour, minute, second: Math.floor(seconds) };
    return wallToUtcMs(w, 0);
  }

  function inferOffsetFromGps(wall, gpsUtcMs) {
    if (!isValidWall(wall) || !Number.isFinite(gpsUtcMs)) return null;
    const diffSec = (wallToUtcMs(wall, 0) - gpsUtcMs) / 1000;
    const offsetMin = Math.round(diffSec / 900) * 15;
    const residualSec = diffSec - offsetMin * 60;
    if (!validOffset(offsetMin) || Math.abs(residualSec) > 300) return null;
    return { offsetMin, residualSec };
  }

  function longitudeOffsetHint(lng) {
    return Number.isFinite(lng) ? Math.max(-720, Math.min(840, Math.round(lng / 15) * 60)) : null;
  }

  function decideOffset(input = {}) {
    const { exifOffset, wall, gpsUtcMs, browserOffsetMin = 0 } = input || {};
    const fromExif = parseOffset(exifOffset);
    const fromGps = inferOffsetFromGps(wall, gpsUtcMs);
    if (fromExif !== null) {
      return {
        offsetMin: fromExif, source: 'exif', residualSec: null,
        conflict: !!fromGps && fromGps.offsetMin !== fromExif,
      };
    }
    if (fromGps) return { ...fromGps, source: 'gps', conflict: false };
    return {
      offsetMin: validOffset(browserOffsetMin) ? browserOffsetMin : 0,
      source: 'browser', residualSec: null, conflict: false,
    };
  }

  const OFFSET_CHOICES = [
    -720, -660, -600, -570, -540, -480, -420, -360, -300, -240, -210, -180, -120, -60, 0,
    60, 120, 180, 210, 240, 270, 300, 330, 345, 360, 390, 420, 480, 525, 540, 570, 600,
    630, 660, 720, 765, 780, 840,
  ];

  // ========== 座標・地理ユーティリティ ==========
  const EARTH_RADIUS = 6371000;
  function isValidLatLng(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  /** 2点間の距離を計算（ハーバサイン公式、メートル）。 */
  function distanceM(lat1, lng1, lat2, lng2) {
    const a = Math.sin(rad(lat2 - lat1) / 2) ** 2
      + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
    return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  }

  function bearing(lat1, lng1, lat2, lng2) {
    const y = Math.sin(rad(lng2 - lng1)) * Math.cos(rad(lat2));
    const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2))
      - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lng2 - lng1));
    return normalizeDegrees(deg(Math.atan2(y, x)));
  }

  function destinationPoint(lat, lng, bearingDeg, distM) {
    const d = distM / EARTH_RADIUS;
    const b = rad(bearingDeg);
    const p1 = rad(lat);
    const l1 = rad(lng);
    const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
    const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
    return { lat: deg(p2), lng: ((deg(l2) + 540) % 360) - 180 };
  }

  const CARDINALS_JA = [
    '北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東',
    '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西',
  ];
  function toCardinalJa(d) {
    return Number.isFinite(d) ? CARDINALS_JA[Math.round(normalizeDegrees(d) / 22.5) % 16] : '不明';
  }

  function decimalToDms(value, isLat) {
    if (!Number.isFinite(value)) return '';
    // 最初に1/100秒へ丸め、60秒・60分の繰り上げを保証する。
    const total = Math.round(Math.abs(value) * 360000);
    const degrees = Math.floor(total / 360000);
    const minutes = Math.floor((total % 360000) / 6000);
    const seconds = (total % 6000) / 100;
    const dir = isLat ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
    return `${degrees}°${minutes}'${seconds.toFixed(2)}"${dir}`;
  }

  function nearestStation(lat, lng, stations, maxKm = 200) {
    if (!isValidLatLng(lat, lng) || !Array.isArray(stations) || !Number.isFinite(maxKm)) return null;
    let best = null;
    for (const station of stations) {
      if (!station || !isValidLatLng(station.lat, station.lng)) continue;
      const km = distanceM(lat, lng, station.lat, station.lng) / 1000;
      if (km <= maxKm && (!best || km < best.distanceKm)) best = { station, distanceKm: km };
    }
    return best ? { station: best.station, distanceKm: Math.round(best.distanceKm) } : null;
  }

  // ========== 外部URL生成ユーティリティ ==========
  const c6 = (v) => Number(v.toFixed(6));
  function nasaWorldviewUrl(lat, lng, wall) {
    if (!isValidLatLng(lat, lng) || !isValidWall(wall)) return null;
    const v = [c6(lng - 1), c6(lat - 1), c6(lng + 1), c6(lat + 1)].join(',');
    const layers = [
      'MODIS_Terra_CorrectedReflectance_TrueColor', 'MODIS_Aqua_CorrectedReflectance_TrueColor',
      'VIIRS_SNPP_CorrectedReflectance_TrueColor', 'Reference_Labels_15m', 'Reference_Features_15m',
    ];
    const params = new URLSearchParams({ v, t: wallToInputValue(wall).slice(0, 10), l: layers.join(',') });
    return `https://worldview.earthdata.nasa.gov/?${params}`;
  }

  function sunCalcOrgUrl(lat, lng, wall) {
    if (!isValidLatLng(lat, lng) || !isValidWall(wall)) return null;
    const date = `${wall.year}.${pad(wall.month)}.${pad(wall.day)}`;
    return `https://www.suncalc.org/#/${c6(lat)},${c6(lng)},15/${date}/${pad(wall.hour)}:${pad(wall.minute)}/1/3`;
  }

  function gsiMapUrl(lat, lng, photo = false) {
    if (!isValidLatLng(lat, lng)) return null;
    const base = photo ? 'ort' : 'std';
    return `https://maps.gsi.go.jp/#15/${c6(lat)}/${c6(lng)}/&base=${base}&ls=${base}&disp=1&vs=c1j0h0k0l0u0t0z0r0s0m0f1`;
  }

  function streetViewUrl(lat, lng, headingDeg) {
    if (!isValidLatLng(lat, lng)) return null;
    let url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${c6(lat)},${c6(lng)}`;
    if (Number.isFinite(headingDeg)) url += `&heading=${Math.round(normalizeDegrees(headingDeg)) % 360}`;
    return url;
  }

  const JMA_TOP = 'https://www.data.jma.go.jp/stats/etrn/index.php';
  function jmaHourlyUrl(lat, lng, utcMs, stations) {
    if (!isValidLatLng(lat, lng)) return null;
    const nearest = nearestStation(lat, lng, stations);
    const day = utcMsToWall(utcMs, 540);
    if (!nearest || !day) return { url: JMA_TOP, station: null, distanceKm: null };
    const params = new URLSearchParams({
      prec_no: nearest.station.prec_no, block_no: nearest.station.block_no,
      year: day.year, month: day.month, day: day.day, view: '',
    });
    return {
      url: `https://www.data.jma.go.jp/stats/etrn/view/hourly_s1.php?${params}`,
      station: nearest.station.name, distanceKm: nearest.distanceKm,
    };
  }

  // ========== 太陽位置・影 ==========
  const PHASE_JA = {
    night: '夜間', dawn: '明け方（薄明）', dusk: '夕暮れ（薄明）',
    'golden-morning': '朝のゴールデンアワー', 'golden-evening': '夕方のゴールデンアワー',
    morning: '午前', afternoon: '午後',
  };
  function sunPhaseKey(altDeg, azDeg) {
    const east = azDeg < 180;
    if (altDeg < -6) return 'night';
    if (altDeg < -0.833) return east ? 'dawn' : 'dusk';
    if (altDeg < 6) return east ? 'golden-morning' : 'golden-evening';
    return east ? 'morning' : 'afternoon';
  }

  function sunReport(SunCalc, lat, lng, utcMs) {
    if (!isValidLatLng(lat, lng) || !Number.isFinite(utcMs)) return null;
    const position = SunCalc.getPosition(new Date(utcMs), lat, lng);
    const altitudeDeg = deg(position.altitude);
    const azimuthDeg = normalizeDegrees(deg(position.azimuth) + 180);
    return {
      altitudeDeg, azimuthDeg, phase: sunPhaseKey(altitudeDeg, azimuthDeg),
      shadowDirectionDeg: altitudeDeg > 0 ? (azimuthDeg + 180) % 360 : null,
      shadowRatio: altitudeDeg > 0 ? 1 / Math.tan(rad(altitudeDeg)) : null,
    };
  }

  // ========== ファイル名からの日時（強いパターンから順に） ==========
  const FILENAME_PATTERNS = [
    {
      id: 'ymd-hms-sep', kind: 'wall', hasTime: true, reliability: 0.6,
      re: /(?<!\d)(\d{4})[-_.\/](\d{1,2})[-_.\/](\d{1,2})(?:[-_ T]| at )(\d{1,2})[-_:.](\d{2})[-_:.](\d{2})(?!\d)/g,
    },
    {
      id: 'ymd-sep-hms-compact', kind: 'wall', hasTime: true, reliability: 0.6,
      re: /(?<!\d)(\d{4})[-_.](\d{2})[-_.](\d{2})[-_ ](\d{2})(\d{2})(\d{2})(?!\d)/g,
    },
    {
      id: 'pxl-utc', kind: 'utc', hasTime: true, reliability: 0.6,
      re: /PXL_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\d{3}(?!\d)/gi,
    },
    {
      id: 'ymd-hms-compact', kind: 'wall', hasTime: true, reliability: 0.6,
      re: /(?<!\d)(\d{4})(\d{2})(\d{2})[-_ ](\d{2})(\d{2})(\d{2})(?!\d)/g,
    },
    {
      id: 'ymdhms-14', kind: 'wall', hasTime: true, reliability: 0.55,
      re: /(?<!\d)(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?!\d)/g,
    },
    {
      id: 'ja-full', kind: 'wall', hasTime: true, reliability: 0.6,
      re: /(\d{4})年(\d{1,2})月(\d{1,2})日\s?(\d{1,2})時(\d{1,2})分(\d{1,2})秒/g,
    },
    {
      id: 'ymd-sep', kind: 'wall', hasTime: false, reliability: 0.4,
      re: /(?<!\d)(\d{4})[-_.\/](\d{1,2})[-_.\/](\d{1,2})(?!\d)/g,
    },
    {
      id: 'ymd-8', kind: 'wall', hasTime: false, reliability: 0.4,
      re: /(?<!\d)(\d{4})(\d{2})(\d{2})(?!\d)/g,
    },
    { id: 'ja-date', kind: 'wall', hasTime: false, reliability: 0.4, re: /(\d{4})年(\d{1,2})月(\d{1,2})日/g },
    { id: 'unix-ms', kind: 'unix-ms', hasTime: true, reliability: 0.5, re: /(?<!\d)(1\d{12})(?!\d)/g },
    { id: 'unix-s', kind: 'unix-s', hasTime: true, reliability: 0.5, re: /(?<!\d)(1\d{9})(?!\d)/g },
  ];

  function extractDatesFromFilename(name, nowMs) {
    if (typeof name !== 'string' || !Number.isFinite(nowMs)) return [];
    const out = [];
    const taken = [];
    const maxYear = new Date(nowMs).getUTCFullYear() + 1;
    for (const pattern of FILENAME_PATTERNS) {
      // 呼び出し間で正規表現のlastIndexを共有しない。
      for (const m of name.matchAll(new RegExp(pattern.re))) {
        const start = m.index;
        const end = start + m[0].length;
        if (taken.some(([a, b]) => start < b && end > a)) continue;
        let item = null;
        if (pattern.kind.startsWith('unix')) {
          const ms = +m[1] * (pattern.kind === 'unix-s' ? 1000 : 1);
          if (ms >= 1e12 && ms <= nowMs + 7 * DAY_MS) item = { utcMs: ms };
        } else {
          const w = wallFromMatch(m, pattern.hasTime);
          if (isValidWall(w) && w.year >= 1990 && w.year <= maxYear) {
            item = pattern.kind === 'utc' ? { utcMs: wallToUtcMs(w, 0) } : { wall: w };
          }
        }
        if (item) {
          taken.push([start, end]);
          out.push({
            pattern: pattern.id, matched: m[0], hasTime: pattern.hasTime,
            reliability: pattern.reliability, ...item,
          });
        }
      }
    }
    return out;
  }

  // ========== 複数のソースから日時を推定 ==========
  const SOURCE_LABEL = {
    exif_original: 'Exif撮影日時', gps_utc: 'GPS時刻（UTC）', exif_digitized: 'Exifデジタル化日時',
    exif_modified: 'Exif更新日時', filename: 'ファイル名', file_modified: 'ファイル更新日時',
  };
  function estimateDateTime(input = {}) {
    const { exif: givenExif, fileName = '', lastModifiedMs, offsetMin = 0, nowMs } = input || {};
    const exif = givenExif || {};
    const sources = [];
    const push = (type, data) => sources.push({ type, label: SOURCE_LABEL[type], ...data });
    for (const [key, type, reliability] of [
      ['dateTimeOriginal', 'exif_original', 0.95], ['dateTimeDigitized', 'exif_digitized', 0.85],
      ['dateTime', 'exif_modified', 0.5],
    ]) {
      const wall = parseExifDateTime(exif[key]);
      if (wall) push(type, { wall, hasTime: true, reliability });
    }
    if (Number.isFinite(exif.gpsUtcMs)) push('gps_utc', { utcMs: exif.gpsUtcMs, hasTime: true, reliability: 0.9 });
    for (const f of extractDatesFromFilename(fileName, nowMs)) {
      push('filename', { ...f, label: `ファイル名（${f.matched}）` });
    }
    if (Number.isFinite(lastModifiedMs)) push('file_modified', { utcMs: lastModifiedMs, hasTime: true, reliability: 0.3 });
    for (const source of sources) {
      if (source.wall) source.utcMs = wallToUtcMs(source.wall, offsetMin);
    }
    sources.sort((a, b) => Number(b.hasTime) - Number(a.hasTime) || b.reliability - a.reliability);

    // 更新日時は撮影後に変わりうるため、整合度を下げる材料にしない。
    const secondary = new Set(['exif_modified', 'file_modified']);
    const primary = sources.filter((source) => !secondary.has(source.type));
    const conflicts = [];
    for (let i = 0; i < primary.length; i++) {
      for (let j = i + 1; j < primary.length; j++) {
        const tolerance = primary[i].hasTime && primary[j].hasTime ? 3600000 : DAY_MS;
        const diffMs = Math.abs(primary[i].utcMs - primary[j].utcMs);
        if (diffMs > tolerance) conflicts.push({ a: primary[i].type, b: primary[j].type, diffMs });
      }
    }
    const pairs = primary.length * (primary.length - 1) / 2;
    const agreement = pairs ? (pairs - conflicts.length) / pairs : 1;
    const best = sources[0] || null;
    const confidence = best ? Math.round(best.reliability * (0.5 + 0.5 * agreement) * 100) / 100 : 0;
    const notes = [];
    if (best) {
      for (const source of sources) {
        const diffMs = Math.abs(source.utcMs - best.utcMs);
        if (secondary.has(source.type) && source !== best && diffMs >= 3600000) notes.push({ type: source.type, diffMs });
      }
    }
    return { sources, conflicts, notes, agreement, best, estimatedUtcMs: best ? best.utcMs : null, confidence };
  }

  // ========== ExifReaderのexpandedタグを平たい値にする ==========
  function tagString(tag) {
    if (!tag || typeof tag !== 'object') return null;
    const value = Array.isArray(tag.value) ? tag.value[0] : tag.value;
    return typeof value === 'string' ? value : (typeof tag.description === 'string' ? tag.description || null : null);
  }

  function ratio(value) {
    if (Array.isArray(value) && value.length === 2 && value.every(Number.isFinite) && value[1] !== 0) {
      const result = value[0] / value[1];
      return Number.isFinite(result) ? result : null;
    }
    return Number.isFinite(value) ? value : null;
  }

  function cleanText(value) {
    if (typeof value !== 'string') return null;
    const text = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim();
    return text ? Array.from(text).slice(0, 200).join('') : null;
  }

  function normalizeTags(tags) {
    const e = tags?.exif || {};
    const g = tags?.gps || {};
    const ts = Array.isArray(e.GPSTimeStamp?.value) ? e.GPSTimeStamp.value.map(ratio) : null;
    const direction = ratio(e.GPSImgDirection?.value);
    const directionRef = tagString(e.GPSImgDirectionRef);
    const coordinatesValid = isValidLatLng(g.Latitude, g.Longitude);
    const isoValue = e.ISOSpeedRatings?.value;
    const iso = Array.isArray(isoValue) ? isoValue[0] : isoValue;
    const accuracy = ratio(e.GPSHPositioningError?.value);
    return {
      dateTimeOriginal: tagString(e.DateTimeOriginal),
      dateTimeDigitized: tagString(e.DateTimeDigitized),
      dateTime: tagString(e.DateTime),
      offsetTimeOriginal: tagString(e.OffsetTimeOriginal),
      offsetTime: tagString(e.OffsetTime),
      gpsUtcMs: gpsDateTimeToUtcMs(tagString(e.GPSDateStamp), ts),
      latitude: coordinatesValid ? g.Latitude : null,
      longitude: coordinatesValid ? g.Longitude : null,
      altitude: Number.isFinite(g.Altitude) ? g.Altitude : null,
      imgDirection: Number.isFinite(direction) && direction >= 0 && direction < 360 ? direction : null,
      imgDirectionRef: ['T', 'M'].includes(directionRef) ? directionRef : null,
      hPositioningError: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
      make: cleanText(tagString(e.Make)),
      model: cleanText(tagString(e.Model)),
      software: cleanText(tagString(e.Software)),
      lensModel: cleanText(tagString(e.LensModel)),
      exposureTime: ratio(e.ExposureTime?.value),
      fNumber: ratio(e.FNumber?.value),
      iso: Number.isFinite(iso) ? iso : null,
      focalLength: ratio(e.FocalLength?.value),
    };
  }

  function formatExposure(time) {
    if (!Number.isFinite(time) || time <= 0) return null;
    return time >= 1 ? `${Number(time.toFixed(1))}s` : `1/${Math.round(1 / time)}s`;
  }

  function formatCamera(make, model) {
    const safeMake = cleanText(make);
    const safeModel = cleanText(model);
    if (!safeMake && !safeModel) return '不明';
    if (!safeMake) return safeModel;
    if (!safeModel) return safeMake;
    return safeModel.toLowerCase().includes(safeMake.toLowerCase()) ? safeModel : `${safeMake} ${safeModel}`;
  }

  // ========== レポート（作成時刻も呼び出し側が指定） ==========
  const OFFSET_SOURCE_JA = {
    exif: 'ExifのOffsetTimeOriginal', gps: 'GPS時刻との差から推定',
    browser: 'ブラウザーのタイムゾーン（要確認）', manual: '手動で指定',
  };
  const LOCATION_SOURCE_JA = { exif: 'ExifのGPS', manual: '地図で手動指定' };
  function formatInt(n) {
    return Number.isFinite(n) ? String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '0';
  }

  function buildReport(input) {
    const d = input && typeof input === 'object' ? input : {};
    const lines = ['WhereShot 解析レポート'];
    lines.push(`ファイル: ${d.fileName || '不明'}（${formatInt(d.fileSize)} バイト、${d.fileType || '種類不明'}）`);
    lines.push(`SHA-256: ${d.sha256 || '未計算'}`);
    if (isValidWall(d.wall) && validOffset(d.offsetMin)) {
      lines.push(`撮影日時（現地）: ${formatWall(d.wall, d.offsetMin)}`);
      lines.push(`撮影日時（UTC）: ${formatUtc(wallToUtcMs(d.wall, d.offsetMin))}`);
      const residual = d.offsetSource === 'gps' && Number.isFinite(d.residualSec) ? `（残差 ${d.residualSec} 秒）` : '';
      lines.push(`UTCオフセットの根拠: ${OFFSET_SOURCE_JA[d.offsetSource] || '不明'}${residual}`);
      lines.push(`日時の根拠: ${d.dateSourceLabel || '不明'}（整合度 ${Math.round((d.confidence || 0) * 100)}%）`);
    } else {
      lines.push('撮影日時: 不明');
    }
    if (isValidLatLng(d.latitude, d.longitude)) {
      const coordinates = `${d.latitude.toFixed(6)}, ${d.longitude.toFixed(6)}`;
      lines.push(`位置: ${coordinates}（${decimalToDms(d.latitude, true)}, ${decimalToDms(d.longitude, false)}）`);
      lines.push(`位置の根拠: ${LOCATION_SOURCE_JA[d.locationSource] || '不明'}`);
    } else {
      lines.push('位置: 不明');
    }
    lines.push(Number.isFinite(d.directionDeg)
      ? `撮影方位: ${d.directionDeg.toFixed(1)}°（${toCardinalJa(d.directionDeg)}）` : '撮影方位: 記録なし');
    if (d.sun && Number.isFinite(d.sun.altitudeDeg) && Number.isFinite(d.sun.azimuthDeg)) {
      const sun = d.sun;
      const position = `高度 ${sun.altitudeDeg.toFixed(1)}°、方位 ${sun.azimuthDeg.toFixed(1)}°（${toCardinalJa(sun.azimuthDeg)}）`;
      lines.push(`太陽: ${position}、${PHASE_JA[sun.phase] || '不明'}`);
      if (Number.isFinite(sun.shadowDirectionDeg) && Number.isFinite(sun.shadowRatio)) {
        const direction = `${sun.shadowDirectionDeg.toFixed(1)}°（${toCardinalJa(sun.shadowDirectionDeg)}）`;
        lines.push(`影: ${direction}方向、長さは高さの ${sun.shadowRatio.toFixed(2)} 倍`);
      } else {
        lines.push('影: なし（太陽が地平線の下）');
      }
    }
    if (d.station) lines.push(`最寄りの気象庁観測所: ${d.station}（約 ${d.stationKm} km）`);
    lines.push(`レポート作成: ${formatUtc(d.generatedAtUtcMs)}`);
    lines.push('注意: Exif・ファイル名・更新日時は書き換えられる。この結果だけで撮影の事実を断定しないこと。');
    return lines.join('\n');
  }

  return {
    isValidWall, parseExifDateTime, parseOffset, formatOffset, wallToUtcMs, utcMsToWall,
    formatWall, formatUtc, wallToInputValue, inputValueToWall, gpsDateTimeToUtcMs,
    inferOffsetFromGps, longitudeOffsetHint, decideOffset, OFFSET_CHOICES,
    isValidLatLng, distanceM, bearing, destinationPoint, toCardinalJa, decimalToDms, nearestStation,
    nasaWorldviewUrl, sunCalcOrgUrl, gsiMapUrl, streetViewUrl, jmaHourlyUrl, JMA_TOP,
    sunPhaseKey, sunReport, PHASE_JA, FILENAME_PATTERNS, SOURCE_LABEL,
    extractDatesFromFilename, estimateDateTime, normalizeTags, formatExposure, formatCamera,
    buildReport, formatInt,
  };
})();

globalThis.WhereShotLogic = WhereShotLogic;
if (typeof module === 'object' && module.exports) module.exports = WhereShotLogic;
