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
  }

  /**
   * アプリケーションを初期化
   */
  async initialize() {
    try {
      console.log('[WhereShot] Initializing application...');

      // DOM要素の準備を待つ
      if (document.readyState === 'loading') {
        await new Promise((resolve) => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }

      // 観測所データを読み込む（エラーハンドリング強化）
      await this.loadStationsData();

      // UIイベントリスナーを設定
      this.setupEventListeners();

      // 地図を初期化
      this.initializeMap();

      // セキュリティ設定
      this.setupSecurity();

      // 外部リンクの初期設定
      this.initializeExternalLinks();

      this.isInitialized = true;
      console.log('[WhereShot] Application initialized successfully');

      // 初期化完了を通知
      this.showWelcomeMessage();
    } catch (error) {
      console.error('[WhereShot] Initialization error:', error);
      window.WhereShotUtils.UIUtils.showError(
        'アプリケーションの初期化に失敗しました。HTTPサーバー経由でアクセスしてください。'
      );
    }
  }

  /**
   * 観測所データを読み込む
   */
  async loadStationsData() {
    try {
      // ファイルプロトコルの検出
      if (window.location.protocol === 'file:') {
        console.warn('[WhereShot] File protocol detected. Using fallback station data.');
        this.initializeFallbackStations();
        return;
      }

      // HTTPサーバー経由での読み込み
      const response = await fetch('data/stations.json');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      window.WhereShotStations = data;
      console.log(`[WhereShot] 観測所 ${data.length} 件を読み込みました`);
      
    } catch (error) {
      console.error('[WhereShot] stations.json の読み込みに失敗:', error);
      this.initializeFallbackStations();
      
      // ユーザーに適切なガイダンスを表示
      if (window.location.protocol === 'file:') {
        this.showFileProtocolWarning();
      }
    }
  }

  /**
   * フォールバック用の観測所データを初期化（20件）
   */
  initializeFallbackStations() {
    window.WhereShotStations = [
      // 北海道
      {
        "name": "札幌",
        "lat": 43.0642,
        "lng": 141.3469,
        "prec_no": 14,
        "block_no": 47412
      },
      {
        "name": "函館",
        "lat": 41.7688,
        "lng": 140.7288,
        "prec_no": 23,
        "block_no": 47430
      },
      // 東北
      {
        "name": "盛岡",
        "lat": 39.7036,
        "lng": 141.1527,
        "prec_no": 33,
        "block_no": 47584
      },
      {
        "name": "仙台",
        "lat": 38.2688,
        "lng": 140.8721,
        "prec_no": 34,
        "block_no": 47590
      },
      {
        "name": "福島",
        "lat": 37.7608,
        "lng": 140.4747,
        "prec_no": 36,
        "block_no": 47595
      },
      {
        "name": "秋田",
        "lat": 39.7186,
        "lng": 140.1024,
        "prec_no": 32,
        "block_no": 47582
      },
      // 関東
      {
        "name": "東京",
        "lat": 35.6895,
        "lng": 139.6917,
        "prec_no": 44,
        "block_no": 47662
      },
      {
        "name": "横浜",
        "lat": 35.4437,
        "lng": 139.638,
        "prec_no": 46,
        "block_no": 47670
      },
      {
        "name": "水戸",
        "lat": 36.3658,
        "lng": 140.4714,
        "prec_no": 40,
        "block_no": 47629
      },
      {
        "name": "宇都宮",
        "lat": 36.5484,
        "lng": 139.8837,
        "prec_no": 41,
        "block_no": 47615
      },
      // 中部
      {
        "name": "名古屋",
        "lat": 35.1815,
        "lng": 136.9066,
        "prec_no": 51,
        "block_no": 47636
      },
      {
        "name": "新潟",
        "lat": 37.9026,
        "lng": 139.0235,
        "prec_no": 54,
        "block_no": 47604
      },
      {
        "name": "金沢",
        "lat": 36.5946,
        "lng": 136.6256,
        "prec_no": 56,
        "block_no": 47605
      },
      // 関西
      {
        "name": "大阪",
        "lat": 34.6937,
        "lng": 135.5023,
        "prec_no": 62,
        "block_no": 47772
      },
      {
        "name": "神戸",
        "lat": 34.6901,
        "lng": 135.1955,
        "prec_no": 63,
        "block_no": 47770
      },
      // 中国・四国
      {
        "name": "広島",
        "lat": 34.3963,
        "lng": 132.4592,
        "prec_no": 67,
        "block_no": 47765
      },
      {
        "name": "高松",
        "lat": 34.3403,
        "lng": 134.0434,
        "prec_no": 72,
        "block_no": 47891
      },
      {
        "name": "松山",
        "lat": 33.8392,
        "lng": 132.7657,
        "prec_no": 73,
        "block_no": 47887
      },
      // 九州・沖縄
      {
        "name": "福岡",
        "lat": 33.5902,
        "lng": 130.4017,
        "prec_no": 82,
        "block_no": 47807
      },
      {
        "name": "鹿児島",
        "lat": 31.5966,
        "lng": 130.5571,
        "prec_no": 88,
        "block_no": 47827
      },
      {
        "name": "那覇",
        "lat": 26.2124,
        "lng": 127.6809,
        "prec_no": 91,
        "block_no": 47936
      }
    ];
    console.log(`[WhereShot] フォールバック観測所データ ${window.WhereShotStations.length} 件を使用中`);
  }

  /**
   * ファイルプロトコル警告を表示
   */
  showFileProtocolWarning() {
    const warningDiv = document.createElement('div');
    warningDiv.className = 'file-protocol-warning';
    warningDiv.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      padding: 1rem;
      text-align: center;
      z-index: 1002;
      font-weight: 600;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;
    
    warningDiv.innerHTML = `
      <div>
        ⚠️ <strong>重要:</strong> より良い動作のため、HTTPサーバー経由でアクセスしてください
        <br>
        <small style="opacity: 0.9; margin-top: 0.5rem; display: block;">
          推奨: <code>python -m http.server 8000</code> 実行後、
          <code>http://localhost:8000</code> でアクセス
        </small>
        <button onclick="this.parentElement.parentElement.remove()" 
                style="margin-left: 1rem; padding: 0.25rem 0.5rem; background: rgba(255,255,255,0.2); 
                       border: none; border-radius: 0.25rem; color: white; cursor: pointer;">
          ×
        </button>
      </div>
    `;
    
    document.body.insertBefore(warningDiv, document.body.firstChild);
    
    // 10秒後に自動で消す
    setTimeout(() => {
      if (warningDiv.parentElement) {
        warningDiv.remove();
      }
    }, 10000);
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

    // キーボードショートカット
    this.setupKeyboardShortcuts();
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
    // カスタム地図イベント
    document.addEventListener('whereshot:locationChanged', (e) => {
      this.onLocationChanged(e.detail);
    });

    document.addEventListener('whereshot:directionChanged', (e) => {
      this.onDirectionChanged(e.detail);
    });
  }

  /**
   * 太陽計算関連のイベントリスナーを設定
   */
  setupSunCalculationListeners() {
    const analysisDate = document.getElementById('analysis-date');

    // 日時変更時の自動計算
    analysisDate?.addEventListener('change', () => {
      if (this.hasValidLocation()) {
        this.calculateSunPosition();
      }
    });
  }

  /**
   * モーダル関連のイベントリスナーを設定
   */
  setupModalListeners() {
    const helpModal = document.getElementById('help-modal');
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
   * キーボードショートカットを設定
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Escapeキーでモーダルを閉じる
      if (e.key === 'Escape') {
        this.hideHelpModal();
      }

      // Ctrl+R でリセット
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        this.resetApplication();
      }

      // F1でヘルプ
      if (e.key === 'F1') {
        e.preventDefault();
        this.showHelpModal();
      }
    });
  }

  /**
   * 地図を初期化
   */
  initializeMap() {
    try {
      window.WhereShotMapController.initializeMap('map', {
        center: [35.6762, 139.6503], // 東京
        zoom: 10,
      });
    } catch (error) {
      console.error('[WhereShot] Map initialization failed:', error);
      window.WhereShotUtils.UIUtils.showError('地図の初期化に失敗しました');
    }
  }

  /**
   * セキュリティ設定
   */
  setupSecurity() {
    // CSPヘッダーの確認（開発用）
    if (document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
      console.log('[WhereShot] CSP header detected');
    }

    // セキュアなランダム値生成の確認
    if (window.crypto && window.crypto.getRandomValues) {
      console.log('[WhereShot] Secure random generation available');
    }
  }

  /**
   * 外部リンクの初期設定
   */
  initializeExternalLinks() {
    // 各外部リンクにデフォルトのtarget="_blank"とrel属性を設定
    const externalLinks = [
      'nasa-worldview-link',
      'weather-link',
      'gsi-map-link',
      'gsi-photo-link',
      'streetview-link',
      'reverse-image-link',
    ];

    externalLinks.forEach((linkId) => {
      const link = document.getElementById(linkId);
      if (link) {
        // デフォルトのhrefを確認（#の場合は無効化）
        if (link.href === '#' || link.href.endsWith('#')) {
          link.style.opacity = '0.5';
          link.style.cursor = 'not-allowed';
          link.onclick = (e) => {
            e.preventDefault();
            window.WhereShotUtils.UIUtils.showError(
              '画像を読み込んでから外部リンクをご利用ください'
            );
          };
        }

        // セキュリティ属性を確実に設定
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
    });

    // 気象庁リンクのデフォルト設定
    const weatherLink = document.getElementById('weather-link');
    if (weatherLink) {
      weatherLink.href = 'https://ds.data.jma.go.jp/obd/stats/etrn/index.php';
      weatherLink.title = '気象庁 過去の気象データ・ダウンロード';
    }

    // 類似画像検索のデフォルト設定
    const reverseImageLink = document.getElementById('reverse-image-link');
    if (reverseImageLink) {
      reverseImageLink.href = 'https://images.google.com/';
      reverseImageLink.title = 'Google画像検索';
    }

    console.log('[WhereShot] External links initialized');
  }

  /**
   * ファイル選択処理
   * @param {File} file - 選択されたファイル
   */
  async handleFileSelection(file) {
    try {
      window.WhereShotUtils.UIUtils.showLoading('drop-zone', true);

      // ファイル検証
      const validation = window.WhereShotUtils.FileUtils.validateFile(file);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      this.currentFile = file;

      // ファイル情報を表示
      this.displayFileInfo(file);

      // ドロップゾーンの状態を更新
      this.updateDropZoneState(true);

      // プレビューエリアを表示
      this.showImagePreview();

      // Exif情報を抽出
      const exifData = await window.WhereShotExifParser.extractExifData(file);
      this.currentExifData = exifData;

      // 日時推定を実行
      const estimationResult =
        window.WhereShotDateTimeEstimator.estimateDateTime(exifData, file);
      this.currentEstimationResult = estimationResult;

      // UI更新
      this.updateExifDisplay(exifData);
      this.updateDateTimeEstimationDisplay(estimationResult);
      this.showAnalysisResults();

      // GPS情報があれば地図に表示
      if (exifData.gps.latitude && exifData.gps.longitude) {
        this.displayLocationOnMap(exifData);
      }

      // 推定日時があれば自動入力
      if (estimationResult.estimated) {
        this.setAnalysisDateTime(estimationResult.estimated);
      }

      // 外部リンクを更新
      this.updateExternalLinks(exifData);

      window.WhereShotUtils.UIUtils.showSuccess('ファイルの解析が完了しました');
    } catch (error) {
      console.error('[WhereShot] File processing error:', error);
      window.WhereShotUtils.UIUtils.showError(
        `ファイル処理エラー: ${error.message}`
      );
    } finally {
      window.WhereShotUtils.UIUtils.showLoading('drop-zone', false);
    }
  }

  /**
   * Exif表示を更新
   * @param {object} exifData - Exif情報
   */
  updateExifDisplay(exifData) {
    // 撮影日時
    const datetimeInfo = document.getElementById('datetime-info');
    if (datetimeInfo) {
      if (exifData.dateTime.original) {
        const formattedDate = window.WhereShotUtils.SecurityUtils.escapeHtml(
          exifData.dateTime.formatted.original || '不明'
        );
        const timezone = exifData.dateTime.timezone
          ? window.WhereShotUtils.SecurityUtils.escapeHtml(
              exifData.dateTime.timezone
            )
          : '';

        datetimeInfo.innerHTML = `
                    <strong>撮影日時:</strong> ${formattedDate}<br>
                    ${
                      timezone
                        ? `<strong>タイムゾーン:</strong> ${timezone}`
                        : ''
                    }
                `;
      } else {
        datetimeInfo.textContent = '日時情報なし';
      }
    }

    // GPS情報
    const gpsInfo = document.getElementById('gps-info');
    if (gpsInfo) {
      if (exifData.gps.latitude && exifData.gps.longitude) {
        const coordinates = window.WhereShotUtils.SecurityUtils.escapeHtml(
          exifData.gps.formatted.coordinates
        );
        const altitude = exifData.gps.altitude
          ? window.WhereShotUtils.SecurityUtils.escapeHtml(
              exifData.gps.formatted.altitude
            )
          : '';

        gpsInfo.innerHTML = `
                    <strong>座標:</strong><br>${coordinates}<br>
                    ${altitude ? `<strong>高度:</strong> ${altitude}` : ''}
                `;
      } else {
        gpsInfo.textContent = 'GPS情報なし';
      }
    }

    // カメラ情報（文字化け対策済み）
    const cameraInfo = document.getElementById('camera-info');
    if (cameraInfo) {
      const cameraText = exifData.camera.formatted.camera || '不明';
      cameraInfo.textContent =
        window.WhereShotUtils.SecurityUtils.escapeHtml(cameraText);
    }

    // 撮影設定
    const settingsInfo = document.getElementById('settings-info');
    if (settingsInfo) {
      const settings = [];
      if (exifData.settings.formatted.iso)
        settings.push(exifData.settings.formatted.iso);
      if (exifData.settings.formatted.aperture)
        settings.push(exifData.settings.formatted.aperture);
      if (exifData.settings.formatted.shutter)
        settings.push(exifData.settings.formatted.shutter);
      if (exifData.settings.formatted.focalLength)
        settings.push(exifData.settings.formatted.focalLength);

      const settingsText =
        settings.length > 0 ? settings.join(', ') : '設定情報なし';
      settingsInfo.textContent =
        window.WhereShotUtils.SecurityUtils.escapeHtml(settingsText);
    }
  }

  /**
   * 日時推定結果を表示
   * @param {object} estimationResult - 推定結果
   */
  updateDateTimeEstimationDisplay(estimationResult) {
    // 推定日時値
    const estimatedValueElement = document.getElementById(
      'estimated-datetime-value'
    );
    if (estimatedValueElement) {
      if (estimationResult.estimated) {
        estimatedValueElement.textContent =
          estimationResult.formatted.estimated;
        estimatedValueElement.style.color = 'var(--text-primary)';
      } else {
        estimatedValueElement.textContent = '推定できませんでした';
        estimatedValueElement.style.color = 'var(--text-muted)';
      }
    }

    // 信頼度
    const confidenceElement = document.getElementById('estimation-confidence');
    if (confidenceElement) {
      const confidencePercent = Math.round(estimationResult.confidence * 100);
      let confidenceLevel = 'low';

      if (confidencePercent >= 80) {
        confidenceLevel = 'high';
      } else if (confidencePercent >= 60) {
        confidenceLevel = 'medium';
      }

      confidenceElement.textContent = `信頼度: ${confidencePercent}%`;
      confidenceElement.className = `estimation-confidence ${confidenceLevel}`;
    }

    // 推定日時セットボタンの表示制御
    const setButton = document.getElementById('set-estimated-datetime-btn');
    if (setButton) {
      setButton.style.display = estimationResult.estimated
        ? 'inline-flex'
        : 'none';
    }

    // 警告メッセージ
    this.displayEstimationWarnings(estimationResult.warnings);

    // ソースリスト
    this.displayDateTimeSources(estimationResult.formatted.sources);
  }

  /**
   * 推定警告を表示
   * @param {Array} warnings - 警告配列
   */
  displayEstimationWarnings(warnings) {
    const warningsContainer = document.getElementById('estimation-warnings');
    if (!warningsContainer) return;

    if (warnings.length === 0) {
      warningsContainer.style.display = 'none';
      return;
    }

    warningsContainer.style.display = 'block';
    warningsContainer.innerHTML = warnings
      .map((warning) => {
        const iconMap = {
          error: '❌',
          warning: '⚠️',
          info: 'ℹ️',
        };

        return `
                <div class="warning-item ${warning.severity}">
                    <span class="warning-icon">${
                      iconMap[warning.severity]
                    }</span>
                    <span class="warning-message">${window.WhereShotUtils.SecurityUtils.escapeHtml(
                      warning.message
                    )}</span>
                </div>
            `;
      })
      .join('');
  }

  /**
   * 日時ソースを表示
   * @param {Array} sources - ソース配列
   */
  displayDateTimeSources(sources) {
    const sourcesContainer = document.getElementById('datetime-sources');
    if (!sourcesContainer) return;

    if (sources.length === 0) {
      sourcesContainer.innerHTML =
        '<div class="source-item"><span class="source-type">日時情報が見つかりませんでした</span></div>';
      return;
    }

    sourcesContainer.innerHTML = sources
      .map((source) => {
        let reliabilityClass = 'low';
        const reliability = parseInt(source.reliability);

        if (reliability >= 80) {
          reliabilityClass = 'high';
        } else if (reliability >= 60) {
          reliabilityClass = 'medium';
        }

        return `
                <div class="source-item">
                    <span class="source-type">${window.WhereShotUtils.SecurityUtils.escapeHtml(
                      source.description
                    )}</span>
                    <span class="source-datetime">${window.WhereShotUtils.SecurityUtils.escapeHtml(
                      source.date
                    )}</span>
                    <span class="source-reliability ${reliabilityClass}">${
          source.reliability
        }</span>
                </div>
            `;
      })
      .join('');
  }

  /**
   * 推定日時を解析日時にセット
   */
  setEstimatedDateTime() {
    if (
      !this.currentEstimationResult ||
      !this.currentEstimationResult.estimated
    ) {
      window.WhereShotUtils.UIUtils.showError('推定日時がありません');
      return;
    }

    try {
      this.setAnalysisDateTime(this.currentEstimationResult.estimated);
      window.WhereShotUtils.UIUtils.showSuccess(
        '推定日時を解析日時にセットしました'
      );

      // 太陽位置の自動計算
      if (this.hasValidLocation()) {
        setTimeout(() => {
          this.calculateSunPosition();
        }, 500);
      }
    } catch (error) {
      console.error('[WhereShot] Set estimated datetime error:', error);
      window.WhereShotUtils.UIUtils.showError('推定日時のセットに失敗しました');
    }
  }

  /**
   * 解析結果を表示
   */
  showAnalysisResults() {
    const resultsDiv = document.getElementById('analysis-results');
    if (resultsDiv) {
      resultsDiv.style.display = 'block';

      // 地図のサイズを再計算
      setTimeout(() => {
        if (
          window.WhereShotMapController &&
          window.WhereShotMapController.map
        ) {
          window.WhereShotMapController.map.invalidateSize();
          console.log('[WhereShot] Map resized after showing results');
        }
      }, 100);

      // スムーズスクロール
      resultsDiv.scrollIntoView({ behavior: 'smooth' });
    }
  }

  /**
   * 地図に位置を表示
   * @param {object} exifData - Exif情報
   */
  displayLocationOnMap(exifData) {
    const lat = exifData.gps.latitude;
    const lng = exifData.gps.longitude;

    window.WhereShotMapController.setLocation(lat, lng, {
      type: 'photo',
      accuracy: exifData.gps.accuracy,
      dateTime: exifData.dateTime.original,
      centerMap: true,
      zoom: 15,
    });

    // GPS精度円を表示
    if (exifData.gps.accuracy) {
      window.WhereShotMapController.showAccuracyCircle(
        lat,
        lng,
        exifData.gps.accuracy
      );
    }
  }

  /**
   * 解析日時を設定
   * @param {Date} dateTime - 日時
   */
  setAnalysisDateTime(dateTime) {
    const analysisDate = document.getElementById('analysis-date');
    if (analysisDate && dateTime) {
      analysisDate.value =
        window.WhereShotUtils.DateUtils.formatForInput(dateTime);
    }
  }

  /**
   * 外部リンクを更新
   * @param {object} exifData - Exif情報
   */
  updateExternalLinks(exifData) {
    const lat = exifData.gps.latitude;
    const lng = exifData.gps.longitude;
    const dateTime = this.currentEstimationResult?.estimated || exifData?.dateTime?.original || null;

    console.log('[WhereShot] Updating external links:', { lat, lng, dateTime });

    // すべての外部リンクを有効化
    this.enableExternalLinks();

    if (lat && lng) {
      // NASA Worldview
      const nasaLink = document.getElementById('nasa-worldview-link');
      if (nasaLink) {
        const nasaURL = window.WhereShotUtils.URLUtils.generateNASAWorldviewURL(
          lat,
          lng,
          dateTime
        );
        nasaLink.href = nasaURL;
        nasaLink.target = '_blank';
        nasaLink.rel = 'noopener noreferrer';
        console.log('[WhereShot] NASA Worldview URL:', nasaURL);
      }

      // 地理院地図
      const gsiMapLink = document.getElementById('gsi-map-link');
      if (gsiMapLink) {
        const gsiURL = window.WhereShotUtils.URLUtils.generateGSIMapURL(
          lat,
          lng
        );
        gsiMapLink.href = gsiURL;
        gsiMapLink.target = '_blank';
        gsiMapLink.rel = 'noopener noreferrer';
        console.log('[WhereShot] GSI Map URL:', gsiURL);
      }

      const gsiPhotoLink = document.getElementById('gsi-photo-link');
      if (gsiPhotoLink) {
        const gsiPhotoURL = window.WhereShotUtils.URLUtils.generateGSIPhotoURL(
          lat,
          lng
        );
        gsiPhotoLink.href = gsiPhotoURL;
        gsiPhotoLink.target = '_blank';
        gsiPhotoLink.rel = 'noopener noreferrer';
        console.log('[WhereShot] GSI Photo URL:', gsiPhotoURL);
      }

      // Street View
      const streetViewLink = document.getElementById('streetview-link');
      if (streetViewLink) {
        const streetViewURL =
          window.WhereShotUtils.URLUtils.generateStreetViewURL(lat, lng);
        streetViewLink.href = streetViewURL;
        streetViewLink.target = '_blank';
        streetViewLink.rel = 'noopener noreferrer';
        console.log('[WhereShot] Street View URL:', streetViewURL);
      }
    }

    // 気象情報（位置情報と日時の両方が必要）
    const weatherLink = document.getElementById('weather-link');
    if (weatherLink) {
      const dateTime =
        exifData?.dateTime?.original ||
        this.currentEstimationResult?.estimated ||
        null;

      const weatherURL = window.WhereShotUtils.URLUtils.generateWeatherURL(
        lat,
        lng,
        dateTime
      );
      weatherLink.href = weatherURL;
      weatherLink.target = '_blank';
      weatherLink.rel = 'noopener noreferrer';
      console.log('[WhereShot] Weather URL:', weatherURL);

      // 位置情報がない場合の処理
      if (!lat || !lng) {
        weatherLink.title =
          '位置情報がないため、気象庁トップページにリンクします';
      } else {
        weatherLink.title = `撮影地点の過去の天気データにリンクします`;
      }
    }

    // 類似画像検索
    const reverseImageLink = document.getElementById('reverse-image-link');
    if (reverseImageLink) {
      const reverseImageURL =
        window.WhereShotUtils.URLUtils.generateReverseImageURL();
      reverseImageLink.href = reverseImageURL;
      reverseImageLink.target = '_blank';
      reverseImageLink.rel = 'noopener noreferrer';
      console.log('[WhereShot] Reverse Image URL:', reverseImageURL);
    }
  }

  /**
   * 外部リンクを有効化
   */
  enableExternalLinks() {
    const externalLinks = [
      'nasa-worldview-link',
      'weather-link',
      'gsi-map-link',
      'gsi-photo-link',
      'streetview-link',
      'reverse-image-link',
    ];

    externalLinks.forEach((linkId) => {
      const link = document.getElementById(linkId);
      if (link) {
        link.style.opacity = '1';
        link.style.cursor = 'pointer';
        link.onclick = null; // イベントハンドラーを削除
      }
    });
  }

  /**
   * 太陽位置を計算
   */
  async calculateSunPosition() {
    try {
      const location = window.WhereShotMapController.getCurrentLocation();
      const analysisDate = document.getElementById('analysis-date');

      if (!location) {
        throw new Error('位置情報が設定されていません');
      }

      if (!analysisDate.value) {
        throw new Error('解析日時が設定されていません');
      }

      const dateTime = new Date(analysisDate.value);
      if (isNaN(dateTime.getTime())) {
        throw new Error('無効な日時です');
      }

      // 太陽位置を計算
      const sunData = window.WhereShotSunCalculator.calculateSunPosition(
        location.latitude,
        location.longitude,
        dateTime
      );

      this.currentSunData = sunData;

      // 結果を表示
      this.updateSunDisplay(sunData);

      // SunCalc.orgリンクを更新
      const sunCalcLink = document.getElementById('suncalc-link');
      if (sunCalcLink) {
        sunCalcLink.href = window.WhereShotSunCalculator.generateSunCalcURL(
          location.latitude,
          location.longitude,
          dateTime
        );
      }

      window.WhereShotUtils.UIUtils.showSuccess('太陽位置の計算が完了しました');
    } catch (error) {
      console.error('[WhereShot] Sun calculation error:', error);
      window.WhereShotUtils.UIUtils.showError(
        `太陽位置計算エラー: ${error.message}`
      );
    }
  }

  /**
   * 太陽表示を更新
   * @param {object} sunData - 太陽データ
   */
  updateSunDisplay(sunData) {
    // 太陽高度
    const sunElevation = document.getElementById('sun-elevation');
    if (sunElevation) {
      sunElevation.textContent = sunData.formatted.elevation;
    }

    // 太陽方位
    const sunAzimuth = document.getElementById('sun-azimuth');
    if (sunAzimuth) {
      sunAzimuth.textContent = sunData.formatted.azimuth;
    }

    // 時間帯
    const sunPhase = document.getElementById('sun-phase');
    if (sunPhase) {
      sunPhase.textContent = sunData.formatted.phase;
    }
  }

  /**
   * 手動位置指定モードを切り替え
   */
  toggleManualLocationMode() {
    window.WhereShotUtils.UIUtils.showSuccess(
      '地図をクリックして位置を指定してください'
    );
  }

  /**
   * 撮影方向設定モードを切り替え
   */
  toggleDirectionMode() {
    const currentMode = window.WhereShotMapController.isDirectionMode;
    window.WhereShotMapController.toggleDirectionMode(!currentMode);
  }

  /**
   * 位置変更イベントハンドラ
   * @param {object} location - 位置情報
   */
  onLocationChanged(location) {
    console.log('[WhereShot] Location changed:', location);

    // 太陽計算がある場合は再計算
    if (this.currentSunData) {
      this.calculateSunPosition();
    }
  }

  /**
   * 方向変更イベントハンドラ
   * @param {object} direction - 方向情報
   */
  onDirectionChanged(direction) {
    console.log('[WhereShot] Direction changed:', direction);
  }

  /**
   * 有効な位置情報があるかチェック
   * @returns {boolean} 有効性
   */
  hasValidLocation() {
    const location = window.WhereShotMapController.getCurrentLocation();
    return location && location.latitude && location.longitude;
  }

  /**
   * ヘルプモーダルを表示
   */
  showHelpModal() {
    const helpModal = document.getElementById('help-modal');
    if (helpModal) {
      helpModal.style.display = 'flex';
    }
  }

  /**
   * ヘルプモーダルを非表示
   */
  hideHelpModal() {
    const helpModal = document.getElementById('help-modal');
    if (helpModal) {
      helpModal.style.display = 'none';
    }
  }

  /**
   * ウェルカムメッセージを表示
   */
  showWelcomeMessage() {
    console.log(
      '%c🔍 WhereShot - 撮影時刻・場所解析ツール',
      'font-size: 16px; font-weight: bold; color: #2563eb;'
    );
    console.log(
      '%c📸 Created by IPUSIRON - セキュリティ重視のOSINTツール',
      'color: #64748b;'
    );
    console.log('%c🔒 すべての処理はローカルで実行されます', 'color: #059669;');
  }

  /**
   * アプリケーションをリセット
   */
  resetApplication() {
    try {
      // 確認ダイアログ
      if (!confirm('すべてのデータをリセットしますか？')) {
        return;
      }

      // データをクリア
      this.currentFile = null;
      this.currentExifData = null;
      this.currentSunData = null;
      this.currentEstimationResult = null;

      // UIをリセット
      this.resetUI();

      // 地図をリセット
      window.WhereShotMapController.resetMap();

      // パーサーデータをクリア
      window.WhereShotExifParser.clearData();
      window.WhereShotSunCalculator.clearData();

      window.WhereShotUtils.UIUtils.showSuccess(
        'アプリケーションがリセットされました'
      );
    } catch (error) {
      console.error('[WhereShot] Reset error:', error);
      window.WhereShotUtils.UIUtils.showError('リセットに失敗しました');
    }
  }

  /**
   * UIをリセット
   */
  resetUI() {
    // 解析結果を非表示
    const resultsDiv = document.getElementById('analysis-results');
    if (resultsDiv) {
      resultsDiv.style.display = 'none';
    }

    // プレビューエリアを非表示
    const previewDiv = document.getElementById('image-preview');
    if (previewDiv) {
      previewDiv.style.display = 'none';
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
      setButton.style.display = 'none';
    }

    const warningsContainer = document.getElementById('estimation-warnings');
    if (warningsContainer) {
      warningsContainer.style.display = 'none';
    }

    const sourcesContainer = document.getElementById('datetime-sources');
    if (sourcesContainer) {
      sourcesContainer.innerHTML =
        '<div class="source-item"><span class="source-type">解析待機中...</span></div>';
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
        window.WhereShotUtils.DateUtils.formatDateTime(
          new Date(file.lastModified)
        );
    }
  }

  /**
   * プレビューエリアを表示
   */
  showImagePreview() {
    const previewDiv = document.getElementById('image-preview');
    if (previewDiv) {
      previewDiv.style.display = 'block';
    }
  }

  /**
   * 画像プレビューの表示切り替え
   */
  toggleImagePreview() {
    const imageDisplay = document.getElementById('image-display');
    const toggleBtn = document.getElementById('toggle-preview-btn');
    const previewImg = document.getElementById('preview-img');

    if (!this.currentFile) return;

    if (imageDisplay.style.display === 'none' || !imageDisplay.style.display) {
      // プレビューを表示
      if (this.currentFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          previewImg.src = e.target.result;
          imageDisplay.style.display = 'block';
          toggleBtn.textContent = '🙈 プレビュー非表示';
        };
        reader.readAsDataURL(this.currentFile);
      } else {
        window.WhereShotUtils.UIUtils.showError(
          '画像ファイルではないため、プレビューできません'
        );
      }
    } else {
      // プレビューを非表示
      imageDisplay.style.display = 'none';
      previewImg.src = '';
      toggleBtn.textContent = '🔍 プレビュー表示';
    }
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
   * ドロップゾーンの状態を更新
   * @param {boolean} uploaded - アップロード済みかどうか
   */
  updateDropZoneState(uploaded) {
    const dropZone = document.getElementById('drop-zone');
    const dropZoneContent = dropZone?.querySelector('.drop-zone-content');

    if (!dropZone || !dropZoneContent) return;

    if (uploaded && this.currentFile) {
      dropZone.classList.add('uploaded');
      dropZoneContent.innerHTML = `
                <div class="upload-icon">✅</div>
                <div>
                    <h3>ファイル読み込み完了</h3>
                    <p>${this.currentFile.name}</p>
                    <small>別のファイルをドロップするか、下のボタンで変更できます</small>
                </div>
            `;
    } else {
      dropZone.classList.remove('uploaded');
      dropZoneContent.innerHTML = `
                <div class="upload-icon">📸</div>
                <h3>画像をドラッグ&ドロップ</h3>
                <p>または <button id="file-select-btn" class="btn btn-primary">ファイルを選択</button></p>
                <small>対応形式: JPEG, PNG, TIFF, MP4</small>
            `;

      // ボタンイベントを再設定
      const fileSelectBtn = document.getElementById('file-select-btn');
      const fileInput = document.getElementById('file-input');
      fileSelectBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
      });
    }
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