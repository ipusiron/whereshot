# WhereShot API 仕様書

**撮影時刻・場所解析ツール - 開発者向けドキュメント**

このドキュメントでは、WhereShotの内部APIとアーキテクチャについて説明します。

---

## 📋 目次

1. [アーキテクチャ概要](#アーキテクチャ概要)
2. [コアモジュール](#コアモジュール)
3. [API リファレンス](#api-リファレンス)
4. [データ構造](#データ構造)
5. [イベントシステム](#イベントシステム)
6. [拡張方法](#拡張方法)
7. [セキュリティ考慮事項](#セキュリティ考慮事項)

---

## 🏗️ アーキテクチャ概要

WhereShotは、モジュラー設計により各機能を独立したクラスとして実装しています。

### システム構成

```
┌─────────────────┐
│   Main App      │ ← メイン制御
├─────────────────┤
│  ExifParser     │ ← Exif解析
│  SunCalculator  │ ← 太陽位置計算
│  MapController  │ ← 地図制御
│  Utils          │ ← 共通ユーティリティ
└─────────────────┘
```

### 依存関係

- **Leaflet.js**: 地図表示・制御
- **EXIF-js**: Exifメタデータ抽出
- **SunCalc**: 太陽・月の位置計算
- **ブラウザAPI**: File API, Canvas API, Geolocation API

---

## 🧩 コアモジュール

### 1. WhereShotApp (main.js)

メインアプリケーションクラス。全体の制御とUIイベント管理を担当。

```javascript
class WhereShotApp {
    constructor()
    async initialize()
    async handleFileSelection(file)
    updateExifDisplay(exifData)
    calculateSunPosition()
    resetApplication()
}
```

### 2. ExifParser (exif-parser.js)

画像・動画からメタデータを抽出・解析。

```javascript
class ExifParser {
    async extractExifData(file)
    processExifData(exifData, file)
    performSecurityAnalysis(exifData, file)
    exportData(includeSensitive = false)
    clearData()
}
```

### 3. SunCalculator (sun-calculator.js)

指定位置・時刻での太陽位置計算と影の解析。

```javascript
class SunCalculator {
    calculateSunPosition(latitude, longitude, dateTime)
    verifyShadowDirection(observedDirection, tolerance)
    generateSunCalcURL(latitude, longitude, dateTime)
    clearData()
}
```

### 4. MapController (map-controller.js)

インタラクティブ地図の制御と地理空間データの管理。

```javascript
class MapController {
    initializeMap(containerId, options)
    setLocation(latitude, longitude, options)
    showAccuracyCircle(latitude, longitude, accuracy)
    toggleDirectionMode(enabled)
    switchLayer(layerName)
    resetMap()
}
```

### 5. Utils (utils.js)

各種ユーティリティ関数群。

```javascript
const WhereShotUtils = {
    DateUtils: { formatDateTime, parseISOString, formatForInput },
    GeoUtils: { dmsToDecimal, formatCoordinates, calculateDistance },
    URLUtils: { generateNASAWorldviewURL, generateGSIMapURL },
    FileUtils: { formatFileSize, validateFile },
    UIUtils: { showError, showSuccess, showLoading },
    SecurityUtils: { escapeHtml, clearSensitiveData, calculateHash }
}
```

---

## 📡 API リファレンス

### ExifParser API

#### `extractExifData(file: File): Promise<ExifData>`

画像ファイルからExif情報を抽出します。

**パラメータ**:
- `file`: File - 解析対象の画像ファイル

**戻り値**: Promise<ExifData> - 抽出されたメタデータ

**例**:
```javascript
const exifData = await window.WhereShotExifParser.extractExifData(file);
console.log(exifData.gps.latitude, exifData.gps.longitude);
```

#### `exportData(includeSensitive: boolean): string`

Exif情報をJSON形式でエクスポートします。

**パラメータ**:
- `includeSensitive`: boolean - 機密情報を含めるかどうか

**戻り値**: string - JSON形式の文字列

### SunCalculator API

#### `calculateSunPosition(latitude: number, longitude: number, dateTime: Date): SunData`

指定位置・時刻での太陽位置を計算します。

**パラメータ**:
- `latitude`: number - 緯度（-90 ～ 90）
- `longitude`: number - 経度（-180 ～ 180）
- `dateTime`: Date - 計算対象の日時

**戻り値**: SunData - 太陽位置データ

**例**:
```javascript
const sunData = window.WhereShotSunCalculator.calculateSunPosition(
    35.6762, 139.6503, new Date('2024-06-15T12:00:00')
);
console.log(sunData.position.elevation, sunData.position.azimuth);
```

### MapController API

#### `setLocation(latitude: number, longitude: number, options?: LocationOptions): void`

地図上に位置マーカーを設定します。

**パラメータ**:
- `latitude`: number - 緯度
- `longitude`: number - 経度
- `options`: LocationOptions - オプション設定

**LocationOptions**:
```typescript
interface LocationOptions {
    type?: 'photo' | 'manual' | 'default';
    accuracy?: number;
    dateTime?: Date;
    centerMap?: boolean;
    zoom?: number;
}
```

#### `toggleDirectionMode(enabled: boolean): void`

撮影方向設定モードを切り替えます。

---

## 📊 データ構造

### ExifData

```typescript
interface ExifData {
    file: {
        name: string;
        size: number;
        type: string;
        lastModified: Date;
    };
    dateTime: {
        original: Date | null;
        digitized: Date | null;
        modified: Date | null;
        timezone: string | null;
    };
    gps: {
        latitude: number | null;
        longitude: number | null;
        altitude: number | null;
        accuracy: number | null;
    };
    camera: {
        make: string | null;
        model: string | null;
        lens: string | null;
        serial: string | null;
    };
    settings: {
        iso: number | null;
        aperture: number | null;
        shutter: number | null;
        focalLength: number | null;
    };
    security: {
        privacyRisk: 'low' | 'medium' | 'high';
        warnings: string[];
        recommendations: string[];
    };
}
```

### SunData

```typescript
interface SunData {
    position: {
        elevation: number;  // 太陽高度（度）
        azimuth: number;    // 太陽方位（度）
    };
    times: {
        sunrise: Date;
        sunset: Date;
        solarNoon: Date;
    };
    analysis: {
        phase: string;      // 時間帯
        lightQuality: string;
        shadowLength: number;
    };
    shadow: {
        direction: number;  // 影の方向（度）
        exists: boolean;
        description: string;
    };
}
```

---

## ⚡ イベントシステム

WhereShotは、カスタムイベントを使用してモジュール間の通信を行います。

### 発行されるイベント

#### `whereshot:locationChanged`

位置情報が変更されたときに発行されます。

```javascript
document.addEventListener('whereshot:locationChanged', (event) => {
    const { latitude, longitude } = event.detail;
    console.log('位置が変更されました:', latitude, longitude);
});
```

#### `whereshot:directionChanged`

撮影方向が設定されたときに発行されます。

```javascript
document.addEventListener('whereshot:directionChanged', (event) => {
    const { direction, distance } = event.detail;
    console.log('方向:', direction, '距離:', distance);
});
```

### カスタムイベントの発行

```javascript
// MapControllerクラス内での例
dispatchEvent(eventName, data) {
    const event = new CustomEvent(`whereshot:${eventName}`, {
        detail: data
    });
    document.dispatchEvent(event);
}
```

---

## 🔧 拡張方法

### 新しい解析機能の追加

1. **新しいクラスを作成**:
```javascript
class CustomAnalyzer {
    constructor() {
        this.data = null;
    }
    
    analyze(inputData) {
        // 解析ロジック
        return results;
    }
}
```

2. **メインアプリに統合**:
```javascript
// main.js内
this.customAnalyzer = new CustomAnalyzer();

// 解析結果をUIに反映
updateCustomDisplay(results) {
    // UI更新ロジック
}
```

### 外部API連携の追加

1. **URLUtilsに新しい関数を追加**:
```javascript
// utils.js内
URLUtils.generateNewServiceURL = (lat, lng, date) => {
    return `https://newservice.com/api?lat=${lat}&lng=${lng}&date=${date}`;
};
```

2. **UIにリンクを追加**:
```html
<a id="new-service-link" href="#" target="_blank" class="btn btn-external">
    新しいサービス
</a>
```

### 新しいファイル形式のサポート

1. **FileUtilsで対応形式を追加**:
```javascript
getFileType: (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    const newTypes = ['new-format'];
    
    if (newTypes.includes(extension)) return 'new-format';
    // ... 既存のロジック
}
```

2. **ExifParserで解析ロジックを追加**:
```javascript
extractExifData(file) {
    if (file.type === 'new-format') {
        return this.parseNewFormat(file);
    }
    // ... 既存のロジック
}
```

---

## 🔒 セキュリティ考慮事項

### プライバシー保護

1. **ローカル処理の徹底**:
   - すべてのファイル処理はブラウザ内で完結
   - 外部サーバーへの画像送信は一切なし

2. **機密データの適切な処理**:
   ```javascript
   // 機密データのクリア
   SecurityUtils.clearSensitiveData(sensitiveObject);
   ```

3. **メタデータのサニタイゼーション**:
   ```javascript
   // XSS防止
   const safeText = SecurityUtils.escapeHtml(userInput);
   ```

### 入力検証

1. **ファイル検証**:
   ```javascript
   const validation = FileUtils.validateFile(file);
   if (!validation.isValid) {
       throw new Error(validation.errors.join(', '));
   }
   ```

2. **座標の範囲チェック**:
   ```javascript
   if (latitude < -90 || latitude > 90) {
       throw new Error('無効な緯度');
   }
   ```

### エラーハンドリング

1. **try-catch の適切な使用**:
   ```javascript
   try {
       const result = await riskyOperation();
   } catch (error) {
       console.error('処理エラー:', error);
       UIUtils.showError(`エラー: ${error.message}`);
   }
   ```

2. **ユーザーフレンドリーなエラーメッセージ**:
   ```javascript
   UIUtils.showError('ファイルの読み込みに失敗しました。ファイル形式を確認してください。');
   ```

---

## 🧪 テスト

### 単体テスト例

```javascript
// ExifParserのテスト例
describe('ExifParser', () => {
    test('GPS座標の変換', () => {
        const parser = new ExifParser();
        const result = parser.convertGPSCoordinate([35, 40, 30], 'N');
        expect(result).toBeCloseTo(35.675, 3);
    });
});
```

### 統合テスト例

```javascript
// ファイル処理の統合テスト
describe('ファイル処理フロー', () => {
    test('GPS付き画像の完全な処理', async () => {
        const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
        const app = new WhereShotApp();
        
        await app.handleFileSelection(mockFile);
        
        expect(app.currentExifData).toBeDefined();
        expect(app.currentExifData.gps.latitude).toBeDefined();
    });
});
```

---

## 📈 パフォーマンス最適化

### 大きなファイルの処理

```javascript
// チャンク処理の例
async processLargeFile(file) {
    const chunkSize = 1024 * 1024; // 1MB
    const chunks = Math.ceil(file.size / chunkSize);
    
    for (let i = 0; i < chunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        
        await this.processChunk(chunk);
        
        // UI更新（進捗表示）
        this.updateProgress((i + 1) / chunks * 100);
    }
}
```

### メモリ管理

```javascript
// データクリアの例
clearAllData() {
    // 各モジュールのデータをクリア
    this.exifParser.clearData();
    this.sunCalculator.clearData();
    this.mapController.resetMap();
    
    // ガベージコレクションを促進
    this.currentFile = null;
    this.currentExifData = null;
}
```

---

## 🚀 デプロイメント

### GitHub Pages デプロイ

1. **設定ファイル** (`.github/workflows/deploy.yml`):
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
```

### カスタムドメイン

1. **CNAME ファイル**:
```
whereshot.yourdomain.com
```

2. **DNS設定**:
```
CNAME whereshot.yourdomain.com -> username.github.io
```

---

このAPI仕様書は、WhereShotの拡張や統合を行う開発者向けの技術資料です。詳細な実装例や最新の情報については、ソースコードとGitHubリポジトリを参照してください。