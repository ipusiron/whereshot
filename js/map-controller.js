/**
 * WhereShot - 地図制御モジュール（改善版）
 * Created by IPUSIRON - セキュリティ重視のOSINTツール
 */

class MapController {
    constructor() {
        this.map = null;
        this.currentMarker = null;
        this.directionLayer = null;
        this.directionSource = null;
        this.isManualLocationMode = false;
        this.accuracyCircle = null;
        this.isDirectionMode = false;
        this.currentLocation = null;
        this.currentDirection = null;
        this.layers = {};
        this.markers = [];
        this.overlays = [];
        this.isInitialized = false;
        this.initializationPromise = null;
    }

    /**
     * 地図を初期化
     * @param {string} containerId - 地図コンテナのID
     * @param {object} options - 初期化オプション
     */
    async initializeMap(containerId, options = {}) {
        // 既に初期化中または完了している場合は待機または早期リターン
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        if (this.isInitialized) {
            return Promise.resolve();
        }

        this.initializationPromise = this._performMapInitialization(containerId, options);
        return this.initializationPromise;
    }

    /**
     * 実際の地図初期化処理（改善版）
     * @param {string} containerId - 地図コンテナのID
     * @param {object} options - 初期化オプション
     */
    async _performMapInitialization(containerId, options) {
        try {

            // デフォルトオプション
            const defaultOptions = {
                center: [35.6762, 139.6503], // 東京
                zoom: 10,
                maxZoom: 18,
                minZoom: 2
            };

            const mapOptions = { ...defaultOptions, ...options };

            // 解析結果を表示したあとで呼ぶ。非表示コンテナのポーリングはしない。
            const container = document.getElementById(containerId);
            if (!container || !container.getBoundingClientRect().height) {
                throw new Error('地図の表示領域がありません');
            }

            // 地図を作成
            this.map = L.map(containerId, {
                center: mapOptions.center,
                zoom: mapOptions.zoom,
                maxZoom: mapOptions.maxZoom,
                minZoom: mapOptions.minZoom,
                zoomControl: true,
                attributionControl: true,
                preferCanvas: false
            });

            // ベースレイヤーを設定
            this.setupBaseLayers();

            // イベントリスナーを設定
            this.setupEventListeners();

            // コントロールを追加
            this.addCustomControls();



            // 初期化完了フラグを設定
            this.isInitialized = true;

            // 初期化完了イベントを発火
            this.dispatchEvent('mapInitialized', {
                success: true,
                containerId: containerId
            });

            this.safeInvalidateSize();

        } catch (error) {
            console.error('地図を初期化できませんでした');
            this.isInitialized = false;
            this.initializationPromise = null;

            // 初期化失敗イベントを発火
            this.dispatchEvent('mapInitializationFailed', {
                error: '地図を初期化できませんでした',
                containerId: containerId
            });

            throw error;
        }
    }

    /**
     * 地図のサイズを安全に再計算
     */
    safeInvalidateSize() {
        if (!this.map || !this.isInitialized) return false;
        const rect = this.map.getContainer().getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        this.map.invalidateSize();
        return true;
    }
    /**
     * ベースレイヤーを設定
     */
    setupBaseLayers() {
        // OpenStreetMap
        this.layers.osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        });

        // 衛星画像（Esri）
        const satelliteUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        this.layers.satellite = L.tileLayer(satelliteUrl, {
            attribution: 'Tiles &copy; Esri &mdash; Esri, Vantor, Earthstar Geographics, and the GIS User Community',
            maxZoom: 18
        });

        // 地形図（OpenTopoMap）
        this.layers.terrain = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, '
                + '<a href="https://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; '
                + '<a href="https://opentopomap.org">OpenTopoMap</a> '
                + '(<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
            maxZoom: 17
        });

        // デフォルトレイヤーを追加
        this.layers.osm.addTo(this.map);
        this.currentLayer = 'osm';
    }

    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
        // 地図クリックイベント
        this.map.on('click', (e) => {
            this.onMapClick(e);
        });

        // 地図移動イベント
        this.map.on('moveend', (e) => {
            this.onMapMove(e);
        });

        // ウィンドウリサイズイベント（デバウンス付き）
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                this.safeInvalidateSize();
            }, 250);
        });
    }

    /**
     * カスタムコントロールを追加
     */
    addCustomControls() {
        // スケールコントロール
        L.control.scale({
            position: 'bottomleft',
            metric: true,
            imperial: false
        }).addTo(this.map);

        // ベースレイヤーの切替は画面のselectに一本化する。
    }

    /**
     * 地図クリックイベントハンドラー
     * @param {object} e - クリックイベント
     */
    onMapClick(e) {
        const { lat, lng } = e.latlng;
        if (!WhereShotLogic.isValidLatLng(lat, lng)) return;
        if (this.isDirectionMode) {
            this.setDirection(lat, lng);
        } else if (this.isManualLocationMode) {
            this.setLocation(lat, lng, { type: 'manual', centerMap: false });
            this.dispatchEvent('locationChanged', { latitude: lat, longitude: lng });
        } else {
            return;
        }
        this.updateCoordinateDisplay(lat, lng);
    }
    /**
     * 地図移動イベントハンドラ
     * @param {object} e - 移動イベント
     */
    onMapMove(e) {
        const center = this.map.getCenter();
        this.updateCoordinateDisplay(center.lat, center.lng);
    }

    /**
     * 位置を設定
     * @param {number} latitude - 緯度
     * @param {number} longitude - 経度
     * @param {object} options - オプション
     */
    setLocation(latitude, longitude, options = {}) {
        try {
            if (!this.map || !WhereShotLogic.isValidLatLng(latitude, longitude)) return;
            this.clearDirection();
            if (this.accuracyCircle) {
                this.map.removeLayer(this.accuracyCircle);
                this.accuracyCircle = null;
            }
            this.currentLocation = { latitude, longitude };

            // 既存のマーカーを削除
            if (this.currentMarker) {
                this.map.removeLayer(this.currentMarker);
            }

            // 新しいマーカーを作成
            const markerIcon = this.createLocationIcon(options.type || 'photo');
            this.currentMarker = L.marker([latitude, longitude], {
                icon: markerIcon,
                draggable: true
            }).addTo(this.map);

            // マーカーのドラッグイベント
            this.currentMarker.on('dragend', (e) => {
                const position = e.target.getLatLng();
                this.clearDirection();
                this.currentLocation = {
                    latitude: position.lat,
                    longitude: position.lng
                };
                if (this.accuracyCircle) {
                    this.map.removeLayer(this.accuracyCircle);
                    this.accuracyCircle = null;
                }
                this.currentMarker.setPopupContent(this.createLocationPopup(position.lat, position.lng, {}));
                this.updateCoordinateDisplay(position.lat, position.lng);
                this.dispatchEvent('locationChanged', this.currentLocation);
            });

            // ポップアップを設定
            const popupContent = this.createLocationPopup(latitude, longitude, options);
            this.currentMarker.bindPopup(popupContent);

            // 地図を中央に移動（オプション）
            if (options.centerMap !== false) {
                this.map.setView([latitude, longitude], options.zoom || this.map.getZoom());
            }



        } catch (error) {
            console.error('地図に位置を表示できませんでした');
            throw error;
        }
    }

    /**
     * GPS精度円を表示
     * @param {number} latitude - 緯度
     * @param {number} longitude - 経度
     * @param {number} accuracy - 精度（メートル）
     */
    showAccuracyCircle(latitude, longitude, accuracy) {
        // 既存の精度円を削除
        if (this.accuracyCircle) {
            this.map.removeLayer(this.accuracyCircle);
        }

        if (Number.isFinite(accuracy) && accuracy > 0) {
            this.accuracyCircle = L.circle([latitude, longitude], {
                radius: accuracy,
                fillColor: '#3388ff',
                fillOpacity: 0.2,
                color: '#3388ff',
                weight: 2,
                opacity: 0.8
            }).addTo(this.map);

            this.accuracyCircle.bindTooltip(`GPS精度: ±${accuracy.toFixed(1)}m`);
        }
    }

    /**
     * 撮影方向を設定（手動で選んだ終点を優先）
     * @param {number} endLat - 終点緯度
     * @param {number} endLng - 終点経度
     */
    setDirection(endLat, endLng) {
        if (!this.currentLocation || !WhereShotLogic.isValidLatLng(endLat, endLng)) {
            window.WhereShotUtils.UIUtils.showError('先に撮影位置を設定してください');
            return;
        }
        const { latitude, longitude } = this.currentLocation;
        const direction = WhereShotLogic.bearing(latitude, longitude, endLat, endLng);
        const distance = WhereShotLogic.distanceM(latitude, longitude, endLat, endLng);
        this.drawDirection(direction, distance, 'manual');
    }

    /**
     * Exifの方位を200mの矢印で表示
     */
    setExifDirection(direction) {
        if (this.directionSource === 'manual') return;
        if (Number.isFinite(direction) && this.currentLocation) {
            this.drawDirection(direction, 200, 'exif');
        }
    }

    /**
     * 本線と先端2本を一つのレイヤーとして保持
     */
    drawDirection(direction, distance, source) {
        this.clearDirection();
        if (!this.map || !this.currentLocation) return;
        const { latitude, longitude } = this.currentLocation;
        const end = WhereShotLogic.destinationPoint(latitude, longitude, direction, distance);
        this.currentDirection = direction;
        this.directionSource = source;
        this.directionLayer = L.layerGroup().addTo(this.map);
        const options = { color: source === 'exif' ? '#67e8f9' : '#fca5a5', weight: 3 };
        L.polyline([[latitude, longitude], [end.lat, end.lng]], options).addTo(this.directionLayer);
        this.addDirectionArrow(end.lat, end.lng, direction, Math.min(40, Math.max(8, distance / 5)), options);
        this.dispatchEvent('directionChanged', { direction, distance, source });
    }

    /**
     * 矢印とその根拠をまとめてクリア
     */
    clearDirection() {
        if (this.directionLayer && this.map) this.map.removeLayer(this.directionLayer);
        this.directionLayer = null;
        this.currentDirection = null;
        this.directionSource = null;
    }
    /**
     * 球面上の終点から後方へ矢印の先端を描く
     */
    addDirectionArrow(endLat, endLng, direction, length, options) {
        for (const angle of [direction + 150, direction + 210]) {
            const point = WhereShotLogic.destinationPoint(endLat, endLng, angle, length);
            L.polyline([[endLat, endLng], [point.lat, point.lng]], options).addTo(this.directionLayer);
        }
    }
    /**
     * レイヤーを切り替え（常に一つだけ）
     * @param {string} layerName - レイヤー名
     */
    switchLayer(layerName) {
        if (!this.map || !this.layers[layerName]) return;
        for (const layer of Object.values(this.layers)) {
            if (this.map.hasLayer(layer)) this.map.removeLayer(layer);
        }
        this.layers[layerName].addTo(this.map);
        this.currentLayer = layerName;
    }
    /**
     * 方向設定モードを切り替え
     * @param {boolean} enabled - 有効/無効
     */
    toggleDirectionMode(enabled) {
        this.isDirectionMode = enabled;
        if (enabled) {
            this.isManualLocationMode = false;
            window.WhereShotUtils.UIUtils.showSuccess('地図をクリックして撮影方向を設定してください');
        } else {
            this.clearDirection();
            this.dispatchEvent('directionChanged', { direction: null, source: null });
        }
        this.updateModeControls();
    }

    /**
     * 位置設定と方向設定は排他にする
     */
    toggleManualLocationMode(enabled) {
        this.isManualLocationMode = enabled;
        if (enabled) {
            this.isDirectionMode = false;
            window.WhereShotUtils.UIUtils.showSuccess('地図をクリックして撮影位置を指定してください');
        }
        this.updateModeControls();
    }

    /**
     * モードの表示と読み上げ状態を同期
     */
    updateModeControls() {
        this.map?.getContainer().classList.toggle('map-picking', this.isDirectionMode || this.isManualLocationMode);
        document.getElementById('manual-location-btn').setAttribute('aria-pressed', String(this.isManualLocationMode));
        document.getElementById('direction-mode-btn').setAttribute('aria-pressed', String(this.isDirectionMode));
    }
    /**
     * 位置アイコンを作成
     * @param {string} type - アイコンタイプ
     * @returns {object} Leafletアイコン
     */
    createLocationIcon(type) {
        const iconOptions = {
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34]
        };

        switch (type) {
            case 'photo':
                return L.icon({
                    ...iconOptions,
                    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#2563eb">
                            <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 2v12h16V6H4zm12 1l-3 3-2-2-6 6h14l-3-7z"/>
                        </svg>
                    `)
                });
            case 'manual':
                return L.icon({
                    ...iconOptions,
                    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#dc2626">
                            <path d="M12 2C8.13 2 5 5.13 5 9
                        c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                        </svg>
                    `)
                });
            default:
                return L.icon({
                    ...iconOptions,
                    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#059669">
                            <path d="M12 2C8.13 2 5 5.13 5 9
                        c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                        </svg>
                    `)
                });
        }
    }

    /**
     * 位置ポップアップをDOMで作成
     * @param {number} latitude - 緯度
     * @param {number} longitude - 経度
     * @param {object} options - オプション
     * @returns {HTMLElement} ポップアップ
     */
    createLocationPopup(latitude, longitude, options = {}) {
        const root = document.createElement('div');
        root.className = 'location-popup';
        const heading = document.createElement('h3');
        heading.textContent = '📍 撮影位置';
        const coordinates = document.createElement('p');
        coordinates.textContent = latitude.toFixed(6) + ', ' + longitude.toFixed(6)
            + '\n' + WhereShotLogic.decimalToDms(latitude, true) + ', ' + WhereShotLogic.decimalToDms(longitude, false);
        root.append(heading, coordinates);
        if (Number.isFinite(options.accuracy)) {
            const accuracy = document.createElement('p');
            accuracy.textContent = 'GPS精度: ±' + options.accuracy.toFixed(1) + 'm';
            root.append(accuracy);
        }
        const actions = document.createElement('div');
        actions.className = 'popup-actions';
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'btn btn-link';
        copy.textContent = '座標をコピー';
        copy.addEventListener('click', () => this.copyCoordinates(latitude, longitude));
        actions.append(copy);
        root.append(actions);
        return root;
    }
    /**
     * 座標をクリップボードにコピー
     * @param {number} latitude - 緯度
     * @param {number} longitude - 経度
     */
    async copyCoordinates(latitude, longitude) {
        try {
            if (!navigator.clipboard?.writeText) throw new Error('コピー非対応');
            await navigator.clipboard.writeText(latitude.toFixed(6) + ', ' + longitude.toFixed(6));
            window.WhereShotUtils.UIUtils.showSuccess('座標をコピーしました');
        } catch {
            window.WhereShotUtils.UIUtils.showError('コピーできませんでした。座標を選択してコピーしてください');
        }
    }
    /**
     * 座標表示を更新
     * @param {number} latitude - 緯度
     * @param {number} longitude - 経度
     */
    updateCoordinateDisplay(latitude, longitude) {
        const coordElement = document.getElementById('map-coordinates');
        if (coordElement) {
            coordElement.textContent = `座標: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        }
    }

    /**
     * カスタムイベントを発火
     * @param {string} eventName - イベント名
     * @param {object} data - イベントデータ
     */
    dispatchEvent(eventName, data) {
        const event = new CustomEvent(`whereshot:${eventName}`, {
            detail: data
        });
        document.dispatchEvent(event);
    }

    /**
     * 地図をリセット
     */
    resetMap() {
        // マーカーとオーバーレイを削除
        if (this.currentMarker) {
            this.map.removeLayer(this.currentMarker);
            this.currentMarker = null;
        }
        
        this.clearDirection();
        
        if (this.accuracyCircle) {
            this.map.removeLayer(this.accuracyCircle);
            this.accuracyCircle = null;
        }

        // データをクリア
        this.currentLocation = null;
        this.currentDirection = null;
        this.isDirectionMode = false;

        this.isManualLocationMode = false;
        this.updateModeControls();
    }

    /**
     * 現在の位置を取得
     * @returns {object|null} 現在の位置
     */
    getCurrentLocation() {
        return this.currentLocation;
    }

    /**
     * 現在の方向を取得
     * @returns {number|null} 現在の方向
     */
    getCurrentDirection() {
        return this.currentDirection;
    }

    /**
     * 地図インスタンスを取得
     * @returns {object} Leaflet地図インスタンス
     */
    getMapInstance() {
        return this.map;
    }

    /**
     * 初期化状態を取得
     * @returns {boolean} 初期化完了状態
     */
    isMapInitialized() {
        return this.isInitialized;
    }
}

// シングルトンインスタンスを作成
window.WhereShotMapController = new MapController();
