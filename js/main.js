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
    // 訳した文字列で状態を持たない（言語を切り替えても失わないため）。
    this.hashState = 'none';
    this.previewFailed = false;
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

      // 文言を当てる前に言語を決める
      window.I18n.init();
      this.setupLanguageToggle();

      // UIイベントリスナーを設定（地図より先に）
      this.setupOffsetChoices();
      this.setupEventListeners();
      this.initializeExternalLinks();
      window.WhereShotMapController.setStatusMessage({ key: 'map.statusLoading', params: {} });
      this.renderLanguage();
      this.isInitialized = true;
    } catch {
      console.error('WhereShot: failed to initialize the application');
      window.WhereShotUtils.UIUtils.showError('error.initFailed');
    }
  }

  /**
   * 言語切り替えボタンを配線する
   */
  setupLanguageToggle() {
    document.getElementById('langToggle')?.addEventListener('click', () => {
      window.I18n.setLanguage(window.I18n.language === 'ja' ? 'en' : 'ja');
    });
    document.addEventListener('languagechange', () => this.renderLanguage());
  }

  /**
   * 現在の状態を、選ばれている言語で描き直す。
   * 結果が無いときは解析し直さない（空の状態を壊さないため）。
   */
  renderLanguage() {
    window.WhereShotUtils.UIUtils.retranslateToasts();
    this.renderDropZone();
    this.renderFileInfo();
    this.renderHash();
    this.renderPreviewToggle();
    this.renderPreviewMessage();
    if (this.currentExifData) {
      this.updateEstimation();
      this.updateExifDisplay(this.currentExifData);
    } else {
      this.renderIdleSources();
      this.updateDirectionDisplay();
    }
    this.updateOffsetSource();
    this.updateSunDisplay(this.currentSunData);
    this.updateExternalLinks();
    this.updateReport();
    window.WhereShotMapController.renderLanguage();
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
      window.WhereShotMapController.setStatusMessage({ key: 'map.statusReady', params: {} });
    });
    document.addEventListener('whereshot:mapInitializationFailed', () => {
      this.mapInitialized = false;
      const container = document.getElementById('map');
      container.classList.remove('map-initializing');
      container.classList.add('map-error');
      window.WhereShotMapController.setStatusMessage({ key: 'map.statusFailed', params: {} });
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
          window.WhereShotUtils.UIUtils.showError('external.disabled');
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
        // 1件ずつ出す。訳した文字列を連結すると言語を切り替えたときに直せない。
        for (const key of validation.errors) window.WhereShotUtils.UIUtils.showError(key);
        return;
      }

      this.currentFile = file;
      this.renderFileInfo();
      this.renderDropZone();
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
        window.WhereShotUtils.UIUtils.showError('error.exifUnavailable');
      } else {
        window.WhereShotUtils.UIUtils.showSuccess('toast.analyzed');
      }
    } catch {
      console.error('WhereShot: failed to analyze the file');
      window.WhereShotUtils.UIUtils.showError('error.analyzeFailed');
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
    this.hashState = hash ? 'ready' : 'unavailable';
    this.renderHash();
  }

  /**
   * SHA-256の3つの状態（未計算・算出済み・この環境では不可）を描く
   */
  renderHash() {
    const element = document.getElementById('file-sha256');
    const button = document.getElementById('copy-sha256-btn');
    if (this.hashState === 'ready') {
      element.textContent = this.sha256;
      button.disabled = false;
      return;
    }
    element.textContent = this.hashState === 'unavailable'
      ? window.I18n.t('file.hashUnavailable') : '-';
    button.disabled = true;
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
    const offsetMin = this.offsetDecision ? this.offsetDecision.offsetMin : 0;
    const wall = logic.parseExifDateTime(exifData.dateTimeOriginal);
    document.getElementById('datetime-info').textContent = wall
      ? logic.formatWall(wall) + '\n'
        + window.I18n.t('time.offsetOnly', { offset: logic.formatOffset(offsetMin) })
      : window.I18n.t('exif.noDateTime');

    // GPS情報
    const gpsInfo = document.getElementById('gps-info');
    gpsInfo.replaceChildren();
    const badge = document.createElement('div');
    const hasGPS = logic.isValidLatLng(exifData.latitude, exifData.longitude);
    badge.className = 'gps-status-badge ' + (hasGPS ? 'gps-available' : 'gps-unavailable');
    badge.dataset.i18n = hasGPS ? 'exif.gpsAvailable' : 'exif.gpsUnavailable';
    badge.textContent = window.I18n.t(badge.dataset.i18n);
    gpsInfo.append(badge);
    const coordinates = document.createElement('p');
    coordinates.textContent = hasGPS
      ? logic.decimalToDms(exifData.latitude, true) + ', ' + logic.decimalToDms(exifData.longitude, false)
        + '\n(' + exifData.latitude.toFixed(6) + ', ' + exifData.longitude.toFixed(6) + ')'
      : window.I18n.t('exif.noLocation');
    gpsInfo.append(coordinates);
    if (hasGPS && Number.isFinite(exifData.altitude)) {
      const altitude = document.createElement('p');
      altitude.textContent = window.I18n.t('exif.altitude', { value: exifData.altitude.toFixed(1) });
      gpsInfo.append(altitude);
    }

    // カメラ情報（外部由来の文字列はそのままテキストとして表示）
    const camera = [logic.formatCamera(exifData.make, exifData.model)
      || window.I18n.t('exif.cameraUnknown')];
    if (exifData.lensModel) camera.push(window.I18n.t('exif.lens', { value: exifData.lensModel }));
    if (exifData.software) camera.push(window.I18n.t('exif.software', { value: exifData.software }));
    document.getElementById('camera-info').textContent = camera.join('\n');

    // 撮影設定
    const settings = [];
    if (exifData.iso !== null) settings.push('ISO ' + exifData.iso);
    if (exifData.fNumber !== null) settings.push('f/' + exifData.fNumber);
    const exposure = logic.formatExposure(exifData.exposureTime);
    if (exposure) settings.push(exposure);
    if (exifData.focalLength !== null) settings.push(exifData.focalLength + 'mm');
    document.getElementById('settings-info').textContent = settings.join(', ')
      || window.I18n.t('exif.noSettings');
    this.updateDirectionDisplay();
  }
  /**
   * 日時推定結果を表示
   * @param {object} result - 推定結果
   */
  updateDateTimeEstimationDisplay(result) {
    const logic = WhereShotLogic;
    const offsetMin = this.offsetDecision ? this.offsetDecision.offsetMin : 0;
    const value = document.getElementById('estimated-datetime-value');
    value.textContent = result.best
      ? window.I18n.t('time.withOffset', {
        time: logic.formatWall(logic.utcMsToWall(result.estimatedUtcMs, offsetMin)),
        offset: logic.formatOffset(offsetMin),
      }) + '\n' + (logic.formatUtc(result.estimatedUtcMs) || window.I18n.t('time.unknown'))
      : window.I18n.t('estimation.none');
    const confidence = document.getElementById('estimation-confidence');
    const percent = Math.round(result.confidence * 100);
    confidence.textContent = window.I18n.t('estimation.confidence', { percent });
    confidence.className = 'estimation-confidence ' + (percent >= 80 ? 'high' : percent >= 60 ? 'medium' : 'low');
    document.getElementById('set-estimated-datetime-btn').hidden = !result.best;

    const warnings = result.conflicts.map((conflict) => ({
      severity: 'warning',
      message: logic.msg('estimation.conflict', {
        a: logic.msg(logic.SOURCE_KEYS[conflict.a]), b: logic.msg(logic.SOURCE_KEYS[conflict.b]),
      }),
    }));
    for (const note of result.notes) {
      warnings.push({
        severity: 'info',
        message: logic.msg('estimation.noteModified', { source: logic.msg(logic.SOURCE_KEYS[note.type]) }),
      });
    }
    if (!result.best) warnings.push({ severity: 'warning', message: logic.msg('estimation.missing') });
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
      item.textContent = window.I18n.message(warning.message);
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
      container.textContent = window.I18n.t('estimation.noSources');
      return;
    }
    const offsetMin = this.offsetDecision ? this.offsetDecision.offsetMin : 0;
    for (const source of sources) {
      const item = document.createElement('div');
      item.className = 'source-item';
      const label = document.createElement('span');
      label.className = 'source-type';
      label.textContent = window.I18n.message(source.label)
        + (source.hasTime ? '' : window.I18n.t('estimation.dateOnly'));
      const date = document.createElement('span');
      date.className = 'source-datetime';
      const wall = WhereShotLogic.utcMsToWall(source.utcMs, offsetMin);
      date.textContent = wall
        ? window.I18n.t('time.withOffset', {
          time: WhereShotLogic.formatWall(wall), offset: WhereShotLogic.formatOffset(offsetMin),
        })
        : window.I18n.t('time.unknown');
      if (source.type === 'gps_utc' || ['pxl-utc', 'unix-ms', 'unix-s'].includes(source.pattern)) {
        date.textContent += window.I18n.t('estimation.utcRecorded');
      }
      const reliability = document.createElement('span');
      reliability.className = 'source-reliability';
      reliability.textContent = Math.round(source.reliability * 100) + '%';
      item.append(label, date, reliability);
      container.append(item);
    }
  }

  /**
   * 解析前の「待機中」を作り直す。data-i18nを付けるので言語切り替えにも追従する。
   */
  renderIdleSources() {
    const container = document.getElementById('datetime-sources');
    const item = document.createElement('div');
    item.className = 'source-item';
    const label = document.createElement('span');
    label.className = 'source-type';
    label.dataset.i18n = 'estimation.waiting';
    label.textContent = window.I18n.t('estimation.waiting');
    item.append(label);
    container.replaceChildren(item);
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
    window.WhereShotUtils.UIUtils.showSuccess('toast.estimateApplied');
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
    const logic = WhereShotLogic;
    const lines = [];
    if (d.source === 'exif') lines.push(logic.msg('offset.exif'));
    if (d.source === 'gps') {
      lines.push(logic.msg('offset.gps', { residual: String(d.residualSec).replace('-', '−') }));
    }
    if (d.source === 'browser') {
      lines.push(logic.msg('offset.browser'));
      const location = window.WhereShotMapController.getCurrentLocation();
      const hint = logic.longitudeOffsetHint(location?.longitude);
      if (hint !== null && Math.abs(hint - d.offsetMin) >= 120) {
        lines.push(logic.msg('offset.hint', { offset: logic.formatOffset(hint) }));
      }
    }
    if (d.source === 'manual') lines.push(logic.msg('offset.manual'));
    if (d.conflict) lines.push(logic.msg('offset.conflict'));
    const source = document.getElementById('utc-offset-source');
    source.textContent = window.I18n.messages(lines);
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
      ? window.I18n.t('external.weatherStation', { station: weather.station, km: weather.distanceKm })
      : window.I18n.t('external.weather');
    document.getElementById('weather-note').textContent = location && !weather?.station
      ? window.I18n.t('external.weatherNote') : '';
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
      if (notify) window.WhereShotUtils.UIUtils.showError('sun.needInput');
      return;
    }
    this.currentSunData = window.WhereShotSunCalculator.calculateSunPosition(
      location.latitude, location.longitude, utcMs
    );
    this.updateSunDisplay(this.currentSunData);
    this.updateExternalLinks();
    this.updateReport();
    if (notify) window.WhereShotUtils.UIUtils.showSuccess('sun.done');
  }
  /**
   * 太陽と影の表示を更新
   */
  updateSunDisplay(sun) {
    const logic = WhereShotLogic;
    const bearing = (value) => window.I18n.t('sun.bearing', {
      deg: value.toFixed(1), cardinal: window.I18n.t(logic.cardinalKey(value)),
    });
    const noShadow = () => window.I18n.t('sun.noShadow');
    document.getElementById('sun-elevation').textContent = sun ? sun.altitudeDeg.toFixed(1) + '°' : '-';
    document.getElementById('sun-azimuth').textContent = sun ? bearing(sun.azimuthDeg) : '-';
    document.getElementById('sun-phase').textContent = sun ? window.I18n.t(logic.phaseKey(sun.phase)) : '-';
    document.getElementById('shadow-direction').textContent = sun
      ? (sun.shadowDirectionDeg === null ? noShadow() : bearing(sun.shadowDirectionDeg)) : '-';
    document.getElementById('shadow-length').textContent = sun
      ? (sun.shadowRatio === null ? noShadow()
        : window.I18n.t('sun.shadowRatio', { ratio: sun.shadowRatio.toFixed(2) })) : '-';
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
    const logic = WhereShotLogic;
    const direction = this.getCurrentDirection();
    let message = logic.msg('direction.none');
    if (Number.isFinite(direction)) {
      const manual = window.WhereShotMapController.directionSource === 'manual';
      const ref = this.currentExifData?.imgDirectionRef;
      const referenceKey = ref === 'M' ? 'direction.refMagnetic'
        : (ref === 'T' ? 'direction.refTrue' : 'direction.refUnknown');
      message = logic.msg('direction.value', {
        deg: direction.toFixed(1), cardinal: logic.msg(logic.cardinalKey(direction)),
        basis: manual ? logic.msg('direction.manual')
          : logic.msg('direction.exif', { reference: logic.msg(referenceKey) }),
      });
    }
    document.getElementById('direction-info').textContent = window.I18n.message(message);
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
    preview.textContent = window.I18n.messages(WhereShotLogic.buildReport({
      fileName: this.currentFile.name, fileSize: this.currentFile.size, fileType: this.currentFile.type,
      sha256: this.sha256, wall: time.wall, offsetMin: time.offsetMin,
      offsetSource: this.offsetDecision?.source, residualSec: this.offsetDecision?.residualSec,
      dateSource: this.dateWasEdited
        ? WhereShotLogic.msg('report.manualDateTime') : this.currentEstimationResult?.best?.label,
      confidence: this.currentEstimationResult?.confidence || 0,
      latitude: location?.latitude, longitude: location?.longitude, locationSource: this.locationSource,
      directionDeg: this.getCurrentDirection(), sun: this.currentSunData,
      station: this.currentWeather?.station, stationKm: this.currentWeather?.distanceKm,
      generatedAtUtcMs: Date.now(),
    }));
    document.getElementById('copy-report-btn').disabled = false;
  }

  /**
   * Clipboard APIが使えない場合にも操作を継続
   */
  async copyText(text) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard is unavailable');
      await navigator.clipboard.writeText(text);
      window.WhereShotUtils.UIUtils.showSuccess('toast.copied');
    } catch {
      window.WhereShotUtils.UIUtils.showError('error.copyFailed');
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
    if (!confirm(window.I18n.t('app.resetConfirm'))) return;
    ++this.fileGeneration;
    this.clearAnalysisData();
    this.resetUI();
    window.WhereShotUtils.UIUtils.showLoading('drop-zone', false);
    window.WhereShotUtils.UIUtils.showSuccess('toast.reset');
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
    this.hashState = 'none';
    this.previewFailed = false;
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

    // ドロップゾーンとファイル情報の状態をリセット
    this.renderDropZone();
    this.renderFileInfo();
    this.renderHash();
    this.renderPreviewToggle();
    this.renderPreviewMessage();

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

    this.renderIdleSources();

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

    // 地図座標表示をリセット
    window.WhereShotMapController.setStatusMessage({ key: 'map.statusReady', params: {} });
  }

  /**
   * 選択中のファイルの情報を描く（未選択なら「-」）
   */
  renderFileInfo() {
    const file = this.currentFile;
    const set = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };
    set('file-name', file ? file.name : '-');
    set('file-size', file ? window.WhereShotUtils.FileUtils.formatFileSize(file.size) : '-');
    set('file-type', file ? (file.type || window.I18n.t('file.typeUnknown')) : '-');
    set('file-modified', file
      ? (WhereShotLogic.formatUtc(file.lastModified) || window.I18n.t('time.unknown')) : '-');
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
    this.previewFailed = false;
    this.renderPreviewMessage();
    img.onerror = () => {
      img.hidden = true;
      img.removeAttribute('src');
      this.previewFailed = true;
      this.renderPreviewMessage();
      if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    };
    img.src = this.previewUrl;
    display.hidden = false;
    this.renderPreviewToggle();
  }

  /**
   * プレビュー切り替えボタンの文言を、開いているかどうかから組み立てる
   */
  renderPreviewToggle() {
    const display = document.getElementById('image-display');
    const button = document.getElementById('toggle-preview-btn');
    if (!display || !button) return;
    button.textContent = window.I18n.t(display.hidden ? 'preview.show' : 'preview.hide');
  }

  /**
   * プレビューできなかった旨を、状態から描く
   */
  renderPreviewMessage() {
    const message = document.getElementById('preview-message');
    if (message) message.textContent = this.previewFailed ? window.I18n.t('preview.unsupported') : '';
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
    this.previewFailed = false;
    this.renderPreviewMessage();
    this.renderPreviewToggle();
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
   * ボタンのノードを保持したままドロップゾーンを更新（状態はcurrentFileが持つ）
   */
  renderDropZone() {
    const dropZone = document.getElementById('drop-zone');
    const uploaded = !!this.currentFile;
    dropZone.classList.toggle('uploaded', uploaded);
    dropZone.querySelector('.upload-icon').textContent = uploaded ? '✅' : '📸';
    document.getElementById('upload-title').textContent =
      window.I18n.t(uploaded ? 'upload.done' : 'upload.title');
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
