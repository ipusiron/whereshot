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
     * 指定位置・UTCの瞬間で太陽位置を計算
     * @param {number} latitude - 緯度
     * @param {number} longitude - 経度
     * @param {number} utcMs - UTCのミリ秒
     * @returns {object|null} 太陽位置データ
     */
    calculateSunPosition(latitude, longitude, utcMs) {
        this.currentPosition = { latitude, longitude };
        this.currentDateTime = utcMs;
        this.sunData = WhereShotLogic.sunReport(SunCalc, latitude, longitude, utcMs);
        return this.sunData;
    }
    /**
     * 現在の太陽データを取得
     * @returns {object|null} 太陽データ
     */
    getCurrentSunData() {
        return this.sunData;
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
