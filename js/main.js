/**
 * WhereShot - メイン制御スクリプト
 * Created by IPUSIRON - セキュリティ重視のOSINTツール
 */

class WhereShotApp {
    constructor() {
        this.currentFile = null;
        this.currentExifData = null;
        this.currentSunData = null;
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
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }

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
            window.WhereShotUtils.UIUtils.showError('アプリケーションの初期化に失敗しました');
        }
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
                zoom: 10
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
            'reverse-image-link'
        ];

        externalLinks.forEach(linkId => {
            const link = document.getElementById(linkId);
            if (link) {
                // デフォルトのhrefを確認（#の場合は無効化）
                if (link.href === '#' || link.href.endsWith('#')) {
                    link.style.opacity = '0.5';
                    link.style.cursor = 'not-allowed';
                    link.onclick = (e) => {
                        e.preventDefault();
                        window.WhereShotUtils.UIUtils.showError('画像を読み込んでから外部リンクをご利用ください');
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
            weatherLink.href = 'https://www.data.jma.go.jp/obd/stats/etrn/index.php';
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

            // UI更新
            this.updateExifDisplay(exifData);
            this.showAnalysisResults();

            // GPS情報があれば地図に表示
            if (exifData.gps.latitude && exifData.gps.longitude) {
                this.displayLocationOnMap(exifData);
            }

            // 撮影日時があれば自動入力
            if (exifData.dateTime.original) {
                this.setAnalysisDateTime(exifData.dateTime.original);
            }

            // 外部リンクを更新
            this.updateExternalLinks(exifData);

            window.WhereShotUtils.UIUtils.showSuccess('ファイルの解析が完了しました');

        } catch (error) {
            console.error('[WhereShot] File processing error:', error);
            window.WhereShotUtils.UIUtils.showError(`ファイル処理エラー: ${error.message}`);
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
                const timezone = exifData.dateTime.timezone ? 
                    window.WhereShotUtils.SecurityUtils.escapeHtml(exifData.dateTime.timezone) : '';
                
                datetimeInfo.innerHTML = `
                    <strong>撮影日時:</strong> ${formattedDate}<br>
                    ${timezone ? `<strong>タイムゾーン:</strong> ${timezone}` : ''}
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
                const altitude = exifData.gps.altitude ? 
                    window.WhereShotUtils.SecurityUtils.escapeHtml(exifData.gps.formatted.altitude) : '';
                
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
            cameraInfo.textContent = window.WhereShotUtils.SecurityUtils.escapeHtml(cameraText);
        }

        // 撮影設定
        const settingsInfo = document.getElementById('settings-info');
        if (settingsInfo) {
            const settings = [];
            if (exifData.settings.formatted.iso) settings.push(exifData.settings.formatted.iso);
            if (exifData.settings.formatted.aperture) settings.push(exifData.settings.formatted.aperture);
            if (exifData.settings.formatted.shutter) settings.push(exifData.settings.formatted.shutter);
            if (exifData.settings.formatted.focalLength) settings.push(exifData.settings.formatted.focalLength);

            const settingsText = settings.length > 0 ? settings.join(', ') : '設定情報なし';
            settingsInfo.textContent = window.WhereShotUtils.SecurityUtils.escapeHtml(settingsText);
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
                if (window.WhereShotMapController && window.WhereShotMapController.map) {
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
            zoom: 15
        });

        // GPS精度円を表示
        if (exifData.gps.accuracy) {
            window.WhereShotMapController.showAccuracyCircle(lat, lng, exifData.gps.accuracy);
        }
    }

    /**
     * 解析日時を設定
     * @param {Date} dateTime - 日時
     */
    setAnalysisDateTime(dateTime) {
        const analysisDate = document.getElementById('analysis-date');
        if (analysisDate && dateTime) {
            analysisDate.value = window.WhereShotUtils.DateUtils.formatForInput(dateTime);
        }
    }

    /**
     * 外部リンクを更新
     * @param {object} exifData - Exif情報
     */
    updateExternalLinks(exifData) {
        const lat = exifData.gps.latitude;
        const lng = exifData.gps.longitude;
        const dateTime = exifData.dateTime.original;

        console.log('[WhereShot] Updating external links:', { lat, lng, dateTime });

        // すべての外部リンクを有効化
        this.enableExternalLinks();

        if (lat && lng) {
            // NASA Worldview
            const nasaLink = document.getElementById('nasa-worldview-link');
            if (nasaLink) {
                const nasaURL = window.WhereShotUtils.URLUtils.generateNASAWorldviewURL(lat, lng, dateTime);
                nasaLink.href = nasaURL;
                nasaLink.target = '_blank';
                nasaLink.rel = 'noopener noreferrer';
                console.log('[WhereShot] NASA Worldview URL:', nasaURL);
            }

            // 地理院地図
            const gsiMapLink = document.getElementById('gsi-map-link');
            if (gsiMapLink) {
                const gsiURL = window.WhereShotUtils.URLUtils.generateGSIMapURL(lat, lng);
                gsiMapLink.href = gsiURL;
                gsiMapLink.target = '_blank';
                gsiMapLink.rel = 'noopener noreferrer';
                console.log('[WhereShot] GSI Map URL:', gsiURL);
            }

            const gsiPhotoLink = document.getElementById('gsi-photo-link');
            if (gsiPhotoLink) {
                const gsiPhotoURL = window.WhereShotUtils.URLUtils.generateGSIPhotoURL(lat, lng);
                gsiPhotoLink.href = gsiPhotoURL;
                gsiPhotoLink.target = '_blank';
                gsiPhotoLink.rel = 'noopener noreferrer';
                console.log('[WhereShot] GSI Photo URL:', gsiPhotoURL);
            }

            // Street View
            const streetViewLink = document.getElementById('streetview-link');
            if (streetViewLink) {
                const streetViewURL = window.WhereShotUtils.URLUtils.generateStreetViewURL(lat, lng);
                streetViewLink.href = streetViewURL;
                streetViewLink.target = '_blank';
                streetViewLink.rel = 'noopener noreferrer';
                console.log('[WhereShot] Street View URL:', streetViewURL);
            }
        }

        // 気象情報（位置情報と日時の両方が必要）
        const weatherLink = document.getElementById('weather-link');
        if (weatherLink) {
            const weatherURL = window.WhereShotUtils.URLUtils.generateWeatherURL(lat, lng, dateTime);
            weatherLink.href = weatherURL;
            weatherLink.target = '_blank';
            weatherLink.rel = 'noopener noreferrer';
            console.log('[WhereShot] Weather URL:', weatherURL);
            
            // 位置情報がない場合の処理
            if (!lat || !lng) {
                weatherLink.title = '位置情報がないため、気象庁トップページにリンクします';
            } else {
                weatherLink.title = `撮影地点の過去の天気データにリンクします`;
            }
        }

        // 類似画像検索
        const reverseImageLink = document.getElementById('reverse-image-link');
        if (reverseImageLink) {
            const reverseImageURL = window.WhereShotUtils.URLUtils.generateReverseImageURL();
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
            'reverse-image-link'
        ];

        externalLinks.forEach(linkId => {
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
            window.WhereShotUtils.UIUtils.showError(`太陽位置計算エラー: ${error.message}`);
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
        window.WhereShotUtils.UIUtils.showSuccess('地図をクリックして位置を指定してください');
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
        console.log('%c🔍 WhereShot - 撮影時刻・場所解析ツール', 'font-size: 16px; font-weight: bold; color: #2563eb;');
        console.log('%c📸 Created by IPUSIRON - セキュリティ重視のOSINTツール', 'color: #64748b;');
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

            // UIをリセット
            this.resetUI();

            // 地図をリセット
            window.WhereShotMapController.resetMap();

            // パーサーデータをクリア
            window.WhereShotExifParser.clearData();
            window.WhereShotSunCalculator.clearData();

            window.WhereShotUtils.UIUtils.showSuccess('アプリケーションがリセットされました');

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
            'sun-phase'
        ];

        infoElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = '-';
            }
        });

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
            fileSizeElement.textContent = window.WhereShotUtils.FileUtils.formatFileSize(file.size);
        }

        // ファイル形式
        const fileTypeElement = document.getElementById('file-type');
        if (fileTypeElement) {
            fileTypeElement.textContent = file.type || '不明';
        }

        // 更新日
        const fileModifiedElement = document.getElementById('file-modified');
        if (fileModifiedElement) {
            fileModifiedElement.textContent = window.WhereShotUtils.DateUtils.formatDateTime(new Date(file.lastModified));
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
                window.WhereShotUtils.UIUtils.showError('画像ファイルではないため、プレビューできません');
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
