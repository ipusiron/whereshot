/**
 * WhereShot - Exifメタデータ抽出エンジン
 * Created by IPUSIRON - セキュリティ重視のOSINTツール
 */

class ExifParser {
    constructor() {
        this.extractedData = null;
        this.callbacks = {};
    }

    /**
     * 画像ファイルからExif情報を抽出
     * @param {File} file - 画像ファイル
     * @returns {Promise<object>} 抽出されたExif情報
     */
    async extractExifData(file) {
        return new Promise((resolve, reject) => {
            try {
                // ファイル検証
                const validation = window.WhereShotUtils.FileUtils.validateFile(file);
                if (!validation.isValid) {
                    reject(new Error(validation.errors.join(', ')));
                    return;
                }

                // Exif-jsライブラリを使用してExif情報を抽出
                EXIF.getData(file, () => {
                    try {
                        const allMetaData = EXIF.getAllTags(file);
                        const processedData = this.processExifData(allMetaData, file);
                        this.extractedData = processedData;
                        
                        // セキュリティログ
                        console.log('[WhereShot] Exif extraction completed:', {
                            hasGPS: !!processedData.gps.latitude,
                            hasDateTime: !!processedData.dateTime.original,
                            fileSize: file.size
                        });
                        
                        resolve(processedData);
                    } catch (error) {
                        console.error('[WhereShot] Exif processing error:', error);
                        reject(error);
                    }
                });
            } catch (error) {
                console.error('[WhereShot] Exif extraction error:', error);
                reject(error);
            }
        });
    }

    /**
     * 生のExifデータを処理・整理
     * @param {object} exifData - 生のExifデータ
     * @param {File} file - 元ファイル
     * @returns {object} 処理されたメタデータ
     */
    processExifData(exifData, file) {
        const processed = {
            file: this.extractFileInfo(file),
            dateTime: this.extractDateTimeInfo(exifData),
            gps: this.extractGPSInfo(exifData),
            camera: this.extractCameraInfo(exifData),
            settings: this.extractCameraSettings(exifData),
            technical: this.extractTechnicalInfo(exifData),
            security: this.performSecurityAnalysis(exifData, file),
            raw: exifData
        };

        return processed;
    }

    /**
     * ファイル基本情報を抽出
     * @param {File} file - ファイルオブジェクト
     * @returns {object} ファイル情報
     */
    extractFileInfo(file) {
        return {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: new Date(file.lastModified),
            sizeFormatted: window.WhereShotUtils.FileUtils.formatFileSize(file.size),
            typeCategory: window.WhereShotUtils.FileUtils.getFileType(file.name)
        };
    }

    /**
     * 日時情報を抽出・処理
     * @param {object} exifData - Exifデータ
     * @returns {object} 日時情報
     */
    extractDateTimeInfo(exifData) {
        const dateTimeFields = [
            'DateTime',
            'DateTimeOriginal',
            'DateTimeDigitized',
            'CreateDate',
            'ModifyDate'
        ];

        const dateTimeInfo = {
            original: null,
            digitized: null,
            modified: null,
            created: null,
            timezone: null,
            formatted: {}
        };

        // 各日時フィールドを処理
        dateTimeFields.forEach(field => {
            if (exifData[field]) {
                const date = this.parseExifDateTime(exifData[field]);
                if (date) {
                    switch (field) {
                        case 'DateTime':
                        case 'ModifyDate':
                            dateTimeInfo.modified = date;
                            break;
                        case 'DateTimeOriginal':
                            dateTimeInfo.original = date;
                            break;
                        case 'DateTimeDigitized':
                            dateTimeInfo.digitized = date;
                            break;
                        case 'CreateDate':
                            dateTimeInfo.created = date;
                            break;
                    }
                }
            }
        });

        // タイムゾーン情報
        if (exifData.OffsetTime || exifData.OffsetTimeOriginal) {
            dateTimeInfo.timezone = exifData.OffsetTime || exifData.OffsetTimeOriginal;
        }

        // フォーマット済み文字列を生成
        Object.keys(dateTimeInfo).forEach(key => {
            if (dateTimeInfo[key] instanceof Date) {
                dateTimeInfo.formatted[key] = window.WhereShotUtils.DateUtils.formatDateTime(dateTimeInfo[key]);
            }
        });

        return dateTimeInfo;
    }

    /**
     * GPS情報を抽出・処理
     * @param {object} exifData - Exifデータ
     * @returns {object} GPS情報
     */
    extractGPSInfo(exifData) {
        const gpsInfo = {
            latitude: null,
            longitude: null,
            altitude: null,
            accuracy: null,
            direction: null,
            speed: null,
            timestamp: null,
            formatted: {},
            raw: {}
        };

        // GPS座標の抽出
        if (exifData.GPSLatitude && exifData.GPSLongitude) {
            gpsInfo.latitude = this.convertGPSCoordinate(
                exifData.GPSLatitude,
                exifData.GPSLatitudeRef
            );
            gpsInfo.longitude = this.convertGPSCoordinate(
                exifData.GPSLongitude,
                exifData.GPSLongitudeRef
            );
        }

        // 高度情報
        if (exifData.GPSAltitude) {
            gpsInfo.altitude = this.convertGPSAltitude(
                exifData.GPSAltitude,
                exifData.GPSAltitudeRef
            );
        }

        // その他のGPS情報
        if (exifData.GPSDOP) gpsInfo.accuracy = exifData.GPSDOP;
        if (exifData.GPSImgDirection) gpsInfo.direction = exifData.GPSImgDirection;
        if (exifData.GPSSpeed) gpsInfo.speed = exifData.GPSSpeed;
        if (exifData.GPSTimeStamp) gpsInfo.timestamp = exifData.GPSTimeStamp;

        // フォーマット済み情報
        if (gpsInfo.latitude !== null && gpsInfo.longitude !== null) {
            gpsInfo.formatted.coordinates = window.WhereShotUtils.GeoUtils.formatCoordinates(
                gpsInfo.latitude,
                gpsInfo.longitude
            );
        }

        if (gpsInfo.altitude !== null) {
            gpsInfo.formatted.altitude = `${gpsInfo.altitude.toFixed(1)}m`;
        }

        // 生データの保存
        gpsInfo.raw = {
            GPSLatitude: exifData.GPSLatitude,
            GPSLatitudeRef: exifData.GPSLatitudeRef,
            GPSLongitude: exifData.GPSLongitude,
            GPSLongitudeRef: exifData.GPSLongitudeRef,
            GPSAltitude: exifData.GPSAltitude,
            GPSAltitudeRef: exifData.GPSAltitudeRef
        };

        return gpsInfo;
    }

    /**
     * カメラ情報を抽出
     * @param {object} exifData - Exifデータ
     * @returns {object} カメラ情報
     */
    extractCameraInfo(exifData) {
        return {
            make: this.sanitizeString(exifData.Make) || null,
            model: this.sanitizeString(exifData.Model) || null,
            software: this.sanitizeString(exifData.Software) || null,
            lens: this.sanitizeString(exifData.LensModel || exifData.LensInfo) || null,
            serial: this.sanitizeString(exifData.BodySerialNumber) || null,
            lensSerial: this.sanitizeString(exifData.LensSerialNumber) || null,
            formatted: {
                camera: this.formatCameraName(
                    this.sanitizeString(exifData.Make), 
                    this.sanitizeString(exifData.Model)
                ),
                fullInfo: this.formatFullCameraInfo(exifData)
            }
        };
    }

    /**
     * 撮影設定情報を抽出
     * @param {object} exifData - Exifデータ
     * @returns {object} 撮影設定情報
     */
    extractCameraSettings(exifData) {
        const settings = {
            iso: exifData.ISOSpeedRatings || exifData.ISO || null,
            aperture: exifData.FNumber || exifData.ApertureValue || null,
            shutter: exifData.ShutterSpeedValue || exifData.ExposureTime || null,
            focalLength: exifData.FocalLength || null,
            exposureMode: exifData.ExposureMode || null,
            meteringMode: exifData.MeteringMode || null,
            flash: exifData.Flash || null,
            whiteBalance: exifData.WhiteBalance || null,
            colorSpace: exifData.ColorSpace || null,
            orientation: exifData.Orientation || null,
            formatted: {}
        };

        // フォーマット済み設定情報
        if (settings.aperture) {
            settings.formatted.aperture = `f/${settings.aperture}`;
        }
        
        if (settings.shutter) {
            settings.formatted.shutter = this.formatShutterSpeed(settings.shutter);
        }
        
        if (settings.focalLength) {
            settings.formatted.focalLength = `${settings.focalLength}mm`;
        }
        
        if (settings.iso) {
            settings.formatted.iso = `ISO ${settings.iso}`;
        }

        return settings;
    }

    /**
     * 技術的情報を抽出
     * @param {object} exifData - Exifデータ
     * @returns {object} 技術的情報
     */
    extractTechnicalInfo(exifData) {
        return {
            resolution: {
                width: exifData.ExifImageWidth || exifData.ImageWidth || null,
                height: exifData.ExifImageHeight || exifData.ImageLength || null,
                xResolution: exifData.XResolution || null,
                yResolution: exifData.YResolution || null,
                resolutionUnit: exifData.ResolutionUnit || null
            },
            compression: exifData.Compression || null,
            photometricInterpretation: exifData.PhotometricInterpretation || null,
            bitsPerSample: exifData.BitsPerSample || null,
            samplesPerPixel: exifData.SamplesPerPixel || null
        };
    }

    /**
     * セキュリティ分析を実行
     * @param {object} exifData - Exifデータ
     * @param {File} file - ファイル
     * @returns {object} セキュリティ分析結果
     */
    performSecurityAnalysis(exifData, file) {
        const analysis = {
            privacyRisk: 'low',
            hasGPS: false,
            hasPersonalInfo: false,
            hasCameraSerial: false,
            hasTimestamp: false,
            warnings: [],
            recommendations: []
        };

        // GPS情報のチェック
        if (exifData.GPSLatitude && exifData.GPSLongitude) {
            analysis.hasGPS = true;
            analysis.privacyRisk = 'high';
            analysis.warnings.push('GPS位置情報が含まれています');
            analysis.recommendations.push('公開前にGPS情報を削除することを推奨');
        }

        // 個人識別可能情報のチェック
        if (exifData.BodySerialNumber || exifData.LensSerialNumber) {
            analysis.hasCameraSerial = true;
            analysis.privacyRisk = analysis.privacyRisk === 'high' ? 'high' : 'medium';
            analysis.warnings.push('カメラ/レンズのシリアル番号が含まれています');
            analysis.recommendations.push('デバイス特定を避けるためシリアル番号の削除を推奨');
        }

        // タイムスタンプのチェック
        if (exifData.DateTime || exifData.DateTimeOriginal) {
            analysis.hasTimestamp = true;
            analysis.warnings.push('詳細な撮影時刻が記録されています');
        }

        // その他の個人情報
        if (exifData.Artist || exifData.Copyright || exifData.UserComment) {
            analysis.hasPersonalInfo = true;
            analysis.privacyRisk = 'medium';
            analysis.warnings.push('作者情報またはコメントが含まれています');
        }

        return analysis;
    }

    /**
     * 文字列をサニタイズして文字化けを防ぐ
     * @param {any} str - サニタイズする文字列
     * @returns {string|null} サニタイズされた文字列
     */
    sanitizeString(str) {
        if (!str) return null;
        
        // 文字列型でない場合は変換を試みる
        if (typeof str !== 'string') {
            // 配列やオブジェクトの場合は最初の要素を取得
            if (Array.isArray(str) && str.length > 0) {
                str = str[0];
            } else if (typeof str === 'object') {
                // オブジェクトの場合は文字列化を試みる
                try {
                    str = String(str);
                } catch (error) {
                    return null;
                }
            } else {
                str = String(str);
            }
        }
        
        // 制御文字や非印字文字を除去
        str = str.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        
        // 連続する非ASCII文字（文字化けの可能性）をチェック
        const nonAsciiPattern = /[^\x20-\x7E\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g;
        const nonAsciiMatches = str.match(nonAsciiPattern);
        
        // 非ASCII文字が全体の50%以上の場合は文字化けと判定
        if (nonAsciiMatches && nonAsciiMatches.length > str.length * 0.5) {
            return null;
        }
        
        // 非ASCII文字を除去（ただし日本語は保持）
        str = str.replace(/[^\x20-\x7E\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s]/g, '');
        
        // 空白文字のトリム
        str = str.trim();
        
        // 空文字列の場合はnullを返す
        return str.length > 0 ? str : null;
    }

    /**
     * Exif日時文字列をDateオブジェクトに変換
     * @param {string} dateTimeString - Exif日時文字列
     * @returns {Date|null} Dateオブジェクト
     */
    parseExifDateTime(dateTimeString) {
        if (!dateTimeString) return null;

        try {
            // Exif形式: "YYYY:MM:DD HH:MM:SS"
            const cleanStr = dateTimeString.replace(/:/g, '-', 2).replace(':', ' ');
            const date = new Date(cleanStr);
            
            return isNaN(date.getTime()) ? null : date;
        } catch (error) {
            console.warn('Exif日時のパースに失敗:', error);
            return null;
        }
    }

    /**
     * GPS座標を度分秒からデシマル度に変換
     * @param {Array} coordinate - GPS座標配列
     * @param {string} ref - 方位参照 (N/S/E/W)
     * @returns {number|null} デシマル度
     */
    convertGPSCoordinate(coordinate, ref) {
        if (!coordinate || !Array.isArray(coordinate) || coordinate.length !== 3) {
            return null;
        }

        try {
            const degrees = coordinate[0];
            const minutes = coordinate[1];
            const seconds = coordinate[2];

            return window.WhereShotUtils.GeoUtils.dmsToDecimal(degrees, minutes, seconds, ref);
        } catch (error) {
            console.warn('GPS座標の変換に失敗:', error);
            return null;
        }
    }

    /**
     * GPS高度を変換
     * @param {number} altitude - 高度値
     * @param {number} ref - 高度参照 (0=海面上, 1=海面下)
     * @returns {number|null} 高度（メートル）
     */
    convertGPSAltitude(altitude, ref) {
        if (altitude === null || altitude === undefined) return null;

        const altitudeValue = typeof altitude === 'object' ? altitude.numerator / altitude.denominator : altitude;
        return ref === 1 ? -altitudeValue : altitudeValue;
    }

    /**
     * カメラ名をフォーマット
     * @param {string} make - メーカー名
     * @param {string} model - モデル名
     * @returns {string} フォーマットされたカメラ名
     */
    formatCameraName(make, model) {
        // サニタイズされた値を使用
        const safeMake = this.sanitizeString(make);
        const safeModel = this.sanitizeString(model);
        
        if (!safeMake && !safeModel) return '不明';
        if (!safeMake) return safeModel;
        if (!safeModel) return safeMake;
        
        // メーカー名がモデル名に含まれている場合は重複を避ける
        if (safeModel.toLowerCase().includes(safeMake.toLowerCase())) {
            return safeModel;
        }
        
        return `${safeMake} ${safeModel}`;
    }

    /**
     * カメラの完全情報をフォーマット
     * @param {object} exifData - Exifデータ
     * @returns {string} フォーマットされた情報
     */
    formatFullCameraInfo(exifData) {
        const parts = [];
        
        const safeMake = this.sanitizeString(exifData.Make);
        const safeModel = this.sanitizeString(exifData.Model);
        const safeLens = this.sanitizeString(exifData.LensModel);
        const safeSoftware = this.sanitizeString(exifData.Software);
        
        if (safeMake && safeModel) {
            parts.push(this.formatCameraName(safeMake, safeModel));
        }
        
        if (safeLens) {
            parts.push(`レンズ: ${safeLens}`);
        }
        
        if (safeSoftware) {
            parts.push(`ソフトウェア: ${safeSoftware}`);
        }
        
        return parts.length > 0 ? parts.join('\n') : '情報なし';
    }

    /**
     * シャッタースピードをフォーマット
     * @param {number} speed - シャッタースピード値
     * @returns {string} フォーマットされたシャッタースピード
     */
    formatShutterSpeed(speed) {
        if (!speed) return '';

        if (speed >= 1) {
            return `${speed}s`;
        } else {
            const fraction = Math.round(1 / speed);
            return `1/${fraction}s`;
        }
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

    /**
     * Exif情報をJSON形式でエクスポート
     * @param {boolean} includeSensitive - 機密情報を含めるかどうか
     * @returns {string} JSON文字列
     */
    exportData(includeSensitive = false) {
        if (!this.extractedData) return null;

        const exportData = { ...this.extractedData };
        
        if (!includeSensitive) {
            // 機密情報を除去
            delete exportData.gps;
            delete exportData.camera.serial;
            delete exportData.camera.lensSerial;
            if (exportData.raw) {
                delete exportData.raw.GPSLatitude;
                delete exportData.raw.GPSLongitude;
                delete exportData.raw.BodySerialNumber;
                delete exportData.raw.LensSerialNumber;
            }
        }

        return JSON.stringify(exportData, null, 2);
    }
}

// シングルトンインスタンスを作成
window.WhereShotExifParser = new ExifParser();
