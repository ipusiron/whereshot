/**
 * WhereShot - 日時推定エンジン
 * Created by IPUSIRON - セキュリティ重視のOSINTツール
 */

class DateTimeEstimator {
    constructor() {
        this.dateTimePatterns = [
            // YYYY-MM-DD HH:MM:SS形式
            {
                pattern: /(\d{4})[_\-](\d{2})[_\-](\d{2})[_\s](\d{2})[_:](\d{2})[_:](\d{2})/,
                format: 'YYYY-MM-DD HH:MM:SS'
            },
            // YYYYMMDD_HHMMSS形式
            {
                pattern: /(\d{4})(\d{2})(\d{2})[_\s](\d{2})(\d{2})(\d{2})/,
                format: 'YYYYMMDD_HHMMSS'
            },
            // YYYY-MM-DD形式（時刻なし）
            {
                pattern: /(\d{4})[_\-](\d{2})[_\-](\d{2})/,
                format: 'YYYY-MM-DD'
            },
            // YYYYMMDD形式
            {
                pattern: /(\d{4})(\d{2})(\d{2})/,
                format: 'YYYYMMDD'
            },
            // IMG_YYYYMMDD_HHMMSS形式（一般的なカメラ形式）
            {
                pattern: /IMG[_\s](\d{4})(\d{2})(\d{2})[_\s](\d{2})(\d{2})(\d{2})/i,
                format: 'IMG_YYYYMMDD_HHMMSS'
            },
            // DSC_YYYYMMDD_HHMMSS形式
            {
                pattern: /DSC[_\s](\d{4})(\d{2})(\d{2})[_\s](\d{2})(\d{2})(\d{2})/i,
                format: 'DSC_YYYYMMDD_HHMMSS'
            },
            // WhatsApp形式: IMG-YYYYMMDD-WAxxxx
            {
                pattern: /IMG[_\-](\d{4})(\d{2})(\d{2})[_\-]WA/i,
                format: 'WhatsApp'
            },
            // Screenshot形式: Screenshot_YYYY-MM-DD-HH-MM-SS
            {
                pattern: /Screenshot[_\s](\d{4})[_\-](\d{2})[_\-](\d{2})[_\-](\d{2})[_\-](\d{2})[_\-](\d{2})/i,
                format: 'Screenshot'
            },
            // Unix timestamp形式（10桁）
            {
                pattern: /(\d{10})/,
                format: 'Unix timestamp'
            }
        ];
    }

    /**
     * 複数のソースから日時を推定
     * @param {object} exifData - Exif情報
     * @param {File} file - ファイルオブジェクト
     * @returns {object} 推定結果
     */
    estimateDateTime(exifData, file) {
        const sources = this.collectDateTimeSources(exifData, file);
        const analysis = this.analyzeDateTimeSources(sources);
        const estimated = this.selectBestDateTime(sources, analysis);

        return {
            sources: sources,
            analysis: analysis,
            estimated: estimated,
            confidence: this.calculateConfidence(sources, analysis),
            warnings: this.generateWarnings(sources, analysis),
            formatted: {
                estimated: estimated ? window.WhereShotUtils.DateUtils.formatDateTime(estimated) : null,
                sources: this.formatSources(sources)
            }
        };
    }

    /**
     * 各ソースから日時情報を収集
     * @param {object} exifData - Exif情報
     * @param {File} file - ファイルオブジェクト
     * @returns {Array} 日時ソース配列
     */
    collectDateTimeSources(exifData, file) {
        const sources = [];

        // Exif日時情報
        if (exifData.dateTime.original) {
            sources.push({
                type: 'exif_original',
                date: exifData.dateTime.original,
                reliability: 0.9,
                description: 'Exif撮影日時'
            });
        }

        if (exifData.dateTime.digitized) {
            sources.push({
                type: 'exif_digitized',
                date: exifData.dateTime.digitized,
                reliability: 0.8,
                description: 'Exifデジタル化日時'
            });
        }

        if (exifData.dateTime.modified) {
            sources.push({
                type: 'exif_modified',
                date: exifData.dateTime.modified,
                reliability: 0.6,
                description: 'Exif更新日時'
            });
        }

        // ファイル名からの抽出
        const filenameDate = this.extractDateFromFilename(file.name);
        if (filenameDate) {
            sources.push({
                type: 'filename',
                date: filenameDate.date,
                reliability: 0.7,
                description: `ファイル名 (${filenameDate.format})`,
                pattern: filenameDate.format
            });
        }

        // ファイル更新日時
        sources.push({
            type: 'file_modified',
            date: new Date(file.lastModified),
            reliability: 0.3,
            description: 'ファイル更新日時'
        });

        return sources.sort((a, b) => b.reliability - a.reliability);
    }

    /**
     * ファイル名から日時を抽出
     * @param {string} filename - ファイル名
     * @returns {object|null} 抽出結果
     */
    extractDateFromFilename(filename) {
        for (const pattern of this.dateTimePatterns) {
            const match = filename.match(pattern.pattern);
            if (match) {
                const date = this.parseMatchedDate(match, pattern.format);
                if (date && this.isValidDate(date)) {
                    return {
                        date: date,
                        format: pattern.format,
                        match: match[0]
                    };
                }
            }
        }
        return null;
    }

    /**
     * マッチした文字列から日付オブジェクトを作成
     * @param {Array} match - 正規表現マッチ結果
     * @param {string} format - フォーマット種類
     * @returns {Date|null} 日付オブジェクト
     */
    parseMatchedDate(match, format) {
        try {
            switch (format) {
                case 'YYYY-MM-DD HH:MM:SS':
                case 'YYYYMMDD_HHMMSS':
                case 'IMG_YYYYMMDD_HHMMSS':
                case 'DSC_YYYYMMDD_HHMMSS':
                case 'Screenshot':
                    return new Date(
                        parseInt(match[1]), // year
                        parseInt(match[2]) - 1, // month (0-based)
                        parseInt(match[3]), // day
                        parseInt(match[4]) || 0, // hour
                        parseInt(match[5]) || 0, // minute
                        parseInt(match[6]) || 0  // second
                    );

                case 'YYYY-MM-DD':
                case 'YYYYMMDD':
                case 'WhatsApp':
                    return new Date(
                        parseInt(match[1]), // year
                        parseInt(match[2]) - 1, // month (0-based)
                        parseInt(match[3]), // day
                        12, 0, 0 // 正午に設定
                    );

                case 'Unix timestamp':
                    return new Date(parseInt(match[1]) * 1000);

                default:
                    return null;
            }
        } catch (error) {
            console.warn('日付パースエラー:', error);
            return null;
        }
    }

    /**
     * 日付の妥当性をチェック
     * @param {Date} date - チェックする日付
     * @returns {boolean} 妥当性
     */
    isValidDate(date) {
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            return false;
        }

        const year = date.getFullYear();
        const now = new Date();

        // 1990年から現在+1年の範囲内
        return year >= 1990 && year <= now.getFullYear() + 1;
    }

    /**
     * 日時ソースを分析
     * @param {Array} sources - 日時ソース配列
     * @returns {object} 分析結果
     */
    analyzeDateTimeSources(sources) {
        if (sources.length === 0) {
            return { consistency: 'none', conflicts: [], agreement: 0 };
        }

        const conflicts = [];
        const tolerance = 24 * 60 * 60 * 1000; // 24時間の許容誤差（ミリ秒）

        // 各ソース間の比較
        for (let i = 0; i < sources.length; i++) {
            for (let j = i + 1; j < sources.length; j++) {
                const diff = Math.abs(sources[i].date.getTime() - sources[j].date.getTime());
                if (diff > tolerance) {
                    conflicts.push({
                        source1: sources[i],
                        source2: sources[j],
                        difference: diff,
                        differenceFormatted: this.formatTimeDifference(diff)
                    });
                }
            }
        }

        // 一致度を計算
        const totalComparisons = (sources.length * (sources.length - 1)) / 2;
        const agreement = totalComparisons > 0 ? 
            ((totalComparisons - conflicts.length) / totalComparisons) : 1;

        let consistency;
        if (conflicts.length === 0) {
            consistency = 'high';
        } else if (agreement >= 0.7) {
            consistency = 'medium';
        } else {
            consistency = 'low';
        }

        return {
            consistency: consistency,
            conflicts: conflicts,
            agreement: agreement
        };
    }

    /**
     * 最適な日時を選択
     * @param {Array} sources - 日時ソース配列
     * @param {object} analysis - 分析結果
     * @returns {Date|null} 推定日時
     */
    selectBestDateTime(sources, analysis) {
        if (sources.length === 0) return null;

        // 信頼性が最も高いソースを基準にする
        let bestSource = sources[0];

        // Exif Original が存在する場合は優先
        const exifOriginal = sources.find(s => s.type === 'exif_original');
        if (exifOriginal) {
            bestSource = exifOriginal;
        }

        // 複数のソースが一致している場合はその値を採用
        if (analysis.consistency === 'high' && sources.length > 1) {
            const consensusDate = this.findConsensusDate(sources);
            if (consensusDate) {
                return consensusDate;
            }
        }

        return bestSource.date;
    }

    /**
     * コンセンサス日時を見つける
     * @param {Array} sources - 日時ソース配列
     * @returns {Date|null} コンセンサス日時
     */
    findConsensusDate(sources) {
        const tolerance = 60 * 60 * 1000; // 1時間の許容誤差
        const groups = [];

        sources.forEach(source => {
            let added = false;
            for (const group of groups) {
                if (Math.abs(group[0].date.getTime() - source.date.getTime()) <= tolerance) {
                    group.push(source);
                    added = true;
                    break;
                }
            }
            if (!added) {
                groups.push([source]);
            }
        });

        // 最大のグループを見つける
        const largestGroup = groups.reduce((prev, current) => 
            prev.length > current.length ? prev : current, []);

        if (largestGroup.length >= 2) {
            // 信頼性が最も高いソースの日時を返す
            return largestGroup.reduce((prev, current) => 
                prev.reliability > current.reliability ? prev : current).date;
        }

        return null;
    }

    /**
     * 信頼度を計算
     * @param {Array} sources - 日時ソース配列
     * @param {object} analysis - 分析結果
     * @returns {number} 信頼度（0-1）
     */
    calculateConfidence(sources, analysis) {
        if (sources.length === 0) return 0;

        let confidence = sources[0].reliability;

        // 一致度を反映
        confidence *= analysis.agreement;

        // ソース数を反映（複数ソースがある場合は信頼度アップ）
        if (sources.length > 1) {
            confidence *= 1.2;
        }

        // Exif Original がある場合は信頼度アップ
        if (sources.some(s => s.type === 'exif_original')) {
            confidence *= 1.3;
        }

        return Math.min(confidence, 1.0);
    }

    /**
     * 警告メッセージを生成
     * @param {Array} sources - 日時ソース配列
     * @param {object} analysis - 分析結果
     * @returns {Array} 警告メッセージ配列
     */
    generateWarnings(sources, analysis) {
        const warnings = [];

        if (sources.length === 0) {
            warnings.push({
                type: 'no_datetime',
                message: '日時情報が見つかりません',
                severity: 'error'
            });
            return warnings;
        }

        if (analysis.consistency === 'low') {
            warnings.push({
                type: 'inconsistent',
                message: '複数の日時情報に大きな差異があります',
                severity: 'warning'
            });
        }

        if (analysis.conflicts.length > 0) {
            analysis.conflicts.forEach(conflict => {
                warnings.push({
                    type: 'conflict',
                    message: `${conflict.source1.description}と${conflict.source2.description}に${conflict.differenceFormatted}の差があります`,
                    severity: 'warning'
                });
            });
        }

        if (!sources.some(s => s.type === 'exif_original')) {
            warnings.push({
                type: 'no_exif_original',
                message: 'Exif撮影日時が存在しません。推定日時の信頼性が低下します',
                severity: 'info'
            });
        }

        // ファイル更新日時のみの場合
        if (sources.length === 1 && sources[0].type === 'file_modified') {
            warnings.push({
                type: 'file_modified_only',
                message: 'ファイル更新日時のみで推定しています。実際の撮影日時と異なる可能性があります',
                severity: 'warning'
            });
        }

        return warnings;
    }

    /**
     * 時間差をフォーマット
     * @param {number} milliseconds - ミリ秒
     * @returns {string} フォーマットされた時間差
     */
    formatTimeDifference(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}日${hours % 24}時間`;
        } else if (hours > 0) {
            return `${hours}時間${minutes % 60}分`;
        } else if (minutes > 0) {
            return `${minutes}分`;
        } else {
            return `${seconds}秒`;
        }
    }

    /**
     * ソース情報をフォーマット
     * @param {Array} sources - 日時ソース配列
     * @returns {Array} フォーマットされたソース情報
     */
    formatSources(sources) {
        return sources.map(source => ({
            description: source.description,
            date: window.WhereShotUtils.DateUtils.formatDateTime(source.date),
            reliability: `${Math.round(source.reliability * 100)}%`,
            type: source.type
        }));
    }
}

// シングルトンインスタンスを作成
window.WhereShotDateTimeEstimator = new DateTimeEstimator();
