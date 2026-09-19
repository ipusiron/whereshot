/**
 * WhereShot - Exifメタデータ抽出エンジン
 * Created by IPUSIRON - セキュリティ重視のOSINTツール
 */

class ExifParser {
    constructor() {
        this.extractedData = null;
        this.readFailed = false;
    }

    /**
     * 画像ファイルからExif情報を抽出
     * @param {File} file - 画像ファイル
     * @returns {Promise<object>} 正規化されたExif情報（読み取れなければ全項目null）
     */
    async extractExifData(file) {
        this.readFailed = false;
        try {
            const buffer = await file.arrayBuffer();
            const tags = ExifReader.load(buffer, { expanded: true });
            this.extractedData = WhereShotLogic.normalizeTags(tags);
            this.readFailed = Object.values(this.extractedData).every(value => value === null);
        } catch {
            this.readFailed = true;
            this.extractedData = WhereShotLogic.normalizeTags({});
        }
        return this.extractedData;
    }
    /**
     * 抽出されたデータを取得
     * @returns {object|null} 抽出されたデータ
     */
    getExtractedData() {
        return this.extractedData;
    }

    /**
     * データをクリア（セキュリティ目的）
     */
    clearData() {
        if (this.extractedData) {
            window.WhereShotUtils.SecurityUtils.clearSensitiveData(this.extractedData);
            this.extractedData = null;
        }
    }

}

// シングルトンインスタンスを作成
window.WhereShotExifParser = new ExifParser();
