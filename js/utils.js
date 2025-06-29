/**
 * WhereShot - 共通ユーティリティ関数
 * Created by IPUSIRON - セキュリティ重視のOSINTツール
 */

// ========== 日付・時刻ユーティリティ ========== 
const DateUtils = {
    /**
     * 日付を読みやすい形式でフォーマット
     * @param {Date} date - フォーマットする日付
     * @returns {string} フォーマットされた日付文字列
     */
    formatDateTime: (date) => {
        if (!date || !(date instanceof Date)) return '-';
        
        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        };
        
        return date.toLocaleString('ja-JP', options);
    },

    /**
     * ISO 8601形式の日付文字列をDateオブジェクトに変換
     * @param {string} dateString - ISO 8601形式の日付文字列
     * @returns {Date|null} Dateオブジェクトまたはnull
     */
    parseISOString: (dateString) => {
        if (!dateString) return null;
        
        try {
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? null : date;
        } catch (error) {
            console.warn('日付のパースに失敗:', error);
            return null;
        }
    },

    /**
     * datetime-local input用のフォーマット
     * @param {Date} date - フォーマットする日付
     * @returns {string} datetime-local形式の文字列
     */
    formatForInput: (date) => {
        if (!date || !(date instanceof Date)) return '';
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
};

// ========== 座標・地理ユーティリティ ==========
const GeoUtils = {
    /**
     * 度分秒形式をデシマル度に変換
     * @param {number} degrees - 度
     * @param {number} minutes - 分
     * @param {number} seconds - 秒
     * @param {string} direction - 方向 (N/S/E/W)
     * @returns {number} デシマル度
     */
    dmsToDecimal: (degrees, minutes, seconds, direction) => {
        let decimal = Math.abs(degrees) + (minutes / 60) + (seconds / 3600);
        
        if (direction === 'S' || direction === 'W') {
            decimal = -decimal;
        }
        
        return decimal;
    },

    /**
     * デシマル度を度分秒形式に変換
     * @param {number} decimal - デシマル度
     * @param {boolean} isLatitude - 緯度かどうか
     * @returns {string} 度分秒形式の文字列
     */
    decimalToDms: (decimal, isLatitude = true) => {
        if (decimal === null || decimal === undefined) return '';
        
        const absolute = Math.abs(decimal);
        const degrees = Math.floor(absolute);
        const minutesFloat = (absolute - degrees) * 60;
        const minutes = Math.floor(minutesFloat);
        const seconds = ((minutesFloat - minutes) * 60).toFixed(2);
        
        let direction;
        if (isLatitude) {
            direction = decimal >= 0 ? 'N' : 'S';
        } else {
            direction = decimal >= 0 ? 'E' : 'W';
        }
        
        return `${degrees}°${minutes}'${seconds}"${direction}`;
    },

    /**
     * 座標を読みやすい形式でフォーマット
     * @param {number} lat - 緯度
     * @param {number} lng - 経度
     * @returns {string} フォーマットされた座標文字列
     */
    formatCoordinates: (lat, lng) => {
        if (lat === null || lng === null || lat === undefined || lng === undefined) {
            return 'GPS情報なし';
        }
        
        const latDms = GeoUtils.decimalToDms(lat, true);
        const lngDms = GeoUtils.decimalToDms(lng, false);
        
        return `${latDms}, ${lngDms}\n(${lat.toFixed(6)}, ${lng.toFixed(6)})`;
    },

    /**
     * 2点間の距離を計算（ハーバサイン公式）
     * @param {number} lat1 - 地点1の緯度
     * @param {number} lng1 - 地点1の経度
     * @param {number} lat2 - 地点2の緯度
     * @param {number} lng2 - 地点2の経度
     * @returns {number} 距離（メートル）
     */
    calculateDistance: (lat1, lng1, lat2, lng2) => {
        const R = 6371000; // 地球の半径（メートル）
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lng2 - lng1) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }
};

// ========== 外部URL生成ユーティリティ ==========
const URLUtils = {
    /**
     * NASA Worldview URL生成
     * @param {number} lat - 緯度
     * @param {number} lng - 経度
     * @param {Date} date - 日付
     * @returns {string} NASA Worldview URL
     */
    generateNASAWorldviewURL: (lat, lng, date) => {
        if (!lat || !lng) return '#';
        
        // 日付をYYYY-MM-DD形式に変換
        const dateStr = date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        
        // 座標範囲を計算（適度なズームレベルになるよう調整）
        const margin = 1.0; // 度単位での表示範囲
        const minLon = lng - margin;
        const minLat = lat - margin;
        const maxLon = lng + margin;
        const maxLat = lat + margin;
        
        // 確実に表示されるレイヤーの組み合わせ
        const layers = [
            'MODIS_Terra_CorrectedReflectance_TrueColor',
            'MODIS_Aqua_CorrectedReflectance_TrueColor',
            'VIIRS_SNPP_CorrectedReflectance_TrueColor',
            'Reference_Labels_15m',           // 地名ラベル
            'Reference_Features_15m'          // 海岸線・国境
        ];
        
        // URLを構築（zパラメータを除去し、vパラメータのみ使用）
        const baseURL = 'https://worldview.earthdata.nasa.gov/';
        const params = new URLSearchParams({
            'v': `${minLon},${minLat},${maxLon},${maxLat}`,
            't': dateStr,
            'l': layers.join(',')
        });
        
        const finalURL = `${baseURL}?${params.toString()}`;
        
        console.log('[NASA Worldview] Generated URL:', finalURL);
        return finalURL;
    },

    /**
     * 地理院地図 URL生成
     * @param {number} lat - 緯度
     * @param {number} lng - 経度
     * @returns {string} 地理院地図 URL
     */
    generateGSIMapURL: (lat, lng) => {
        if (!lat || !lng) return '#';
        
        const zoom = 15;
        return `https://maps.gsi.go.jp/#${zoom}/${lat}/${lng}/&base=std&ls=std&disp=1&vs=c1j0h0k0l0u0t0z0r0s0m0f1`;
    },

    /**
     * 地理院地図（空中写真）URL生成
     * @param {number} lat - 緯度
     * @param {number} lng - 経度
     * @returns {string} 地理院地図（空中写真）URL
     */
    generateGSIPhotoURL: (lat, lng) => {
        if (!lat || !lng) return '#';
        
        const zoom = 15;
        return `https://maps.gsi.go.jp/#${zoom}/${lat}/${lng}/&base=ort&ls=ort&disp=1&vs=c1j0h0k0l0u0t0z0r0s0m0f1`;
    },

    /**
     * 気象庁 過去の天気 URL生成
     * @param {number} lat - 緯度
     * @param {number} lng - 経度
     * @param {Date} date - 日付
     * @returns {string} 気象庁 URL
     */
    generateWeatherURL: (lat, lng, date) => {
        if (!date) {
            // 日付がない場合は気象庁のトップページ
            return 'https://www.data.jma.go.jp/obd/stats/etrn/index.php';
        }

        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();

        // 地域の判定（詳細版：日本国内の主要観測所）
        let precNo = 44; // デフォルト：東京都
        let blockNo = 47662; // デフォルト：東京
        let locationName = '東京';

        // 緯度経度から最適な観測所を推定
        if (lat && lng) {
            // 北海道
            if (lat >= 43.0) {
                precNo = 14; blockNo = 47412; locationName = '札幌'; // 札幌
            } else if (lat >= 41.5) {
                precNo = 14; blockNo = 47418; locationName = '函館'; // 函館
            }
            // 東北地方
            else if (lat >= 39.5 && lng <= 141.5) {
                precNo = 31; blockNo = 47582; locationName = '盛岡'; // 盛岡
            } else if (lat >= 38.0 && lng <= 141.5) {
                precNo = 34; blockNo = 47590; locationName = '仙台'; // 仙台
            } else if (lat >= 37.5 && lng <= 140.5) {
                precNo = 36; blockNo = 47570; locationName = '福島'; // 福島
            }
            // 関東地方
            else if (lat >= 36.5 && lng >= 139.0 && lng <= 140.5) {
                precNo = 40; blockNo = 47648; locationName = '宇都宮'; // 宇都宮
            } else if (lat >= 36.0 && lng >= 139.0 && lng <= 140.0) {
                precNo = 43; blockNo = 47626; locationName = '前橋'; // 前橋  
            } else if (lat >= 35.5 && lng >= 139.5 && lng <= 140.5) {
                precNo = 44; blockNo = 47662; locationName = '東京'; // 東京
            } else if (lat >= 35.0 && lng >= 139.0 && lng <= 140.0) {
                precNo = 46; blockNo = 47670; locationName = '横浜'; // 横浜
            }
            // 中部地方
            else if (lat >= 36.5 && lng >= 137.5 && lng < 139.0) {
                precNo = 48; blockNo = 47610; locationName = '新潟'; // 新潟
            } else if (lat >= 36.0 && lng >= 137.0 && lng < 139.0) {
                precNo = 20; blockNo = 47617; locationName = '長野'; // 長野
            } else if (lat >= 35.5 && lng >= 136.5 && lng < 138.5) {
                precNo = 50; blockNo = 47656; locationName = '甲府'; // 甲府
            } else if (lat >= 35.0 && lng >= 136.0 && lng < 137.5) {
                precNo = 51; blockNo = 47636; locationName = '名古屋'; // 名古屋
            } else if (lat >= 35.5 && lng >= 136.0 && lng < 137.0) {
                precNo = 52; blockNo = 47632; locationName = '岐阜'; // 岐阜
            }
            // 関西地方
            else if (lat >= 35.0 && lng >= 135.5 && lng < 136.5) {
                precNo = 61; blockNo = 47759; locationName = '京都'; // 京都
            } else if (lat >= 34.5 && lng >= 135.0 && lng < 136.0) {
                precNo = 62; blockNo = 47772; locationName = '大阪'; // 大阪
            } else if (lat >= 34.5 && lng >= 134.5 && lng < 135.5) {
                precNo = 63; blockNo = 47770; locationName = '神戸'; // 神戸
            } else if (lat >= 34.0 && lng >= 135.5 && lng < 136.5) {
                precNo = 64; blockNo = 47780; locationName = '奈良'; // 奈良
            }
            // 中国地方
            else if (lat >= 35.0 && lng >= 133.0 && lng < 134.5) {
                precNo = 66; blockNo = 47741; locationName = '岡山'; // 岡山
            } else if (lat >= 34.0 && lng >= 132.0 && lng < 134.0) {
                precNo = 67; blockNo = 47765; locationName = '広島'; // 広島
            } else if (lat >= 34.0 && lng >= 131.0 && lng < 132.5) {
                precNo = 83; blockNo = 47784; locationName = '下関'; // 下関
            }
            // 四国地方
            else if (lat >= 33.5 && lng >= 133.5 && lng < 135.0) {
                precNo = 71; blockNo = 47815; locationName = '徳島'; // 徳島
            } else if (lat >= 34.0 && lng >= 133.0 && lng < 134.5) {
                precNo = 72; blockNo = 47821; locationName = '高松'; // 高松
            } else if (lat >= 33.5 && lng >= 132.5 && lng < 133.5) {
                precNo = 73; blockNo = 47827; locationName = '松山'; // 松山
            } else if (lat >= 32.5 && lng >= 133.0 && lng < 134.0) {
                precNo = 74; blockNo = 47837; locationName = '高知'; // 高知
            }
            // 九州地方
            else if (lat >= 33.5 && lng >= 130.0 && lng < 131.5) {
                precNo = 82; blockNo = 47807; locationName = '福岡'; // 福岡
            } else if (lat >= 32.5 && lng >= 129.5 && lng < 131.0) {
                precNo = 84; blockNo = 47817; locationName = '佐賀'; // 佐賀
            } else if (lat >= 32.5 && lng >= 129.0 && lng < 130.5) {
                precNo = 85; blockNo = 47819; locationName = '長崎'; // 長崎
            } else if (lat >= 32.5 && lng >= 130.5 && lng < 132.0) {
                precNo = 86; blockNo = 47824; locationName = '熊本'; // 熊本
            } else if (lat >= 33.0 && lng >= 131.0 && lng < 132.5) {
                precNo = 87; blockNo = 47815; locationName = '大分'; // 大分
            } else if (lat >= 31.5 && lng >= 131.0 && lng < 132.0) {
                precNo = 88; blockNo = 47830; locationName = '宮崎'; // 宮崎
            } else if (lat >= 31.0 && lng >= 130.0 && lng < 131.5) {
                precNo = 89; blockNo = 47827; locationName = '鹿児島'; // 鹿児島
            }
            // 沖縄地方
            else if (lat < 27.0) {
                precNo = 91; blockNo = 47936; locationName = '那覇'; // 那覇
            }
        }

        // 気象庁の過去の気象データURL（撮影日に直接アクセス）
        const baseURL = 'https://www.data.jma.go.jp/obd/stats/etrn/view/daily_s1.php';
        const params = new URLSearchParams({
            prec_no: precNo.toString(),
            block_no: blockNo.toString(),
            year: year.toString(),
            month: month.toString(),
            day: day.toString(),
            view: ''
        });

        const finalURL = `${baseURL}?${params.toString()}`;
        
        console.log(`[WeatherURL] Generated for ${locationName} (${year}/${month}/${day}):`, finalURL);
        
        return finalURL;
    },

    /**
     * Google Street View URL生成
     * @param {number} lat - 緯度
     * @param {number} lng - 経度
     * @returns {string} Street View URL
     */
    generateStreetViewURL: (lat, lng) => {
        if (!lat || !lng) return '#';
        
        return `https://www.google.com/maps/@${lat},${lng},3a,75y,90h,90t/data=!3m7!1e1!3m5!1s-!2e0!6s%2F%2Fgeo0.ggpht.com!7i13312!8i6656`;
    },

    /**
     * SunCalc.org URL生成
     * @param {number} lat - 緯度
     * @param {number} lng - 経度
     * @param {Date} date - 日付
     * @returns {string} SunCalc.org URL
     */
    generateSunCalcURL: (lat, lng, date) => {
        if (!lat || !lng) return '#';
        
        const dateStr = date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        return `https://www.suncalc.org/#/${lat},${lng},15/${dateStr}/12:00/1/3`;
    },

    /**
     * 類似画像検索URL生成（Google Images）
     * @returns {string} Google Images URL
     */
    generateReverseImageURL: () => {
        return 'https://images.google.com/';
    }
};

// ========== ファイルユーティリティ ==========
const FileUtils = {
    /**
     * ファイルサイズを読みやすい形式でフォーマット
     * @param {number} bytes - バイト数
     * @returns {string} フォーマットされたファイルサイズ
     */
    formatFileSize: (bytes) => {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * ファイルタイプを判定
     * @param {string} fileName - ファイル名
     * @returns {string} ファイルタイプ
     */
    getFileType: (fileName) => {
        const extension = fileName.split('.').pop().toLowerCase();
        
        const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp'];
        const videoTypes = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
        
        if (imageTypes.includes(extension)) return 'image';
        if (videoTypes.includes(extension)) return 'video';
        
        return 'unknown';
    },

    /**
     * ファイルの安全性チェック
     * @param {File} file - チェックするファイル
     * @returns {object} チェック結果
     */
    validateFile: (file) => {
        const maxSize = 100 * 1024 * 1024; // 100MB
        const allowedTypes = ['image/jpeg', 'image/png', 'image/tiff', 'video/mp4'];
        
        const result = {
            isValid: true,
            errors: []
        };
        
        if (file.size > maxSize) {
            result.isValid = false;
            result.errors.push('ファイルサイズが大きすぎます（100MB以下にしてください）');
        }
        
        if (!allowedTypes.includes(file.type)) {
            result.isValid = false;
            result.errors.push('サポートされていないファイル形式です');
        }
        
        return result;
    }
};

// ========== UIユーティリティ ==========
const UIUtils = {
    /**
     * 要素を表示/非表示切り替え
     * @param {string|HTMLElement} element - 要素のIDまたは要素自体
     * @param {boolean} show - 表示するかどうか
     */
    toggleElement: (element, show) => {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (el) {
            el.style.display = show ? 'block' : 'none';
        }
    },

    /**
     * エラーメッセージを表示
     * @param {string} message - エラーメッセージ
     * @param {number} duration - 表示時間（ミリ秒）
     */
    showError: (message, duration = 5000) => {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--danger-color);
            color: white;
            padding: 1rem;
            border-radius: 0.375rem;
            box-shadow: var(--shadow-md);
            z-index: 1001;
            max-width: 400px;
            word-wrap: break-word;
        `;
        errorDiv.textContent = message;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, duration);
    },

    /**
     * 成功メッセージを表示
     * @param {string} message - 成功メッセージ
     * @param {number} duration - 表示時間（ミリ秒）
     */
    showSuccess: (message, duration = 3000) => {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--success-color);
            color: white;
            padding: 1rem;
            border-radius: 0.375rem;
            box-shadow: var(--shadow-md);
            z-index: 1001;
            max-width: 400px;
            word-wrap: break-word;
        `;
        successDiv.textContent = message;
        
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, duration);
    },

    /**
     * ローディング表示
     * @param {string|HTMLElement} element - 対象要素
     * @param {boolean} show - 表示するかどうか
     */
    showLoading: (element, show) => {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (!el) return;
        
        if (show) {
            el.style.opacity = '0.5';
            el.style.pointerEvents = 'none';
        } else {
            el.style.opacity = '1';
            el.style.pointerEvents = 'auto';
        }
    }
};

// ========== セキュリティユーティリティ ==========
const SecurityUtils = {
    /**
     * XSSを防ぐためのHTMLエスケープ
     * @param {string} str - エスケープする文字列
     * @returns {string} エスケープされた文字列
     */
    escapeHtml: (str) => {
        if (!str) return '';
        
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /**
     * 機密データのクリア（メモリ内のデータを安全に削除）
     * @param {object} obj - クリアするオブジェクト
     */
    clearSensitiveData: (obj) => {
        if (obj && typeof obj === 'object') {
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    if (typeof obj[key] === 'string') {
                        obj[key] = '';
                    } else if (typeof obj[key] === 'object') {
                        SecurityUtils.clearSensitiveData(obj[key]);
                    } else {
                        obj[key] = null;
                    }
                }
            }
        }
    },

    /**
     * データのハッシュ値を計算（簡易版）
     * @param {string} data - ハッシュ化するデータ
     * @returns {Promise<string>} ハッシュ値
     */
    calculateHash: async (data) => {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
};

// ========== エクスポート ==========
window.WhereShotUtils = {
    DateUtils,
    GeoUtils,
    URLUtils,
    FileUtils,
    UIUtils,
    SecurityUtils
};
