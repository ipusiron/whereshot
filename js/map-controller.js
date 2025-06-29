/**
 * WhereShot - 地図制御モジュール
 * Created by IPUSIRON - セキュリティ重視のOSINTツール
 */

class MapController {
    constructor() {
        this.map = null;
        this.currentMarker = null;
        this.directionLine = null;
        this.accuracyCircle = null;
        this.isDirectionMode = false;
        this.currentLocation = null;
        this.currentDirection = null;
        this.layers = {};
        this.markers = [];
        this.overlays = [];
    }

    /**
     * 地図を初期化
     * @param {string} containerId - 地図コンテナのID
     * @param {object} options - 初期化オプション
     */
    initializeMap(containerId, options = {}) {
        try {
            // デフォルトオプション
            const defaultOptions = {
                center: [35.6762, 139.6503], // 東京
                zoom: 10,
                maxZoom: 18,
                minZoom: 2
            };

            const mapOptions = { ...defaultOptions, ...options };

            // 地図コンテナが表示されるまで待機
            const container = document.getElementById(containerId);
            if (!container) {
                throw new Error(`Map container ${containerId} not found`);
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

            // 地図のサイズを強制的に再計算
            setTimeout(() => {
                if (this.map) {
                    this.map.invalidateSize();
                    console.log('[WhereShot] Map size invalidated');
                }
            }, 100);

            // 地図が読み込まれた後の追加チェック
            this.map.whenReady(() => {
                setTimeout(() => {
                    if (this.map) {
                        this.map.invalidateSize();
                        console.log('[WhereShot] Map ready and size invalidated');
                    }
                }, 200);
            });

            console.log('[WhereShot] Map initialized successfully');

        } catch (error) {
            console.error('[WhereShot] Map initialization error:', error);
            throw error;
        }
    }

    /**
     * ベースレイヤーを設定
     */
    setupBaseLayers() {
        // OpenStreetMap
        this.layers.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        });

        // 衛星画像（Esri）
        this.layers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            maxZoom: 18
        });

        // 地形図（OpenTopoMap）
        this.layers.terrain = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
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

        // ズーム変更イベント
        this.map.on('zoomend', (e) => {
            this.onMapZoom(e);
        });

        // ウィンドウリサイズイベント
        window.addEventListener('resize', () => {
            if (this.map) {
                setTimeout(() => {
                    this.map.invalidateSize();
                }, 100);
            }
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

        // レイヤーコントロール
        const baseLayers = {
            "OpenStreetMap": this.layers.osm,
            "衛星画像": this.layers.satellite,
            "地形図": this.layers.terrain
        };

        this.layerControl = L.control.layers(baseLayers, {}, {
            position: 'topright',
            collapsed: false
        }).addTo(this.map);
    }

    /**
     * 地図クリックイベントハンドラ
     * @param {object} e - クリックイベント
     */
    onMapClick(e) {
        const { lat, lng } = e.latlng;

        if (this.isDirectionMode) {
            // 方向設定モード
            this.setDirection(lat, lng);
        } else {
            // 通常の位置設定モード
            this.setLocation(lat, lng);
        }

        // 座標情報を更新
        this.updateCoordinateDisplay(lat, lng);

        // カスタムイベントを発火
        this.dispatchEvent('locationChanged', {
            latitude: lat,
            longitude: lng,
            isDirectionMode: this.isDirectionMode
        });
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
     * ズーム変更イベントハンドラ
     * @param {object} e - ズームイベント
     */
    onMapZoom(e) {
        const zoom = this.map.getZoom();
        console.log('[WhereShot] Map zoom changed:', zoom);
    }

    /**
     * 位置を設定
     * @param {number} latitude - 緯度
     * @param {number} longitude - 経度
     * @param {object} options - オプション
     */
    setLocation(latitude, longitude, options = {}) {
        try {
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
                this.currentLocation = {
                    latitude: position.lat,
                    longitude: position.lng
                };
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

            console.log('[WhereShot] Location set:', { latitude, longitude });

        } catch (error) {
            console.error('[WhereShot] Error setting location:', error);
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

        if (accuracy && accuracy > 0) {
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
     * 撮影方向を設定
     * @param {number} endLat - 終点緯度
     * @param {number} endLng - 終点経度
     */
    setDirection(endLat, endLng) {
        if (!this.currentLocation) {
            window.WhereShotUtils.UIUtils.showError('先に撮影位置を設定してください');
            return;
        }

        // 既存の方向線を削除
        if (this.directionLine) {
            this.map.removeLayer(this.directionLine);
        }

        const startLat = this.currentLocation.latitude;
        const startLng = this.currentLocation.longitude;

        // 方向を計算
        const direction = this.calculateBearing(startLat, startLng, endLat, endLng);
        this.currentDirection = direction;

        // 方向線を描画
        this.directionLine = L.polyline([
            [startLat, startLng],
            [endLat, endLng]
        ], {
            color: '#ff4444',
            weight: 3,
            opacity: 0.8,
            dashArray: '5, 10'
        }).addTo(this.map);

        // 矢印を追加
        this.addDirectionArrow(startLat, startLng, endLat, endLng);

        // ポップアップを設定
        const distance = window.WhereShotUtils.GeoUtils.calculateDistance(startLat, startLng, endLat, endLng);
        this.directionLine.bindPopup(`
            <strong>撮影方向</strong><br>
            方位: ${direction.toFixed(1)}° (${window.WhereShotUtils.GeoUtils.degreesToCardinal ? window.WhereShotUtils.GeoUtils.degreesToCardinal(direction) : this.degreesToCardinal(direction)})<br>
            距離: ${distance.toFixed(0)}m
        `);

        console.log('[WhereShot] Direction set:', direction);

        // イベントを発火
        this.dispatchEvent('directionChanged', {
            direction: direction,
            distance: distance
        });
    }

    /**
     * 方角を計算
     * @param {number} lat1 - 開始点緯度
     * @param {number} lng1 - 開始点経度
     * @param {number} lat2 - 終了点緯度
     * @param {number} lng2 - 終了点経度
     * @returns {number} 方角（度）
     */
    calculateBearing(lat1, lng1, lat2, lng2) {
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const lat1Rad = lat1 * Math.PI / 180;
        const lat2Rad = lat2 * Math.PI / 180;

        const y = Math.sin(dLng) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
                  Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

        let bearing = Math.atan2(y, x) * 180 / Math.PI;
        return (bearing + 360) % 360;
    }

    /**
     * 方向矢印を追加
     * @param {number} startLat - 開始点緯度
     * @param {number} startLng - 開始点経度
     * @param {number} endLat - 終了点緯度
     * @param {number} endLng - 終了点経度
     */
    addDirectionArrow(startLat, startLng, endLat, endLng) {
        const arrowIcon = L.divIcon({
            className: 'direction-arrow',
            html: '▶',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        const arrowMarker = L.marker([endLat, endLng], {
            icon: arrowIcon
        }).addTo(this.map);

        // 矢印を方向に回転
        const bearing = this.calculateBearing(startLat, startLng, endLat, endLng);
        const arrowElement = arrowMarker.getElement();
        if (arrowElement) {
            arrowElement.style.transform += ` rotate(${bearing}deg)`;
        }
    }

    /**
     * レイヤーを切り替え
     * @param {string} layerName - レイヤー名
     */
    switchLayer(layerName) {
        if (this.layers[layerName] && this.currentLayer !== layerName) {
            // 現在のレイヤーを削除
            this.map.removeLayer(this.layers[this.currentLayer]);
            
            // 新しいレイヤーを追加
            this.layers[layerName].addTo(this.map);
            this.currentLayer = layerName;

            console.log('[WhereShot] Layer switched to:', layerName);
        }
    }

    /**
     * 方向設定モードを切り替え
     * @param {boolean} enabled - 有効/無効
     */
    toggleDirectionMode(enabled) {
        this.isDirectionMode = enabled;
        
        if (enabled) {
            this.map.getContainer().style.cursor = 'crosshair';
            window.WhereShotUtils.UIUtils.showSuccess('地図をクリックして撮影方向を設定してください');
        } else {
            this.map.getContainer().style.cursor = '';
            if (this.directionLine) {
                this.map.removeLayer(this.directionLine);
                this.directionLine = null;
                this.currentDirection = null;
            }
        }
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
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                        </svg>
                    `)
                });
            default:
                return L.icon({
                    ...iconOptions,
                    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#059669">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                        </svg>
                    `)
                });
        }
    }

    /**
     * 位置ポップアップを作成
     * @param {number} latitude - 緯度
     * @param {number} longitude - 経度
     * @param {object} options - オプション
     * @returns {string} HTMLコンテンツ
     */
    createLocationPopup(latitude, longitude, options) {
        const coords = window.WhereShotUtils.GeoUtils.formatCoordinates(latitude, longitude);
        
        return `
            <div class="location-popup">
                <h4>📍 撮影位置</h4>
                <p><strong>座標:</strong><br>${coords}</p>
                ${options.accuracy ? `<p><strong>GPS精度:</strong> ±${options.accuracy.toFixed(1)}m</p>` : ''}
                ${options.dateTime ? `<p><strong>日時:</strong><br>${window.WhereShotUtils.DateUtils.formatDateTime(options.dateTime)}</p>` : ''}
                <div class="popup-actions">
                    <button onclick="window.WhereShotMapController.copyCoordinates(${latitude}, ${longitude})" class="btn btn-link">座標をコピー</button>
                </div>
            </div>
        `;
    }

    /**
     * 座標をクリップボードにコピー
     * @param {number} latitude - 緯度
     * @param {number} longitude - 経度
     */
    copyCoordinates(latitude, longitude) {
        const coords = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        navigator.clipboard.writeText(coords).then(() => {
            window.WhereShotUtils.UIUtils.showSuccess('座標をコピーしました');
        }).catch(() => {
            window.WhereShotUtils.UIUtils.showError('座標のコピーに失敗しました');
        });
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
     * 度を方角に変換（ユーティリティ関数）
     * @param {number} degrees - 度
     * @returns {string} 方角
     */
    degreesToCardinal(degrees) {
        const directions = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東',
                          '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];
        const index = Math.round(degrees / 22.5) % 16;
        return directions[index];
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
        
        if (this.directionLine) {
            this.map.removeLayer(this.directionLine);
            this.directionLine = null;
        }
        
        if (this.accuracyCircle) {
            this.map.removeLayer(this.accuracyCircle);
            this.accuracyCircle = null;
        }

        // データをクリア
        this.currentLocation = null;
        this.currentDirection = null;
        this.isDirectionMode = false;

        // カーソルをリセット
        this.map.getContainer().style.cursor = '';

        console.log('[WhereShot] Map reset');
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
}

// シングルトンインスタンスを作成
window.WhereShotMapController = new MapController();
