# WhereShot（ウェアショット） 撮影時刻・場所解析ツール（Capture Time & Place Analyzer）

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Security Focused](https://img.shields.io/badge/Security-Focused-red.svg)](https://github.com/ipusiron)
[![Privacy First](https://img.shields.io/badge/Privacy-First-green.svg)](#プライバシー重視設計)
[![Demo](https://img.shields.io/badge/Demo-Live-blue.svg)](https://ipusiron.github.io/whereshot/)

**Day13 - 生成AIで作るセキュリティツール100**

**WhereShotは、画像・動画から「いつ・どこで撮られたか？」を推定・検証するためのOSINT支援ツールです。**

Exifメタデータの抽出、太陽位置計算、地図上での方角可視化、気象データや衛星画像との連携など、撮影情報を多角的に分析できます。
Exifが存在しない画像でも手動補完モードで推定可能です。
軽量かつプライバシー重視のローカル実行のツールです。

## 🌐 デモページ

👉 [https://ipusiron.github.io/whereshot/](https://ipusiron.github.io/whereshot/) 

---

## 📸 スクリーンショット

以下は実際の画面例です。

>![丸亀城の写真を読み込ませた例1](assets/screenshot1.png)
>
> *丸亀城の写真（`assets/2016-07-24 10.33.57.jpg`ファイル）を読み込ませた例1*

>![丸亀城の写真を読み込ませた例2](assets/screenshot2.png)
>
> *丸亀城の写真を読み込ませた例2*

---

## 🎯 主要機能

### 📊 メタデータ解析
- **Exif情報の完全抽出**: 撮影日時、GPS座標、カメラ設定、レンズ情報
- **対応フォーマット**: JPEG, PNG, TIFF, MP4（基本メタデータ）
- **詳細解析**: ISO感度、シャッター速度、絞り値から撮影環境を推定

### 🗺️ 地理空間分析
- **インタラクティブマップ**: Leaflet.jsベースの高精度地図表示
- **マルチレイヤー対応**: OpenStreetMap, 衛星画像, 地形図の切り替え
- **座標系変換**: WGS84, UTM, JGD2011など各種測地系に対応
- **精度評価**: GPS精度円の表示と信頼度評価

### 🌞 天体位置計算
- **太陽位置算出**: SunCalc.orgとの連携による高精度計算
- **影解析**: 太陽高度・方位角から影の長さ・方向を予測
- **時刻検証**: 影の状況から撮影時刻の妥当性を検証
- **季節判定**: 太陽軌道から撮影時期の推定

### 🧭 視覚的方位解析
- **撮影方向の可視化**: カメラの向きを地図上に矢印表示
- **視野角計算**: レンズ情報から画角を算出・表示
- **ランドマーク照合**: 周辺建物・地形との位置関係確認
- **方位精度評価**: 磁気偏角を考慮した真方位計算

### 🌐 外部データ連携
自動リンク生成による効率的な情報収集ができます。

- **[NASA Worldview](https://worldview.earthdata.nasa.gov/)**: 衛星画像・気象データ
- **[地理院地図](https://maps.gsi.go.jp/)**: 空中写真・地形図
- **[気象庁 過去の天気](https://www.data.jma.go.jp/obd/stats/etrn/)**: 気象庁 過去の天気: 緯度・経度と撮影日時に基づき、最寄りの観測所の当日データを自動リンク生成。天候・気温・風向などを確認できます。
- **[ひまわり気象衛星](https://www.jma.go.jp/bosai/forecast/)**: 雲画像データ

📍 WhereShotは`stations.json`ファイルを用いて全国の観測所情報を保持し、位置に応じた正確な気象データ参照を実現しています。

---

## 🛡️ プライバシー重視設計

### 完全ローカル処理 - セキュリティを最優先に設計
- ✅ すべての画像処理はブラウザー内で完結
- ✅ メタデータや画像ファイルの外部送信は一切なし
- ✅ ネットワーク通信は地図表示と外部リンクのみ
- ✅ 処理履歴の自動削除機能
- ✅ セキュアな一時ストレージ利用

### OSINT調査での匿名性確保
- 調査対象に痕跡を残さないので、安全な検証できる。
- VPN・Tor環境での利用にも対応。
- 機密性の高い案件でも安心して使用できる。

---

## 📁 プロジェクト構成

```
whereshot/
├── index.html              # メインアプリケーション
├── css/
│   └── style.css           # UIスタイルシート
├── js/
│   ├── utils.js            # 共通ユーティリティ
│   ├── exif-parser.js      # メタデータ抽出エンジン
│   ├── sun-calculator.js   # 天体位置計算
│   ├── map-controller.js   # 地図制御モジュール
│   └── main.js             # メイン制御スクリプト
├── assets/                 # 画像・スクリーンショット等
├── data/
│   └── station.json        # 全国の観測所情報
├── docs/                   # ドキュメント
│   ├── user-guide.md       # 使用方法ガイド
│   ├── api-reference.md    # API仕様書
│   └── examples/           # 使用例・サンプル
└── README.md               # 本ファイル
```

---

## 🚀 クイックスタート

### 🌐 オンラインで即座に利用

**最も簡単な方法**: [**デモページ**](https://ipusiron.github.io/whereshot/)にアクセスするだけで、すぐに利用開始できます！

### 💻 ローカル環境での利用
```bash
# リポジトリのクローン
git clone https://github.com/ipusiron/whereshot.git
cd whereshot

# ローカルサーバーで起動（推奨）
python -m http.server 8000
# または
npx serve .

# ブラウザーで http://localhost:8000 にアクセス
```

### 📱 基本的な使用方法
1. **[デモページ](https://ipusiron.github.io/whereshot/)にアクセス**または`index.html`を開く
2. **画像をドラッグ&ドロップ**してExif情報を自動抽出
3. **地図上で撮影地点を確認**（GPS情報がある場合は自動表示）
4. **太陽位置を計算**して影の方向と照合
5. **外部データリンク**で詳細な環境情報を確認

---

## 🎓 実践的活用シーン

### OSINT調査・情報検証
- **SNS投稿の真偽判定**: 投稿画像の撮影時刻・場所の整合性確認
- **フェイクニュース検出**: 画像の再利用・転載元の特定
- **証拠資料の検証**: 法執行機関での画像証拠の信頼性評価

### 災害・事件対応
- **現地状況の確認**: 災害現場の画像から正確な位置・時刻を特定
- **報道検証**: ニュース画像の撮影状況と報道内容の整合性確認
- **タイムライン構築**: 複数画像から事件・災害の時系列を再構成

### 教育・研修
- **OSINT技術の学習**: 実践的なオープンソースインテリジェンス訓練
- **情報リテラシー教育**: デジタル画像の真偽判定スキル向上
- **セキュリティ研修**: メタデータリスクの理解と対策

---

## ⚡ 高度な機能

仕様の詳細は、`docs` フォルダー内のMDファイルを参照してください。

### バッチ処理モード
- 複数画像の一括解析
- CSV形式でのメタデータエクスポート
- 時系列分析とパターン検出

### 比較分析機能
- 複数画像間の位置関係可視化
- 撮影時刻の整合性チェック
- 気象条件との照合

### カスタマイズ可能な出力
- 詳細レポートの自動生成
- 証拠保全用のハッシュ値計算
- 調査結果のセキュアな共有

---

## 📄 ライセンス

MIT License - [LICENSE](LICENSE)ファイルを参照

---

## ⚠️ 免責事項
本ツールはOSINT調査の支援を目的としており、プライバシー侵害や不正な監視活動での使用は意図されていません。適用される法律と倫理的ガイドラインを遵守してご利用ください。

---

## 🛠 このツールについて

本ツールは、「生成AIで作るセキュリティツール100」プロジェクトの一環として開発されました。 このプロジェクトでは、AIの支援を活用しながら、セキュリティに関連するさまざまなツールを100日間にわたり制作・公開していく取り組みを行っています。

プロジェクトの詳細や他のツールについては、以下のページをご覧ください。

🔗 [https://akademeia.info/?page_id=42163](https://akademeia.info/?page_id=42163)

