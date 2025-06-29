/**
 * WhereShot - 日時推定エンジン
 * Created by IPUSIRON - セキュリティ重視のOSINTツール
 */

class DateTimeEstimator {
    constructor() {
        this.dateTimePatterns = [
            // === 時間付きパターン（優先度高） ===
            
            // YYYY-MM-DD HH:MM:SS形式（最も一般的）
            {
                pattern: /(\d{4})[_\-\/](\d{1,2})[_\-\/](\d{1,2})[_\s\-T](\d{1,2})[_:\-](\d{1,2})[_:\-](\d{1,2})/,
                format: 'YYYY-MM-DD HH:MM:SS',
                reliability: 0.95
            },
            
            // YYYYMMDD_HHMMSS形式（カメラ系で多用）
            {
                pattern: /(\d{4})(\d{2})(\d{2})[_\-\s](\d{2})(\d{2})(\d{2})/,
                format: 'YYYYMMDD_HHMMSS',
                reliability: 0.95
            },
            
            // YYYYMMDDHHMMSS形式（連続）
            {
                pattern: /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/,
                format: 'YYYYMMDDHHMMSS',
                reliability: 0.9
            },
            
            // IMG_YYYYMMDD_HHMMSS形式（標準カメラ形式）
            {
                pattern: /IMG[_\-\s](\d{4})(\d{2})(\d{2})[_\-\s](\d{2})(\d{2})(\d{2})/i,
                format: 'IMG_YYYYMMDD_HHMMSS',
                reliability: 0.95
            },
            
            // DSC_YYYYMMDD_HHMMSS形式
            {
                pattern: /DSC[_\-\s](\d{4})(\d{2})(\d{2})[_\-\s](\d{2})(\d{2})(\d{2})/i,
                format: 'DSC_YYYYMMDD_HHMMSS',
                reliability: 0.95
            },
            
            // PHOTO_YYYY_MM_DD_HH_MM_SS形式
            {
                pattern: /PHOTO[_\-\s](\d{4})[_\-](\d{1,2})[_\-](\d{1,2})[_\-\s](\d{1,2})[_\-](\d{1,2})[_\-](\d{1,2})/i,
                format: 'PHOTO_YYYY_MM_DD_HH_MM_SS',
                reliability: 0.9
            },
            
            // Screenshot_YYYY-MM-DD-HH-MM-SS形式
            {
                pattern: /Screenshot[_\-\s](\d{4})[_\-](\d{1,2})[_\-](\d{1,2})[_\-\s](\d{1,2})[_\-](\d{1,2})[_\-](\d{1,2})/i,
                format: 'Screenshot_YYYY-MM-DD-HH-MM-SS',
                reliability: 0.9
            },
            
            // YYYY-MM-DD_HH-MM形式（分まで）
            {
                pattern: /(\d{4})[_\-\/](\d{1,2})[_\-\/](\d{1,2})[_\s\-T](\d{1,2})[_:\-](\d{1,2})/,
                format: 'YYYY-MM-DD HH:MM',
                reliability: 0.85
            },
            
            // YYYYMMDD_HHMM形式（分まで）
            {
                pattern: /(\d{4})(\d{2})(\d{2})[_\-\s](\d{2})(\d{2})(?!\d)/,
                format: 'YYYYMMDD_HHMM',
                reliability: 0.85
            },
            
            // VID_YYYYMMDD_HHMMSS形式（動画）
            {
                pattern: /VID[_\-\s](\d{4})(\d{2})(\d{2})[_\-\s](\d{2})(\d{2})(\d{2})/i,
                format: 'VID_YYYYMMDD_HHMMSS',
                reliability: 0.95
            },
            
            // 時間付きISO形式（YYYY-MM-DDTHH:MM:SS）
            {
                pattern: /(\d{4})[_\-](\d{2})[_\-](\d{2})T(\d{2}):(\d{2}):(\d{2})/,
                format: 'ISO_DATETIME',
                reliability: 0.95
            },
            
            // h時m分s秒形式（日本語）
            {
                pattern: /(\d{4})[_\-\/](\d{1,2})[_\-\/](\d{1,2})[_\s](\d{1,2})[時h](\d{1,2})[分m](\d{1,2})[秒s]/,
                format: 'YYYY-MM-DD HH時MM分SS秒',
                reliability: 0.9
            },
            
            // === 日付のみパターン（時間なし） ===
            
            // YYYY-MM-DD形式（時刻なし）
            {
                pattern: /(\d{4})[_\-\/](\d{1,2})[_\-\/](\d{1,2})(?![_\-\d])/,
                format: 'YYYY-MM-DD',
                reliability: 0.7
            },
            
            // YYYYMMDD形式（時刻なし）
            {
                pattern: /(\d{4})(\d{2})(\d{2})(?![_\-\d])/,
                format: 'YYYYMMDD',
                reliability: 0.7
            },
            
            // WhatsApp形式: IMG-YYYYMMDD-WAxxxx
            {
                pattern: /IMG[_\-](\d{4})(\d{2})(\d{2})[_\-]WA/i,
                format: 'WhatsApp',
                reliability: 0.6
            },
            
            // Unix timestamp形式（10桁）
            {
                pattern: /(\d{10})(?!\d)/,
                format: 'Unix_timestamp',
                reliability: 0.8
            },
            
            // Unix timestamp形式（13桁、ミリ秒）
            {
                pattern: /(\d{13})(?!\d)/,
                format: 'Unix_timestamp_ms',
                reliability: 0.8
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

        // Exif日時情報（最高の信頼性）
        if (exifData.dateTime.original) {
            sources.push({
                type: 'exif_original',
                date: exifData.dateTime.original,
                reliability: 0.95,
                description: 'Exif撮影日時',
                hasTime: true
            });
        }

        if (exifData.dateTime.digitized) {
            sources.push({
                type: 'exif_digitized',
                date: exifData.dateTime.digitized,
                reliability: 0.85,
                description: 'Exifデジタル化日時',
                hasTime: true
            });
        }

        if (exifData.dateTime.modified) {
            sources.push({
                type: 'exif_modified',
                date: exifData.dateTime.modified,
                reliability: 0.65,
                description: 'Exif更新日時',
                hasTime: true
            });
        }

        // ファイル名からの抽出
        const filenameResults = this.extractAllDatesFromFilename(file.name);
        filenameResults.forEach(result => {
            sources.push({
                type: 'filename',
                date: result.date,
                reliability: result.reliability,
                description: `ファイル名 (${result.format})`,
                pattern: result.format,
                hasTime: result.hasTime,
                matchedText: result.matchedText
            });
        });

        // ファイル更新日時
        sources.push({
            type: 'file_modified',
            date: new Date(file.lastModified),
            reliability: 0.3,
            description: 'ファイル更新日時',
            hasTime: true
        });

        // 信頼性とタイムスタンプの有無でソート
        return sources.sort((a, b) => {
            // 時間情報がある方を優先
            if (a.hasTime && !b.hasTime) return -1;
            if (!a.hasTime && b.hasTime) return 1;
            // 信頼性でソート
            return b.reliability - a.reliability;
        });
    }

    /**
     * ファイル名からすべての日時を抽出
     * @param {string} filename - ファイル名
     * @returns {Array} 抽出結果の配列
     */
    extractAllDatesFromFilename(filename) {
        const results = [];
        
        for (const pattern of this.dateTimePatterns) {
            const matches = filename.matchAll(new RegExp(pattern.pattern.source, 'gi'));
            
            for (const match of matches) {
                const dateResult = this.parseMatchedDate(match, pattern.format);
                if (dateResult && this.isValidDate(dateResult.date)) {
                    results.push({
                        date: dateResult.date,
                        format: pattern.format,
                        reliability: pattern.reliability || 0.7,
                        hasTime: dateResult.hasTime,
                        matchedText: match[0]
                    });
                }
            }
        }

        // 重複除去（同じ日時の場合は信頼性が高い方を採用）
        const uniqueResults = [];
        results.forEach(result => {
            const existing = uniqueResults.find(existing => 
                Math.abs(existing.date.getTime() - result.date.getTime()) < 60000 // 1分以内の差は同じとみなす
            );
            
            if (!existing) {
                uniqueResults.push(result);
            } else if (result.reliability > existing.reliability) {
                const index = uniqueResults.indexOf(existing);
                uniqueResults[index] = result;
            }
        });

        return uniqueResults.sort((a, b) => b.reliability - a.reliability);
    }

    /**
     * マッチした文字列から日付オブジェクトを作成
     * @param {Array} match - 正規表現マッチ結果
     * @param {string} format - フォーマット種類
     * @returns {object|null} 日付オブジェクトと時間有無フラグ
     */
    parseMatchedDate(match, format) {
        try {
            let date = null;
            let hasTime = false;

            switch (format) {
                case 'YYYY-MM-DD HH:MM:SS':
                case 'YYYYMMDD_HHMMSS':
                case 'YYYYMMDDHHMMSS':
                case 'IMG_YYYYMMDD_HHMMSS':
                case 'DSC_YYYYMMDD_HHMMSS':
                case 'VID_YYYYMMDD_HHMMSS':
                case 'PHOTO_YYYY_MM_DD_HH_MM_SS':
                case 'Screenshot_YYYY-MM-DD-HH-MM-SS':
                case 'ISO_DATETIME':
                case 'YYYY-MM-DD HH時MM分SS秒':
                    date = new Date(
                        parseInt(match[1]), // year
                        parseInt(match[2]) - 1, // month (0-based)
                        parseInt(match[3]), // day
                        parseInt(match[4]) || 0, // hour
                        parseInt(match[5]) || 0, // minute
                        parseInt(match[6]) || 0  // second
                    );
                    hasTime = true;
                    break;

                case 'YYYY-MM-DD HH:MM':
                case 'YYYYMMDD_HHMM':
                    date = new Date(
                        parseInt(match[1]), // year
                        parseInt(match[2]) - 1, // month (0-based)
                        parseInt(match[3]), // day
                        parseInt(match[4]) || 0, // hour
                        parseInt(match[5]) || 0, // minute
                        0  // second
                    );
                    hasTime = true;
                    break;

                case 'YYYY-MM-DD':
                case 'YYYYMMDD':
                case 'WhatsApp':
                    date = new Date(
                        parseInt(match[1]), // year
                        parseInt(match[2]) - 1, // month (0-based)
                        parseInt(match[3]), // day
                        12, 0, 0 // 正午に設定
                    );
                    hasTime = false;
                    break;

                case 'Unix_timestamp':
                    date = new Date(parseInt(match[1]) * 1000);
                    hasTime = true;
                    break;

                case 'Unix_timestamp_ms':
                    date = new Date(parseInt(match[1]));
                    hasTime = true;
                    break;

                default:
                    return null;
            }

            return { date, hasTime };

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
        if (year < 1990 || year > now.getFullYear() + 1) {
            return false;
        }

        // 未来すぎる日付をチェック（1週間以上先）
        const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (date > oneWeekFromNow) {
            return false;
        }

        return true;
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

        // 時間情報がある場合は更に厳密にチェック
        const hasTimeInfo = sources.some(s => s.hasTime);
        const timeTolerance = hasTimeInfo ? 60 * 60 * 1000 : tolerance; // 1時間の許容誤差

        // 各ソース間の比較
        for (let i = 0; i < sources.length; i++) {
            for (let j = i + 1; j < sources.length; j++) {
                const diff = Math.abs(sources[i].date.getTime() - sources[j].date.getTime());
                const currentTolerance = (sources[i].hasTime && sources[j].hasTime) ? timeTolerance : tolerance;
                
                if (diff > currentTolerance) {
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
            agreement: agreement,
            hasTimeInfo: hasTimeInfo
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

        // 時間情報があるソースを優先
        const timeAwareSources = sources.filter(s => s.hasTime);
        const sourcesToConsider = timeAwareSources.length > 0 ? timeAwareSources : sources;

        // Exif Original が存在する場合は最優先
        const exifOriginal = sourcesToConsider.find(s => s.type === 'exif_original');
        if (exifOriginal) {
            return exifOriginal.date;
        }

        // 複数のソースが一致している場合はその値を採用
        if (analysis.consistency === 'high' && sourcesToConsider.length > 1) {
            const consensusDate = this.findConsensusDate(sourcesToConsider, analysis.hasTimeInfo);
            if (consensusDate) {
                return consensusDate;
            }
        }

        // 最も信頼性が高いソースを選択
        return sourcesToConsider[0].date;
    }

    /**
     * コンセンサス日時を見つける
     * @param {Array} sources - 日時ソース配列
     * @param {boolean} hasTimeInfo - 時間情報があるかどうか
     * @returns {Date|null} コンセンサス日時
     */
    findConsensusDate(sources, hasTimeInfo) {
        const tolerance = hasTimeInfo ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 時間情報があれば1時間、なければ24時間
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

        // 時間情報がある場合は信頼度アップ
        if (analysis.hasTimeInfo) {
            confidence *= 1.1;
        }

        // ファイル名から時間付きで抽出できた場合は信頼度アップ
        const timeAwareFilenameSource = sources.find(s => s.type === 'filename' && s.hasTime);
        if (timeAwareFilenameSource) {
            confidence *= 1.15;
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

        // 時間情報なしの警告
        if (!analysis.hasTimeInfo) {
            warnings.push({
                type: 'no_time_info',
                message: '時間情報がないため、日付のみの推定です',
                severity: 'info'
            });
        }

        // ファイル名から時間が抽出できた場合の情報
        const timeAwareFilenameSource = sources.find(s => s.type === 'filename' && s.hasTime);
        if (timeAwareFilenameSource) {
            warnings.push({
                type: 'filename_time_extracted',
                message: `ファイル名から時間情報を抽出しました (${timeAwareFilenameSource.matchedText})`,
                severity: 'info'
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
            description: source.description + (source.hasTime ? ' (時間付き)' : ' (日付のみ)'),
            date: window.WhereShotUtils.DateUtils.formatDateTime(source.date),
            reliability: `${Math.round(source.reliability * 100)}%`,
            type: source.type,
            matchedText: source.matchedText || ''
        }));
    }
}

// シングルトンインスタンスを作成
window.WhereShotDateTimeEstimator = new DateTimeEstimator();