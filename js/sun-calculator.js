/**
 * WhereShot - 太陽位置計算モジュール
 * Created by IPUSIRON - セキュリティ重視のOSINTツール
 */

class SunCalculator {
    constructor() {
        this.currentPosition = null;
        this.currentDateTime = null;
        this.sunData = null;
    }

    /**
     * 指定位置・日時での太陽位置を計算
     * @param {number} latitude - 緯度
     * @param {number} longitude - 経度
     * @param {Date} dateTime - 日時
     * @returns {object} 太陽位置データ
     */
    calculateSunPosition(latitude, longitude, dateTime) {
        try {
            if (!this.validateInputs(latitude, longitude, dateTime)) {
                throw new Error('無効な入力パラメータです');
            }

            this.currentPosition = { latitude, longitude };
            this.currentDateTime = dateTime;

            // SunCalcライブラリを使用して太陽位置を計算
            const sunPosition = SunCalc.getPosition(dateTime, latitude, longitude);
            const sunTimes = SunCalc.getTimes(dateTime, latitude, longitude);

            // 計算結果を構造化
            this.sunData = {
                position: this.processSunPosition(sunPosition),
                times: this.processSunTimes(sunTimes),
                analysis: this.analyzeSunConditions(sunPosition, sunTimes, dateTime),
                shadow: this.calculateShadowInfo(sunPosition),
                location: { latitude, longitude },
                dateTime: dateTime,
                formatted: {}
            };

            // フォーマット済み情報を生成
            this.sunData.formatted = this.formatSunData(this.sunData);

            console.log('[WhereShot] Sun calculation completed:', {
                elevation: this.sunData.position.elevation,
                azimuth: this.sunData.position.azimuth,
                phase: this.sunData.analysis.phase
            });

            return this.sunData;

        } catch (error) {
            console.error('[WhereShot] Sun calculation error:', error);
            throw error;
        }
    }

    /**
     * 入力パラメータの妥当性を検証
     * @param {number} latitude - 緯度
     * @param {number} longitude - 経度
     * @param {Date} dateTime - 日時
     * @returns {boolean} 妥当性
     */
    validateInputs(latitude, longitude, dateTime) {
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            return false;
        }

        if (latitude < -90 || latitude > 90) {
            return false;
        }

        if (longitude < -180 || longitude > 180) {
            return false;
        }

        if (!(dateTime instanceof Date) || isNaN(dateTime.getTime())) {
            return false;
        }

        return true;
    }

    /**
     * 太陽位置データを処理
     * @param {object} sunPosition - SunCalcの太陽位置データ
     * @returns {object} 処理された太陽位置データ
     */
    processSunPosition(sunPosition) {
        return {
            // 高度（地平線からの角度）- ラジアンから度に変換
            elevation: this.radiansToDegrees(sunPosition.altitude),
            // 方位角（北から時計回り）- ラジアンから度に変換し、0-360度に正規化
            azimuth: this.normalizeAzimuth(this.radiansToDegrees(sunPosition.azimuth)),
            // 生データ
            raw: {
                altitude: sunPosition.altitude,
                azimuth: sunPosition.azimuth
            }
        };
    }

    /**
     * 太陽の時刻データを処理
     * @param {object} sunTimes - SunCalcの太陽時刻データ
     * @returns {object} 処理された太陽時刻データ
     */
    processSunTimes(sunTimes) {
        return {
            sunrise: sunTimes.sunrise,
            sunset: sunTimes.sunset,
            solarNoon: sunTimes.solarNoon,
            nadir: sunTimes.nadir,
            dawn: sunTimes.dawn,
            dusk: sunTimes.dusk,
            nauticalDawn: sunTimes.nauticalDawn,
            nauticalDusk: sunTimes.nauticalDusk,
            nightEnd: sunTimes.nightEnd,
            night: sunTimes.night,
            goldenHourEnd: sunTimes.goldenHourEnd,
            goldenHour: sunTimes.goldenHour
        };
    }

    /**
     * 太陽の状況を分析
     * @param {object} sunPosition - 太陽位置
     * @param {object} sunTimes - 太陽時刻
     * @param {Date} dateTime - 対象日時
     * @returns {object} 分析結果
     */
    analyzeSunConditions(sunPosition, sunTimes, dateTime) {
        const elevation = this.radiansToDegrees(sunPosition.altitude);
        const phase = this.determineSunPhase(dateTime, sunTimes);
        const lightQuality = this.determineLightQuality(elevation, phase);

        return {
            phase: phase,
            isVisible: elevation > 0,
            lightQuality: lightQuality,
            shadowLength: this.calculateRelativeShadowLength(elevation),
            photographyTips: this.getPhotographyTips(elevation, phase),
            verification: {
                timeConsistency: this.checkTimeConsistency(dateTime, sunTimes, phase),
                shadowDirection: this.getShadowDirection(sunPosition),
                lightDirection: this.getLightDirection(sunPosition)
            }
        };
    }

    /**
     * 影の情報を計算
     * @param {object} sunPosition - 太陽位置
     * @returns {object} 影の情報
     */
    calculateShadowInfo(sunPosition) {
        const elevation = this.radiansToDegrees(sunPosition.altitude);
        const azimuth = this.normalizeAzimuth(this.radiansToDegrees(sunPosition.azimuth));

        return {
            direction: (azimuth + 180) % 360, // 影の方向（太陽と反対）
            relativeLength: this.calculateRelativeShadowLength(elevation),
            exists: elevation > 0,
            description: this.describeShadow(elevation, azimuth)
        };
    }

    /**
     * 太陽フェーズを判定
     * @param {Date} dateTime - 対象日時
     * @param {object} sunTimes - 太陽時刻データ
     * @returns {string} フェーズ名
     */
    determineSunPhase(dateTime, sunTimes) {
        const time = dateTime.getTime();

        if (time < sunTimes.dawn.getTime()) return 'night';
        if (time < sunTimes.sunrise.getTime()) return 'dawn';
        if (time < sunTimes.goldenHourEnd.getTime()) return 'golden-hour-morning';
        if (time < sunTimes.solarNoon.getTime()) return 'morning';
        if (time < sunTimes.goldenHour.getTime()) return 'afternoon';
        if (time < sunTimes.sunset.getTime()) return 'golden-hour-evening';
        if (time < sunTimes.dusk.getTime()) return 'sunset';
        return 'night';
    }

    /**
     * 光の質を判定
     * @param {number} elevation - 太陽高度
     * @param {string} phase - 太陽フェーズ
     * @returns {string} 光の質
     */
    determineLightQuality(elevation, phase) {
        if (elevation < 0) return 'none';
        if (elevation < 6) return 'dim';
        if (phase.includes('golden-hour')) return 'golden';
        if (elevation < 30) return 'soft';
        if (elevation < 60) return 'normal';
        return 'harsh';
    }

    /**
     * 相対的な影の長さを計算
     * @param {number} elevation - 太陽高度（度）
     * @returns {number} 相対的な影の長さ
     */
    calculateRelativeShadowLength(elevation) {
        if (elevation <= 0) return Infinity;
        return 1 / Math.tan(this.degreesToRadians(elevation));
    }

    /**
     * 撮影のヒントを提供
     * @param {number} elevation - 太陽高度
     * @param {string} phase - 太陽フェーズ
     * @returns {Array} 撮影ヒント
     */
    getPhotographyTips(elevation, phase) {
        const tips = [];

        switch (phase) {
            case 'golden-hour-morning':
            case 'golden-hour-evening':
                tips.push('ゴールデンアワー: 暖色系の美しい光');
                tips.push('ポートレートや風景撮影に最適');
                break;
            case 'dawn':
            case 'sunset':
                tips.push('マジックアワー: ドラマチックな空の色');
                break;
            case 'morning':
            case 'afternoon':
                if (elevation > 60) {
                    tips.push('太陽が高く、影が短い');
                    tips.push('コントラストに注意');
                } else {
                    tips.push('適度な光量と影');
                }
                break;
            case 'night':
                tips.push('夜間: フラッシュまたは人工光源が必要');
                break;
        }

        return tips;
    }

    /**
     * 時刻の整合性をチェック
     * @param {Date} dateTime - 対象日時
     * @param {object} sunTimes - 太陽時刻データ
     * @param {string} phase - フェーズ
     * @returns {object} 整合性チェック結果
     */
    checkTimeConsistency(dateTime, sunTimes, phase) {
        const result = {
            consistent: true,
            warnings: []
        };

        // 夜間なのに太陽が見える、など
        const hour = dateTime.getHours();
        
        if (phase === 'night' && hour >= 6 && hour <= 18) {
            result.consistent = false;
            result.warnings.push('夜間フェーズですが、昼間の時刻です');
        }

        if ((phase === 'morning' || phase === 'afternoon') && (hour < 6 || hour > 18)) {
            result.consistent = false;
            result.warnings.push('昼間フェーズですが、夜間の時刻です');
        }

        return result;
    }

    /**
     * 影の方向を取得
     * @param {object} sunPosition - 太陽位置
     * @returns {string} 方角の説明
     */
    getShadowDirection(sunPosition) {
        const azimuth = this.normalizeAzimuth(this.radiansToDegrees(sunPosition.azimuth));
        const shadowDirection = (azimuth + 180) % 360;
        return this.degreesToCardinal(shadowDirection);
    }

    /**
     * 光の方向を取得
     * @param {object} sunPosition - 太陽位置
     * @returns {string} 方角の説明
     */
    getLightDirection(sunPosition) {
        const azimuth = this.normalizeAzimuth(this.radiansToDegrees(sunPosition.azimuth));
        return this.degreesToCardinal(azimuth);
    }

    /**
     * 影の説明を生成
     * @param {number} elevation - 太陽高度
     * @param {number} azimuth - 太陽方位
     * @returns {string} 影の説明
     */
    describeShadow(elevation, azimuth) {
        if (elevation <= 0) return '影なし（太陽が地平線下）';

        const length = this.calculateRelativeShadowLength(elevation);
        const direction = this.degreesToCardinal((azimuth + 180) % 360);

        let lengthDesc;
        if (length > 10) lengthDesc = '非常に長い';
        else if (length > 5) lengthDesc = '長い';
        else if (length > 2) lengthDesc = '普通';
        else if (length > 1) lengthDesc = '短い';
        else lengthDesc = '非常に短い';

        return `${direction}方向に${lengthDesc}影`;
    }

    /**
     * 太陽データをフォーマット
     * @param {object} sunData - 太陽データ
     * @returns {object} フォーマット済みデータ
     */
    formatSunData(sunData) {
        return {
            elevation: `${sunData.position.elevation.toFixed(1)}°`,
            azimuth: `${sunData.position.azimuth.toFixed(1)}° (${this.degreesToCardinal(sunData.position.azimuth)})`,
            phase: this.getPhaseDisplayName(sunData.analysis.phase),
            times: {
                sunrise: window.WhereShotUtils.DateUtils.formatDateTime(sunData.times.sunrise),
                sunset: window.WhereShotUtils.DateUtils.formatDateTime(sunData.times.sunset),
                solarNoon: window.WhereShotUtils.DateUtils.formatDateTime(sunData.times.solarNoon)
            },
            shadow: {
                direction: `${sunData.shadow.direction.toFixed(0)}° (${this.degreesToCardinal(sunData.shadow.direction)})`,
                description: sunData.shadow.description
            }
        };
    }

    /**
     * フェーズの表示名を取得
     * @param {string} phase - フェーズ名
     * @returns {string} 表示名
     */
    getPhaseDisplayName(phase) {
        const phaseNames = {
            'night': '夜間',
            'dawn': '明け方',
            'golden-hour-morning': '朝のゴールデンアワー',
            'morning': '午前',
            'afternoon': '午後',
            'golden-hour-evening': '夕方のゴールデンアワー',
            'sunset': '夕暮れ'
        };

        return phaseNames[phase] || phase;
    }

    /**
     * ラジアンを度に変換
     * @param {number} radians - ラジアン
     * @returns {number} 度
     */
    radiansToDegrees(radians) {
        return radians * 180 / Math.PI;
    }

    /**
     * 度をラジアンに変換
     * @param {number} degrees - 度
     * @returns {number} ラジアン
     */
    degreesToRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    /**
     * 方位角を0-360度に正規化
     * @param {number} azimuth - 方位角
     * @returns {number} 正規化された方位角
     */
    normalizeAzimuth(azimuth) {
        azimuth = azimuth + 180; // SunCalcは南を0度とするため、北を0度に変換
        return (azimuth % 360 + 360) % 360;
    }

    /**
     * 度を方角に変換
     * @param {number} degrees - 度
     * @returns {string} 方角
     */
    degreesToCardinal(degrees) {
        const directions = [
            'N', 'NNE', 'NE', 'ENE',
            'E', 'ESE', 'SE', 'SSE',
            'S', 'SSW', 'SW', 'WSW',
            'W', 'WNW', 'NW', 'NNW'
        ];
        
        const index = Math.round(degrees / 22.5) % 16;
        return directions[index];
    }

    /**
     * 現在の太陽データを取得
     * @returns {object|null} 太陽データ
     */
    getCurrentSunData() {
        return this.sunData;
    }

    /**
     * SunCalc.org URLを生成
     * @param {number} latitude - 緯度
     * @param {number} longitude - 経度
     * @param {Date} dateTime - 日時
     * @returns {string} SunCalc.org URL
     */
    generateSunCalcURL(latitude, longitude, dateTime) {
        return window.WhereShotUtils.URLUtils.generateSunCalcURL(latitude, longitude, dateTime);
    }

    /**
     * 影の検証ツール
     * @param {number} observedShadowDirection - 観察された影の方向（度）
     * @param {number} tolerance - 許容誤差（度）
     * @returns {object} 検証結果
     */
    verifyShadowDirection(observedShadowDirection, tolerance = 15) {
        if (!this.sunData) {
            throw new Error('太陽位置が計算されていません');
        }

        const calculatedDirection = this.sunData.shadow.direction;
        const difference = Math.abs(calculatedDirection - observedShadowDirection);
        const normalizedDifference = Math.min(difference, 360 - difference);

        return {
            calculated: calculatedDirection,
            observed: observedShadowDirection,
            difference: normalizedDifference,
            matches: normalizedDifference <= tolerance,
            confidence: Math.max(0, 100 - (normalizedDifference / tolerance) * 100)
        };
    }

    /**
     * データをクリア
     */
    clearData() {
        this.currentPosition = null;
        this.currentDateTime = null;
        this.sunData = null;
    }
}

// シングルトンインスタンスを作成
window.WhereShotSunCalculator = new SunCalculator();