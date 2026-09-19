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
│  WhereShotLogic │ ← 純粋ロジック
│  Utils          │ ← File・UIの補助
└─────────────────┘
```

### 依存関係

- **Leaflet.js**: 地図表示・制御
- **ExifReader 4.12.0**：自己ホストのExif読み取り
- **SunCalc 1.9.0**：自己ホストの太陽位置計算
- **ブラウザーAPI**：File、Web Crypto、Clipboard、Object URL

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

画像からメタデータを抽出します。読み取れない内容は全項目nullの結果とreadFailedで示します。

```javascript
class ExifParser {
    async extractExifData(file)
    getExtractedData()
    clearData()
}
```

### 3. SunCalculator (sun-calculator.js)

指定位置・時刻での太陽位置計算と影の解析。

```javascript
class SunCalculator {
    calculateSunPosition(latitude, longitude, utcMs)
    getCurrentSunData()
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
    toggleManualLocationMode(enabled)
    toggleDirectionMode(enabled)
    setExifDirection(directionDeg)
    setDirection(latitude, longitude)
    switchLayer(layerName)
    resetMap()
}
```

### 5. Utils (utils.js)

各種ユーティリティ関数群。

```javascript
const WhereShotUtils = {
    FileUtils: { formatFileSize, validateFile },
    UIUtils: { showError, showSuccess, showLoading },
    SecurityUtils: { clearSensitiveData, calculateHash }
}
```

---

## 📡 API リファレンス

### ExifParser API

#### `extractExifData(file: File): Promise<ExifData>`

画像ファイルからExif情報を抽出します。

**パラメーター**:
- `file`: File - 解析対象の画像ファイル

**戻り値**: Promise<ExifData> - 抽出されたメタデータ

**例**:
```javascript
const exifData = await window.WhereShotExifParser.extractExifData(file);
// exifData.latitudeとexifData.longitudeを使用する。外部入力はtextContentで表示する。
```

読み取りはFile.arrayBuffer()、ExifReader.load(buffer, {expanded:true})、normalizeTagsの順です。
例外を捕捉して結果を返し、画面はfinallyで読み込み中の状態を解除します。

### SunCalculator API

#### `calculateSunPosition(latitude: number, longitude: number, utcMs: number): SunData`

指定位置・時刻での太陽位置を計算します。

**パラメーター**:
- `latitude`: number - 緯度（-90 ～ 90）
- `longitude`: number - 経度（-180 ～ 180）
- `utcMs`：number - UTCの瞬間を表すミリ秒

**戻り値**: SunData - 太陽位置データ

**例**:
```javascript
const sunData = window.WhereShotSunCalculator.calculateSunPosition(
    34.28611372222222, 133.79983519444446, 1469324037000
);
// sunData.altitudeDegは64.0度、azimuthDegは117.3度（小数1桁）
```

### MapController API

解析結果パネルを可視化してからinitializeMapを1回呼びます。
位置指定・方向指定モードは排他です。方向の本線と2本の先端をdirectionLayerで管理します。
地図の種類はselectだけで変更し、既存のタイルレイヤーを外してから選択したものを載せます。

### WhereShotLogic URL API

```javascript
const result = WhereShotLogic.jmaHourlyUrl(
    34.28611372222222, 133.79983519444446, 1469324037000, WhereShotStations
);
// result: {url, station: '高松', distanceKm: 23}
```

観測所は200km以内だけを採用し、日付はUTCの瞬間を日本時間に変換します。
NASAとSunCalc.orgのリンクは撮影地の壁時計を使います。
無効な座標ではnullを返します。経度・緯度の0は有効です。

#### `setLocation(latitude: number, longitude: number, options?: LocationOptions): void`

地図上に位置マーカーを設定します。

**パラメーター**:
- `latitude`: number - 緯度
- `longitude`: number - 経度
- `options`: LocationOptions - オプション設定

**LocationOptions**:
```typescript
interface LocationOptions {
    type?: 'photo' | 'manual' | 'default';
    accuracy?: number;
    centerMap?: boolean;
    zoom?: number;
}
```

#### `toggleDirectionMode(enabled: boolean): void`

撮影方向設定モードを切り替えます。

---

## 📊 データ構造

### ExifData

normalizeTagsは次の20項目を返します。ない項目はnullです。

```typescript
interface ExifData {
    dateTimeOriginal: string | null;
    dateTimeDigitized: string | null;
    dateTime: string | null;
    offsetTimeOriginal: string | null;
    offsetTime: string | null;
    gpsUtcMs: number | null;
    latitude: number | null;
    longitude: number | null;
    altitude: number | null;
    imgDirection: number | null;
    imgDirectionRef: 'T' | 'M' | null;
    hPositioningError: number | null;
    make: string | null;
    model: string | null;
    software: string | null;
    lensModel: string | null;
    exposureTime: number | null;
    fNumber: number | null;
    iso: number | null;
    focalLength: number | null;
}
```

### SunData

```typescript
interface SunData {
    altitudeDeg: number;
    azimuthDeg: number;
    phase: string;
    shadowDirectionDeg: number | null;
    shadowRatio: number | null;
}
```

### WhereShotLogicの公開関数

| 関数 | 戻り値・用途 |
|---|---|
| isValidWall(w) | 有効な年月日時分秒かどうか |
| parseExifDateTime(str), inputValueToWall(v), utcMsToWall(ms, offsetMin) | 壁時計またはnull |
| parseOffset(str) | -720〜840のオフセット分またはnull |
| formatOffset(n), formatWall(w, offsetMin), formatUtc(ms), wallToInputValue(w) | 書式付き文字列 |
| wallToUtcMs(w, offsetMin), gpsDateTimeToUtcMs(date, time) | UTCミリ秒またはnull |
| inferOffsetFromGps(w, ms) | {offsetMin, residualSec}またはnull |
| decideOffset(input) | {offsetMin, source, residualSec, conflict} |
| longitudeOffsetHint(lng) | 表示用の目安（自動適用しない） |
| normalizeTags(tags) | ExifData |
| formatExposure(time), formatCamera(make, model) | 表示用文字列 |
| extractDatesFromFilename(name, nowMs) | {pattern, matched, hasTime, reliability, wallまたはutcMs}の配列 |
| estimateDateTime(input) | {sources, conflicts, notes, agreement, best, estimatedUtcMs, confidence} |
| sunReport(SunCalc, lat, lng, utcMs) | SunDataまたはnull |
| sunPhaseKey(alt, az), toCardinalJa(degrees) | 時間帯キー、日本語16方位 |
| isValidLatLng(lat, lng), decimalToDms(value, isLat) | 座標の検証、度分秒表記 |
| distanceM(lat1, lng1, lat2, lng2), bearing(lat1, lng1, lat2, lng2) | メートル、北基準の方位角 |
| destinationPoint(lat, lng, bearing, distance) | {lat, lng} |
| nearestStation(lat, lng, stations, maxKm=200) | {station, distanceKm}またはnull |
| nasaWorldviewUrl(lat, lng, wall), sunCalcOrgUrl(lat, lng, wall) | 現地の日付・時刻を使うURL |
| gsiMapUrl(lat, lng, photo), streetViewUrl(lat, lng, heading) | URLまたはnull |
| jmaHourlyUrl(lat, lng, utcMs, stations) | {url, station, distanceKm}またはnull |
| buildReport(d), formatInt(n) | レポート、3桁区切り文字列 |

公開定数はOFFSET_CHOICES（38件）、FILENAME_PATTERNS（11種）、SOURCE_LABEL、PHASE_JA、JMA_TOPです。
ロジックはDOM、現在時刻、crypto、ローカルタイムゾーンに依存しません。
ブラウザーの仮オフセットだけはDOM側で撮影日時の夏時間を含めて求めます。

### SHA-256とレポート

main.jsのcalculateFileHashはファイルのArrayBufferをWeb CryptoのSHA-256へ渡します。
buildReportにはfileName、fileSize、fileType、sha256、wall、offsetMin、offsetSource、residualSec、
dateSourceLabel、confidence、latitude、longitude、locationSource、directionDeg、sun、station、
stationKm、generatedAtUtcMsを渡します。
作成時刻はDOM側がDate.now()で用意します。結果はtextContentでpreに入れ、Clipboard APIが使えるときだけコピーします。

## ⚡ イベントシステム

WhereShotは、カスタムイベントを使用してモジュール間の通信を行います。

### 発行されるイベント

#### `whereshot:locationChanged`

位置情報が変更されたときに発行されます。

```javascript
document.addEventListener('whereshot:locationChanged', (event) => {
    const { latitude, longitude } = event.detail;
    // latitude・longitudeを表示に反映する。コンソールには記録しない。
});
```

#### `whereshot:directionChanged`

撮影方向が設定されたときに発行されます。

```javascript
document.addEventListener('whereshot:directionChanged', (event) => {
    const { direction, distance } = event.detail;
    // directionがnullなら方向指定が解除された状態。
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

### 外部リンクの保守

URL生成はWhereShotLogicの純粋関数へ置き、画面の解析日時とオフセットを使います。
外部APIは追加しません。画像やExifを送信する処理を追加しないでください。

### 対応ファイル形式の保守

FileUtils.validateFileのallowedTypes、index.htmlのaccept、READMEの対応形式の表をそろえます。
ExifReader 4.12.0が読み取れる形式に限り、読み取り失敗時もnormalizeTags({})と同じ形を返します。
ブラウザーがプレビューできない形式でもメタデータ解析を継続します。
形式の追加には、実ファイルの読み取り・表示・エラー復旧の検証が必要です。

---

## 🔒 セキュリティ考慮事項

### プライバシー保護

1. **ローカル処理の徹底**:
   - すべてのファイル処理はブラウザー内で完結
   - 外部サーバーへの画像送信は一切なし

2. **機密データの適切な処理**:
   ```javascript
   // 機密データのクリア
   window.WhereShotUtils.SecurityUtils.clearSensitiveData(sensitiveObject);
   ```

3. **メタデータのサニタイゼーション**:
   ```javascript
   // 外部入力をHTMLとして解釈しない。
   element.textContent = userInput;
   ```

### 入力検証

1. **ファイル検証**:
   ```javascript
   const validation = window.WhereShotUtils.FileUtils.validateFile(file);
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
       console.error('処理に失敗しました');
       window.WhereShotUtils.UIUtils.showError('処理に失敗しました。内容を確認してください');
   }
   ```

2. **ユーザーフレンドリーなエラーメッセージ**:
   ```javascript
   window.WhereShotUtils.UIUtils.showError('ファイルの読み込みに失敗しました。ファイル形式を確認してください。');
   ```

---

## 🧪 テスト

### 自動テスト

Node 22以上でnpm testを実行します。node:testとnode:assert/strictだけを使い、依存追加とネットワークアクセスは不要です。
test/には実画像Exif、時刻、太陽、URL、レポート、観測所、vendorハッシュ、README、HTML、配色、整形の検証があります。
timezone.test.jsは4つのTZで同じ子プロセスを実行し、計算結果が一致することと、実際にTZが切り替わっていることを確認します。

### ブラウザーでの確認

HTTPとfile://の両方で、画像選択、壊れた画像からの復旧、XSS文字列のファイル名、
UTCオフセット、地図操作、コピー、プレビュー、ダイアログを確認します。

## 📈 パフォーマンス最適化

### 大きなファイルの処理

受け付ける上限は100MBです。ファイルはArrayBufferとして読み込みます。
チャンク解析は実装していません。メタデータの読み取り失敗もfinallyで読み込み中の状態を解除します。

### メモリ管理

次のファイルを処理する前にclearAnalysisDataで参照と表示を消します。
プレビューのObject URLは非表示・ファイル変更・リセット時にrevokeObjectURLで解放します。
これはメモリの安全な消去やブラウザーの履歴消去を保証するものではありません。


---

## 🚀 デプロイメント

### GitHub Pagesデプロイ

mainブランチのルートをlegacyビルドで配信します。.nojekyllによりvendor/も静的ファイルとして配信します。
.github/workflows/test.ymlはpushとpull_requestでNode 22のnpm testを実行します。
公開後はvendor/の取得可否と、配信ファイルのSHA-256がGitのバイト列と一致することを確認します。

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

このAPI仕様書は、WhereShotの拡張や統合を行う開発者向けの技術資料です。詳細な実装例や最新の情報については、ソースコードとGitHubリポジトリーを参照してください。
