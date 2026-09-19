/**
 * WhereShot - メイン制御スクリプト
 * Created by IPUSIRON - セキュリティ重視のOSINTツール
 */

class WhereShotApp {
  constructor() {
    this.currentFile = null;
    this.currentExifData = null;
    this.currentSunData = null;
    this.currentEstimationResult = null;
    this.isInitialized = false;
    this.mapInitialized = false;
    this.fileGeneration = 0;
    this.previewUrl = null;
    this.sha256 = null;
  }

  /**
   * アプリケーションを初期化
   */
  async initialize() {
    try {
      // DOM要素の準備を待つ
      if (document.readyState === 'loading') {
        await new Promise((resolve) => {
          document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
      }

      // UIイベントリスナーを設定（地図より先に）
      this.setupOffsetChoices();
      this.setupEventListeners();
      this.initializeExternalLinks();
      this.isInitialized = true;
    } catch {
      console.error('アプリケーションを初期化できませんでした');
      window.WhereShotUtils.UIUtils.showError('アプリケーションの初期化に失敗しました。再読み込みしてください。');
    }
  }

  /**
   * 撮影地で使われるUTCオフセットの候補を表示
   */
  setupOffsetChoices() {
    const select = document.getElementById('utc-offset');
    for (const offset of WhereShotLogic.OFFSET_CHOICES) {
      const option = document.createElement('option');
      option.value = String(offset);
      option.textContent = 'UTC' + WhereShotLogic.formatOffset(offset);
      select.append(option);
    }
    select.value = '0';
  }
  /**
   * 結果パネルが表示された直後に一度だけ地図を初期化
   */
  async initializeMap() {
    const exif = this.currentExifData;
    const hasGPS = WhereShotLogic.isValidLatLng(exif?.latitude, exif?.longitude);
    await window.WhereShotMapController.initializeMap('map', {
      center: hasGPS ? [exif.latitude, exif.longitude] : [35.6762, 139.6503],
      zoom: hasGPS ? 15 : 10,
    });
    this.mapInitialized = true;
    window.WhereShotMapController.safeInvalidateSize();
  }
  /**
   * UIイベントリスナーを設定
   */
  setupEventListeners() {
    // ファイル選択関連
    this.setupFileUploadListeners();

    // ボタンイベント
    this.setupButtonListeners();

    // 地図関連
    this.setupMapListeners();

    // 太陽計算関連
    this.setupSunCalculationListeners();

    // モーダル関連
    this.setupModalListeners();

  }

  /**
   * ファイルアップロード関連のイベントリスナーを設定
   */
  setupFileUploadListeners() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileSelectBtn = document.getElementById('file-select-btn');

    // ドラッグ&ドロップ
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFileSelection(files[0]);
      }
    });

    // クリックでファイル選択
    dropZone.addEventListener('click', () => {
      fileInput.click();
    });

    fileSelectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    // ファイル入力変更
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFileSelection(e.target.files[0]);
      }
    });
  }

  /**
   * ボタンイベントリスナーを設定
   */
  setupButtonListeners() {
    // ヘルプボタン
    const helpBtn = document.getElementById('help-btn');
    helpBtn?.addEventListener('click', () => {
      this.showHelpModal();
    });

    // リセットボタン
    const clearBtn = document.getElementById('clear-btn');
    clearBtn?.addEventListener('click', () => {
      this.resetApplication();
    });

    // 手動位置指定ボタン
    const manualLocationBtn = document.getElementById('manual-location-btn');
    manualLocationBtn?.addEventListener('click', () => {
      this.toggleManualLocationMode();
    });

    // 撮影方向設定ボタン
    const directionModeBtn = document.getElementById('direction-mode-btn');
    directionModeBtn?.addEventListener('click', () => {
      this.toggleDirectionMode();
    });

    // 太陽位置計算ボタン
    const calculateSunBtn = document.getElementById('calculate-sun-btn');
    calculateSunBtn?.addEventListener('click', () => {
      this.calculateSunPosition();
    });

    // 推定日時セットボタン
    const setEstimatedDateTimeBtn = document.getElementById(
      'set-estimated-datetime-btn'
    );
    setEstimatedDateTimeBtn?.addEventListener('click', () => {
      this.setEstimatedDateTime();
    });

    // 地図レイヤー選択
    const mapLayerSelect = document.getElementById('map-layer-select');
    mapLayerSelect?.addEventListener('change', (e) => {
      window.WhereShotMapController.switchLayer(e.target.value);
    });

    // SHA-256とレポートのコピー
    document.getElementById('copy-sha256-btn').addEventListener('click', () => {
      if (this.sha256) this.copyText(this.sha256);
    });
    document.getElementById('copy-report-btn').addEventListener('click', () => {
      this.copyText(document.getElementById('report-preview').textContent);
    });

    // プレビュー表示切り替えボタン
    const togglePreviewBtn = document.getElementById('toggle-preview-btn');
    togglePreviewBtn?.addEventListener('click', () => {
      this.toggleImagePreview();
    });

    // ファイル変更ボタン
    const changeFileBtn = document.getElementById('change-file-btn');
    changeFileBtn?.addEventListener('click', () => {
      this.changeFile();
    });
  }

  /**
   * 地図関連のイベントリスナーを設定
   */
  setupMapListeners() {
    document.addEventListener('whereshot:locationChanged', (e) => {
      this.onLocationChanged(e.detail);
    });
    document.addEventListener('whereshot:directionChanged', (e) => {
      this.onDirectionChanged(e.detail);
    });

    // 旧インラインスクリプトの初期化状態管理をここに集約
    document.addEventListener('whereshot:mapInitialized', () => {
      this.mapInitialized = true;
      const container = document.getElementById('map');
      container.classList.remove('map-initializing', 'map-error');
      container.classList.add('map-ready');
      document.getElementById('map-coordinates').textContent = '位置指定または方向設定を選んで操作できます';
    });
    document.addEventListener('whereshot:mapInitializationFailed', () => {
      this.mapInitialized = false;
      const container = document.getElementById('map');
      container.classList.remove('map-initializing');
      container.classList.add('map-error');
      document.getElementById('map-coordinates').textContent = '地図の読み込みに失敗しました';
    });
  }
  /**
   * 解析日時とUTCオフセットの変更を反映
   */
  setupSunCalculationListeners() {
    document.getElementById('analysis-date').addEventListener('change', () => {
      this.dateWasEdited = true;
      this.refreshAnalysis();
    });
    document.getElementById('utc-offset').addEventListener('change', (e) => {
      this.offsetDecision = {
        offsetMin: Number(e.target.value), source: 'manual', residualSec: null, conflict: false,
      };
      this.updateEstimation();
      this.updateExifDisplay(this.currentExifData || WhereShotLogic.normalizeTags({}));
      this.refreshAnalysis();
    });
  }
  /**
   * モーダル関連のイベントリスナーを設定
   */
  setupModalListeners() {
    const helpModal = document.getElementById('help-dialog');
    const modalClose = helpModal?.querySelector('.modal-close');

    // モーダルクローズ
    modalClose?.addEventListener('click', () => {
      this.hideHelpModal();
    });

    // オーバーレイクリックでクローズ
    helpModal?.addEventListener('click', (e) => {
      if (e.target === helpModal) {
        this.hideHelpModal();
      }
    });
  }

  /**
   * 外部リンクの初期設定
   */
  initializeExternalLinks() {
    for (const link of document.querySelectorAll('.external-links a, #suncalc-link')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.addEventListener('click', (event) => {
        if (link.getAttribute('aria-disabled') === 'true') {
          event.preventDefault();
          window.WhereShotUtils.UIUtils.showError('位置と解析日時を設定してからリンクをご利用ください');
        }
      });
    }
    this.updateExternalLinks();
  }

  /**
   * 安全なリンクの有効・無効状態を同期
   */
  setExternalLink(id, url) {
    const link = document.getElementById(id);
    link.setAttribute('aria-disabled', String(!url));
    link.classList.toggle('is-disabled', !url);
    if (url) link.href = url;
    else link.removeAttribute('href');
  }
  /**
   * ファイル選択処理
   * @param {File} file - 選択されたファイル
   */
  async handleFileSelection(file) {
    const generation = ++this.fileGeneration;
    this.clearAnalysisData();
    this.resetUI();
    window.WhereShotUtils.UIUtils.showLoading('drop-zone', true);
    try {
      // ファイル検証
      const validation = window.WhereShotUtils.FileUtils.validateFile(file);
      if (!validation.isValid) {
        window.WhereShotUtils.UIUtils.showError(validation.errors.join('、'));
        return;
      }

      this.currentFile = file;
      this.displayFileInfo(file);
      this.updateDropZoneState(true);
      this.showImagePreview();

      // 同期のExifReader例外もextractExifData内で受け止める
      const exifData = await window.WhereShotExifParser.extractExifData(file);
      if (generation !== this.fileGeneration) return;
      this.currentExifData = exifData;
      this.chooseOffset(exifData);
      this.updateEstimation();
      this.updateExifDisplay(exifData);
      await this.calculateFileHash(file, generation);
      if (generation !== this.fileGeneration) return;
      await this.showAnalysisResults();
      if (generation !== this.fileGeneration) return;

      // 0度の緯度・経度も有効
      if (WhereShotLogic.isValidLatLng(exifData.latitude, exifData.longitude)) {
        this.locationSource = 'exif';
        this.displayLocationOnMap(exifData);
      } else {
        window.WhereShotMapController.toggleManualLocationMode(true);
      }

      if (this.currentEstimationResult.estimatedUtcMs !== null) {
        this.setAnalysisDateTime(WhereShotLogic.utcMsToWall(
          this.currentEstimationResult.estimatedUtcMs, this.offsetDecision.offsetMin
        ));
      }
      this.refreshAnalysis();
      if (window.WhereShotExifParser.readFailed) {
        window.WhereShotUtils.UIUtils.showError('この形式または内容からはExifを読み取れませんでした');
      } else {
        window.WhereShotUtils.UIUtils.showSuccess('ファイルの解析が完了しました');
      }
    } catch {
      console.error('ファイルを解析できませんでした');
      window.WhereShotUtils.UIUtils.showError('ファイルを解析できませんでした。形式や内容を確認してください');
    } finally {
      if (generation === this.fileGeneration) {
        window.WhereShotUtils.UIUtils.showLoading('drop-zone', false);
      }
    }
  }

  /**
   * 撮影時点のブラウザー側オフセットはDOM側だけで取得する
   */
  chooseOffset(exif) {
    const logic = WhereShotLogic;
    const filename = logic.extractDatesFromFilename(this.currentFile.name, Date.now());
    const wall = logic.parseExifDateTime(exif.dateTimeOriginal)
      || logic.parseExifDateTime(exif.dateTimeDigitized)
      || logic.parseExifDateTime(exif.dateTime)
      || filename.find((source) => source.wall)?.wall;
    const browserDate = wall
      ? new Date(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second)
      : new Date(this.currentFile.lastModified);
    this.offsetDecision = logic.decideOffset({
      exifOffset: exif.offsetTimeOriginal, wall, gpsUtcMs: exif.gpsUtcMs,
      browserOffsetMin: -browserDate.getTimezoneOffset(),
    });
    const select = document.getElementById('utc-offset');
    const value = String(this.offsetDecision.offsetMin);
    // Exifに候補外の有効な分単位オフセットがある場合も、値を黙って変えない。
    select.querySelectorAll('[data-custom]').forEach((option) => option.remove());
    if (!Array.from(select.options).some((option) => option.value === value)) {
      const option = document.createElement('option');
      option.value = value;
      option.dataset.custom = 'true';
      option.textContent = 'UTC' + logic.formatOffset(this.offsetDecision.offsetMin);
      select.append(option);
    }
    select.value = value;
  }

  /**
   * ファイルのバイト列をSHA-256にする。内容を保存・送信しない。
   */
  async calculateFileHash(file, generation) {
    let hash = null;
    try {
      if (globalThis.crypto?.subtle) {
        const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
        hash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
      }
    } catch {
      // セキュアコンテキスト以外などでも解析は続ける。
    }
    if (generation !== this.fileGeneration) return;
    this.sha256 = hash;
    document.getElementById('file-sha256').textContent = hash || 'この開き方では計算できません';
    document.getElementById('copy-sha256-btn').disabled = !hash;
  }

  /**
   * 選択中のオフセットで全ソースを再評価
   */
  updateEstimation() {
    if (!this.currentFile || !this.currentExifData) return;
    this.currentEstimationResult = WhereShotLogic.estimateDateTime({
      exif: this.currentExifData, fileName: this.currentFile.name,
      lastModifiedMs: this.currentFile.lastModified,
      offsetMin: this.offsetDecision.offsetMin, nowMs: Date.now(),
    });
    this.updateDateTimeEstimationDisplay(this.currentEstimationResult);
  }
  /**
   * Exif表示を更新
   * @param {object} exifData - 正規化済みExif情報
   */
  updateExifDisplay(exifData) {
    const logic = WhereShotLogic;
    const wall = logic.parseExifDateTime(exifData.dateTimeOriginal);
    document.getElementById('datetime-info').textContent = wall
      ? logic.formatWall(wall, this.offsetDecision.offsetMin).replace('（', '\n（') : '日時情報なし';

    // GPS情報
    const gpsInfo = document.getElementById('gps-info');
    gpsInfo.replaceChildren();
    const badge = document.createElement('div');
    const hasGPS = logic.isValidLatLng(exifData.latitude, exifData.longitude);
    badge.className = 'gps-status-badge ' + (hasGPS ? 'gps-available' : 'gps-unavailable');
    badge.textContent = hasGPS ? '✓ GPS有り' : '✕ GPS無し';
    gpsInfo.append(badge);
    const coordinates = document.createElement('p');
    coordinates.textContent = hasGPS
      ? logic.decimalToDms(exifData.latitude, true) + ', ' + logic.decimalToDms(exifData.longitude, false)
        + '\n(' + exifData.latitude.toFixed(6) + ', ' + exifData.longitude.toFixed(6) + ')'
      : '位置情報が記録されていません';
    gpsInfo.append(coordinates);
    if (hasGPS && Number.isFinite(exifData.altitude)) {
      const altitude = document.createElement('p');
      altitude.textContent = '高度: ' + exifData.altitude.toFixed(1) + 'm';
      gpsInfo.append(altitude);
    }

    // カメラ情報（外部由来の文字列はそのままテキストとして表示）
    const camera = [logic.formatCamera(exifData.make, exifData.model)];
    if (exifData.lensModel) camera.push('レンズ: ' + exifData.lensModel);
    if (exifData.software) camera.push('ソフトウェア: ' + exifData.software);
    document.getElementById('camera-info').textContent = camera.join('\n');

    // 撮影設定
    const settings = [];
    if (exifData.iso !== null) settings.push('ISO ' + exifData.iso);
    if (exifData.fNumber !== null) settings.push('f/' + exifData.fNumber);
    const exposure = logic.formatExposure(exifData.exposureTime);
    if (exposure) settings.push(exposure);
    if (exifData.focalLength !== null) settings.push(exifData.focalLength + 'mm');
    document.getElementById('settings-info').textContent = settings.join(', ') || '設定情報なし';
    this.updateDirectionDisplay();
  }
  /**
   * 日時推定結果を表示
   * @param {object} result - 推定結果
   */
  updateDateTimeEstimationDisplay(result) {
    const logic = WhereShotLogic;
    const value = document.getElementById('estimated-datetime-value');
    value.textContent = result.best
      ? logic.formatWall(logic.utcMsToWall(result.estimatedUtcMs, this.offsetDecision.offsetMin), this.offsetDecision.offsetMin)
        + '\n' + logic.formatUtc(result.estimatedUtcMs)
      : '推定できませんでした';
    const confidence = document.getElementById('estimation-confidence');
    const percent = Math.round(result.confidence * 100);
    confidence.textContent = '整合度: ' + percent + '%';
    confidence.className = 'estimation-confidence ' + (percent >= 80 ? 'high' : percent >= 60 ? 'medium' : 'low');
    document.getElementById('set-estimated-datetime-btn').hidden = !result.best;

    const warnings = result.conflicts.map((conflict) => ({
      severity: 'warning',
      message: logic.SOURCE_LABEL[conflict.a] + 'と' + logic.SOURCE_LABEL[conflict.b] + 'の日時が食い違っています',
    }));
    for (const note of result.notes) {
      warnings.push({
        severity: 'info',
        message: logic.SOURCE_LABEL[note.type] + 'が推定日時と異なります。撮影後に保存・編集・コピーされた可能性があります',
      });
    }
    if (!result.best) warnings.push({ severity: 'warning', message: '日時情報が見つかりません' });
    this.displayEstimationWarnings(warnings);
    this.displayDateTimeSources(result.sources);
  }
  /**
   * 推定警告を表示
   * @param {Array} warnings - 警告配列
   */
  displayEstimationWarnings(warnings) {
    const container = document.getElementById('estimation-warnings');
    container.replaceChildren();
    container.hidden = warnings.length === 0;
    for (const warning of warnings) {
      const item = document.createElement('div');
      item.className = 'warning-item ' + warning.severity;
      item.textContent = warning.message;
      container.append(item);
    }
  }
  /**
   * 日時ソースを選択中のオフセットで表示
   * @param {Array} sources - ソース配列
   */
  displayDateTimeSources(sources) {
    const container = document.getElementById('datetime-sources');
    container.replaceChildren();
    if (!sources.length) {
      container.textContent = '日時情報が見つかりませんでした';
      return;
    }
    for (const source of sources) {
      const item = document.createElement('div');
      item.className = 'source-item';
      const label = document.createElement('span');
      label.className = 'source-type';
      label.textContent = source.label + (source.hasTime ? '' : '（日付のみ・時刻は正午）');
      const date = document.createElement('span');
      date.className = 'source-datetime';
      date.textContent = WhereShotLogic.formatWall(
        WhereShotLogic.utcMsToWall(source.utcMs, this.offsetDecision.offsetMin), this.offsetDecision.offsetMin
      );
      if (source.type === 'gps_utc' || ['pxl-utc', 'unix-ms', 'unix-s'].includes(source.pattern)) {
        date.textContent += '［UTCで記録］';
      }
      const reliability = document.createElement('span');
      reliability.className = 'source-reliability';
      reliability.textContent = Math.round(source.reliability * 100) + '%';
      item.append(label, date, reliability);
      container.append(item);
    }
  }
  /**
   * 推定日時を解析日時にセット
   */
  setEstimatedDateTime() {
    if (!this.currentEstimationResult?.best) return;
    this.dateWasEdited = false;
    this.setAnalysisDateTime(WhereShotLogic.utcMsToWall(
      this.currentEstimationResult.estimatedUtcMs, this.offsetDecision.offsetMin
    ));
    this.refreshAnalysis();
    window.WhereShotUtils.UIUtils.showSuccess('推定日時を解析日時にセットしました');
  }
  /**
   * 解析結果を表示したあとに地図を初期化
   */
  async showAnalysisResults() {
    const results = document.getElementById('analysis-results');
    results.hidden = false;
    await this.initializeMap();
    // ファイル情報と解析の先頭へ移動する。
    document.getElementById('image-preview').scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }
  /**
   * 地図にExif位置・メートル単位の精度・撮影方位を表示
   */
  displayLocationOnMap(exif) {
    const map = window.WhereShotMapController;
    map.setLocation(exif.latitude, exif.longitude, {
      type: 'photo', accuracy: exif.hPositioningError, centerMap: true, zoom: 15,
    });
    if (exif.hPositioningError !== null) {
      map.showAccuracyCircle(exif.latitude, exif.longitude, exif.hPositioningError);
    }
    map.setExifDirection(exif.imgDirection);
  }
  /**
   * 撮影地の壁時計を秒単位で設定
   */
  setAnalysisDateTime(wall) {
    document.getElementById('analysis-date').value = WhereShotLogic.wallToInputValue(wall);
  }

  /**
   * 太陽位置・外部リンク・レポートが共有する唯一の日時
   */
  getAnalysisTime() {
    const wall = WhereShotLogic.inputValueToWall(document.getElementById('analysis-date').value);
    const offsetMin = Number(document.getElementById('utc-offset').value);
    return { wall, offsetMin, utcMs: WhereShotLogic.wallToUtcMs(wall, offsetMin) };
  }

  /**
   * 解析日時・位置の変更をすべての出力に反映
   */
  refreshAnalysis() {
    this.updateOffsetSource();
    if (this.hasValidLocation() && this.getAnalysisTime().utcMs !== null) {
      this.calculateSunPosition(false);
    } else {
      this.currentSunData = null;
      this.updateSunDisplay(null);
    }
    this.updateExternalLinks();
    this.updateReport();
  }

  /**
   * UTCオフセットの根拠と警告を表示。経度の目安は適用しない。
   */
  updateOffsetSource() {
    const d = this.offsetDecision;
    if (!d) return;
    const lines = [];
    if (d.source === 'exif') lines.push('ExifのOffsetTimeOriginalから');
    if (d.source === 'gps') {
      lines.push('GPS時刻（UTC）との差から推定（残差 ' + String(d.residualSec).replace('-', '−') + ' 秒）');
    }
    if (d.source === 'browser') {
      lines.push('このブラウザーのタイムゾーンを仮に使っています。撮影地が違う場合は選び直してください');
      const location = window.WhereShotMapController.getCurrentLocation();
      const hint = WhereShotLogic.longitudeOffsetHint(location?.longitude);
      if (hint !== null && Math.abs(hint - d.offsetMin) >= 120) {
        lines.push('撮影地の経度からの目安はUTC' + WhereShotLogic.formatOffset(hint)
          + 'です（標準時・夏時間とは一致しないことがあります）。UTCオフセットを確認してください');
      }
    }
    if (d.source === 'manual') lines.push('手動で指定');
    if (d.conflict) lines.push('ExifのオフセットとGPS時刻からの推定が食い違っています');
    const source = document.getElementById('utc-offset-source');
    source.textContent = lines.join('\n');
    source.classList.toggle('offset-warning', d.source === 'browser' || d.conflict);
  }
  /**
   * 外部リンクを更新（解析日時＋UTCオフセットに統一）
   */
  updateExternalLinks() {
    const logic = WhereShotLogic;
    const location = window.WhereShotMapController.getCurrentLocation();
    const lat = location?.latitude;
    const lng = location?.longitude;
    const { wall, utcMs } = this.getAnalysisTime();
    this.setExternalLink('nasa-worldview-link', logic.nasaWorldviewUrl(lat, lng, wall));
    this.setExternalLink('gsi-map-link', logic.gsiMapUrl(lat, lng, false));
    this.setExternalLink('gsi-photo-link', logic.gsiMapUrl(lat, lng, true));
    this.setExternalLink('streetview-link', logic.streetViewUrl(lat, lng, this.getCurrentDirection()));
    this.setExternalLink('suncalc-link', logic.sunCalcOrgUrl(lat, lng, wall));
    const weather = logic.jmaHourlyUrl(lat, lng, utcMs, window.WhereShotStations);
    this.currentWeather = weather;
    this.setExternalLink('weather-link', weather?.url || null);
    document.getElementById('weather-link').textContent = weather?.station
      ? '過去の天気（' + weather.station + '・約' + weather.distanceKm + 'km）' : '過去の天気';
    document.getElementById('weather-note').textContent = location && !weather?.station
      ? '200km以内に気象庁の観測所がありません（日本国外など）。日時も確認してください' : '';
  }
  /**
   * 太陽位置を計算
   */
  calculateSunPosition(notify = true) {
    const location = window.WhereShotMapController.getCurrentLocation();
    const { utcMs } = this.getAnalysisTime();
    if (!this.hasValidLocation() || utcMs === null) {
      this.currentSunData = null;
      this.updateSunDisplay(null);
      if (notify) window.WhereShotUtils.UIUtils.showError('撮影位置と解析日時を設定してください');
      return;
    }
    this.currentSunData = window.WhereShotSunCalculator.calculateSunPosition(
      location.latitude, location.longitude, utcMs
    );
    this.updateSunDisplay(this.currentSunData);
    this.updateExternalLinks();
    this.updateReport();
    if (notify) window.WhereShotUtils.UIUtils.showSuccess('太陽位置の計算が完了しました');
  }
  /**
   * 太陽と影の表示を更新
   */
  updateSunDisplay(sun) {
    const direction = (value) => value.toFixed(1) + '°（' + WhereShotLogic.toCardinalJa(value) + '）';
    document.getElementById('sun-elevation').textContent = sun ? sun.altitudeDeg.toFixed(1) + '°' : '-';
    document.getElementById('sun-azimuth').textContent = sun ? direction(sun.azimuthDeg) : '-';
    document.getElementById('sun-phase').textContent = sun ? WhereShotLogic.PHASE_JA[sun.phase] : '-';
    document.getElementById('shadow-direction').textContent = sun
      ? (sun.shadowDirectionDeg === null ? '影なし' : direction(sun.shadowDirectionDeg)) : '-';
    document.getElementById('shadow-length').textContent = sun
      ? (sun.shadowRatio === null ? '影なし' : '高さの' + sun.shadowRatio.toFixed(2) + '倍') : '-';
  }
  /**
   * 手動位置指定モードを切り替え
   */
  toggleManualLocationMode() {
    const map = window.WhereShotMapController;
    map.toggleManualLocationMode(!map.isManualLocationMode);
  }
  /**
   * 撮影方向設定モードを切り替え
   */
  toggleDirectionMode() {
    const currentMode = window.WhereShotMapController.isDirectionMode;
    window.WhereShotMapController.toggleDirectionMode(!currentMode);
  }

  /**
   * 位置変更イベントハンドラー
   */
  onLocationChanged() {
    this.locationSource = 'manual';
    this.updateDirectionDisplay();
    this.refreshAnalysis();
  }
  /**
   * 方向変更イベントハンドラー
   */
  onDirectionChanged() {
    this.updateDirectionDisplay();
    this.updateExternalLinks();
    this.updateReport();
  }

  /**
   * 現在の方位は手動設定を優先し、なければExifの記録を使う
   */
  getCurrentDirection() {
    const manual = window.WhereShotMapController.getCurrentDirection();
    return Number.isFinite(manual) ? manual : (this.currentExifData?.imgDirection ?? null);
  }

  /**
   * 撮影方位と真北・磁北の根拠を表示
   */
  updateDirectionDisplay() {
    const direction = this.getCurrentDirection();
    let text = '撮影方位: 記録なし';
    if (Number.isFinite(direction)) {
      const manual = window.WhereShotMapController.directionSource === 'manual';
      const ref = this.currentExifData?.imgDirectionRef;
      const reference = ref === 'M' ? '磁北基準' : (ref === 'T' ? '真北基準' : '基準不明');
      text = '撮影方位: ' + direction.toFixed(1) + '°（' + WhereShotLogic.toCardinalJa(direction) + '）'
        + (manual ? '［手動］' : '［Exif・' + reference + '］');
    }
    document.getElementById('direction-info').textContent = text;
  }

  /**
   * 保存せず、確認できるプレーンテキストのレポートを作る
   */
  updateReport() {
    const preview = document.getElementById('report-preview');
    if (!this.currentFile) {
      preview.textContent = '';
      document.getElementById('copy-report-btn').disabled = true;
      return;
    }
    const time = this.getAnalysisTime();
    const location = window.WhereShotMapController.getCurrentLocation();
    preview.textContent = WhereShotLogic.buildReport({
      fileName: this.currentFile.name, fileSize: this.currentFile.size, fileType: this.currentFile.type,
      sha256: this.sha256, wall: time.wall, offsetMin: time.offsetMin,
      offsetSource: this.offsetDecision?.source, residualSec: this.offsetDecision?.residualSec,
      dateSourceLabel: this.dateWasEdited ? '解析日時を手動指定' : this.currentEstimationResult?.best?.label,
      confidence: this.currentEstimationResult?.confidence || 0,
      latitude: location?.latitude, longitude: location?.longitude, locationSource: this.locationSource,
      directionDeg: this.getCurrentDirection(), sun: this.currentSunData,
      station: this.currentWeather?.station, stationKm: this.currentWeather?.distanceKm,
      generatedAtUtcMs: Date.now(),
    });
    document.getElementById('copy-report-btn').disabled = false;
  }

  /**
   * Clipboard APIが使えない場合にも操作を継続
   */
  async copyText(text) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('コピー非対応');
      await navigator.clipboard.writeText(text);
      window.WhereShotUtils.UIUtils.showSuccess('コピーしました');
    } catch {
      window.WhereShotUtils.UIUtils.showError('コピーできませんでした。内容を選択してコピーしてください');
    }
  }
  /**
   * 0度を含む有効な位置情報があるかチェック
   */
  hasValidLocation() {
    const location = window.WhereShotMapController.getCurrentLocation();
    return WhereShotLogic.isValidLatLng(location?.latitude, location?.longitude);
  }
  /**
   * ヘルプダイアログを表示
   */
  showHelpModal() {
    document.getElementById('help-dialog').showModal();
  }
  /**
   * ヘルプダイアログを閉じる
   */
  hideHelpModal() {
    document.getElementById('help-dialog').close();
  }
  /**
   * アプリケーションをリセット
   */
  resetApplication() {
    if (!confirm('すべてのデータをリセットしますか？')) return;
    ++this.fileGeneration;
    this.clearAnalysisData();
    this.resetUI();
    window.WhereShotUtils.UIUtils.showLoading('drop-zone', false);
    window.WhereShotUtils.UIUtils.showSuccess('アプリケーションがリセットされました');
  }

  /**
   * 次の読み込みが失敗しても、前のファイルの情報を残さない
   */
  clearAnalysisData() {
    this.hideImagePreview();
    this.currentFile = null;
    this.currentExifData = null;
    this.currentSunData = null;
    this.currentEstimationResult = null;
    this.currentWeather = null;
    this.offsetDecision = null;
    this.locationSource = null;
    this.sha256 = null;
    this.dateWasEdited = false;
    window.WhereShotMapController.resetMap();
    window.WhereShotExifParser.clearData();
    window.WhereShotSunCalculator.clearData();
    document.getElementById('toast-region').replaceChildren();
  }
  /**
   * UIをリセット
   */
  resetUI() {
    // 解析結果を非表示
    const resultsDiv = document.getElementById('analysis-results');
    if (resultsDiv) {
      resultsDiv.hidden = true;
    }

    // プレビューエリアを非表示
    const previewDiv = document.getElementById('image-preview');
    if (previewDiv) {
      previewDiv.hidden = true;
    }

    // ドロップゾーンの状態をリセット
    this.updateDropZoneState(false);

    // 各情報をクリア
    const infoElements = [
      'datetime-info',
      'gps-info',
      'camera-info',
      'settings-info',
      'sun-elevation',
      'sun-azimuth',
      'sun-phase',
      'shadow-direction',
      'shadow-length',
      'direction-info',
      'file-sha256',
      'utc-offset-source',
    ];

    infoElements.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = '-';
      }
    });

    // 推定日時情報をクリア
    const estimatedValueElement = document.getElementById(
      'estimated-datetime-value'
    );
    if (estimatedValueElement) {
      estimatedValueElement.textContent = '-';
    }

    const confidenceElement = document.getElementById('estimation-confidence');
    if (confidenceElement) {
      confidenceElement.textContent = '-';
      confidenceElement.className = 'estimation-confidence';
    }

    const setButton = document.getElementById('set-estimated-datetime-btn');
    if (setButton) {
      setButton.hidden = true;
    }

    const warningsContainer = document.getElementById('estimation-warnings');
    if (warningsContainer) {
      warningsContainer.hidden = true;
    }

    const sourcesContainer = document.getElementById('datetime-sources');
    if (sourcesContainer) {
      sourcesContainer.textContent = '解析待機中...';
    }

    // 入力をクリア
    const analysisDate = document.getElementById('analysis-date');
    if (analysisDate) {
      analysisDate.value = '';
    }

    // ファイル入力をクリア
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
      fileInput.value = '';
    }

    this.updateExternalLinks();
    this.updateReport();
    document.getElementById('copy-sha256-btn').disabled = true;

    // 地図座標表示をリセット
    const mapCoordinates = document.getElementById('map-coordinates');
    if (mapCoordinates) {
      mapCoordinates.textContent = '位置指定または方向設定を選んで操作できます';
    }
  }

  /**
   * ファイル情報を表示
   * @param {File} file - ファイルオブジェクト
   */
  displayFileInfo(file) {
    // ファイル名
    const fileNameElement = document.getElementById('file-name');
    if (fileNameElement) {
      fileNameElement.textContent = file.name;
    }

    // ファイルサイズ
    const fileSizeElement = document.getElementById('file-size');
    if (fileSizeElement) {
      fileSizeElement.textContent =
        window.WhereShotUtils.FileUtils.formatFileSize(file.size);
    }

    // ファイル形式
    const fileTypeElement = document.getElementById('file-type');
    if (fileTypeElement) {
      fileTypeElement.textContent = file.type || '不明';
    }

    // 更新日
    const fileModifiedElement = document.getElementById('file-modified');
    if (fileModifiedElement) {
      fileModifiedElement.textContent =
        WhereShotLogic.formatUtc(file.lastModified);
    }
  }

  /**
   * プレビューエリアを表示
   */
  showImagePreview() {
    const previewDiv = document.getElementById('image-preview');
    if (previewDiv) {
      previewDiv.hidden = false;
    }
  }

  /**
   * 画像プレビューの表示切り替え
   */
  toggleImagePreview() {
    if (!this.currentFile) return;
    const display = document.getElementById('image-display');
    if (!display.hidden) {
      this.hideImagePreview();
      return;
    }
    const img = document.getElementById('preview-img');
    const message = document.getElementById('preview-message');
    this.previewUrl = URL.createObjectURL(this.currentFile);
    img.hidden = false;
    message.textContent = '';
    img.onerror = () => {
      img.hidden = true;
      img.removeAttribute('src');
      message.textContent = 'この形式はプレビューできません';
      if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    };
    img.src = this.previewUrl;
    display.hidden = false;
    document.getElementById('toggle-preview-btn').textContent = '🙈 プレビュー非表示';
  }

  /**
   * プレビューのURLを解放
   */
  hideImagePreview() {
    const img = document.getElementById('preview-img');
    img.onerror = null;
    img.removeAttribute('src');
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = null;
    document.getElementById('image-display').hidden = true;
    document.getElementById('preview-message').textContent = '';
    document.getElementById('toggle-preview-btn').textContent = '🔍 プレビュー表示';
  }
  /**
   * ファイルを変更
   */
  changeFile() {
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
      fileInput.click();
    }
  }

  /**
   * ボタンのノードを保持したままドロップゾーンを更新
   */
  updateDropZoneState(uploaded) {
    const dropZone = document.getElementById('drop-zone');
    dropZone.classList.toggle('uploaded', uploaded);
    dropZone.querySelector('.upload-icon').textContent = uploaded ? '✅' : '📸';
    document.getElementById('upload-title').textContent = uploaded ? 'ファイル読み込み完了' : '画像をドラッグ&ドロップ';
    document.getElementById('upload-filename').textContent = uploaded ? this.currentFile.name : '';
  }
}

// アプリケーションインスタンスを作成
const app = new WhereShotApp();

// ページ読み込み完了後に初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    app.initialize();
  });
} else {
  app.initialize();
}

// グローバルに公開（デバッグ用）
window.WhereShotApp = app;
