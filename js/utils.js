/**
 * WhereShot - 共通ユーティリティ関数
 * Created by IPUSIRON - セキュリティ重視のOSINTツール
 */

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

    const imageTypes = ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'webp', 'heic', 'heif'];
    return imageTypes.includes(extension) ? 'image' : 'unknown';
  },

  /**
   * ファイルの安全性チェック
   * @param {File} file - チェックするファイル
   * @returns {object} isValidと、メッセージキーの配列
   */
  validateFile: (file) => {
    const maxSize = 100 * 1024 * 1024; // 100MB
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/tiff', 'image/webp', 'image/heic', 'image/heif',
    ];

    const result = {
      isValid: true,
      errors: [],
    };

    if (file.size > maxSize) {
      result.isValid = false;
      result.errors.push('error.fileTooLarge');
    }

    if (!allowedTypes.includes(file.type)) {
      result.isValid = false;
      result.errors.push('error.unsupportedType');
    }

    return result;
  },
};

// ========== UIユーティリティ ==========
const UIUtils = {
  /**
   * 要素を表示/非表示切り替え
   * @param {string|HTMLElement} element - 要素のIDまたは要素自体
   * @param {boolean} show - 表示するかどうか
   */
  toggleElement: (element, show) => {
    const el =
      typeof element === 'string' ? document.getElementById(element) : element;
    if (el) {
      el.hidden = !show;
    }
  },

  /**
   * トーストを表示する。訳した文字列ではなくキーを覚えるので、
   * 表示中に言語を切り替えても訳し直される。
   * @param {string} variant - 'error' または 'success'
   * @param {string} key - メッセージキー
   * @param {object} params - 差し込み値
   * @param {number} duration - 表示時間（ミリ秒）
   */
  showToast: (variant, key, params = {}, duration = 3000) => {
    const toast = document.createElement('div');
    toast.className = 'toast toast--' + variant;
    toast.dataset.toastKey = key;
    toast.dataset.toastParams = JSON.stringify(params);
    toast.textContent = window.I18n.t(key, params);

    document.getElementById('toast-region').appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, duration);
  },

  /**
   * エラーメッセージを表示
   * @param {string} key - メッセージキー
   * @param {object} params - 差し込み値
   */
  showError: (key, params = {}) => UIUtils.showToast('error', key, params, 5000),

  /**
   * 成功メッセージを表示
   * @param {string} key - メッセージキー
   * @param {object} params - 差し込み値
   */
  showSuccess: (key, params = {}) => UIUtils.showToast('success', key, params, 3000),

  /**
   * 表示中のトーストを現在の言語で描き直す
   */
  retranslateToasts: () => {
    for (const toast of document.querySelectorAll('#toast-region [data-toast-key]')) {
      let params = {};
      try {
        params = JSON.parse(toast.dataset.toastParams || '{}');
      } catch {
        params = {};
      }
      toast.textContent = window.I18n.t(toast.dataset.toastKey, params);
    }
  },

  /**
   * ローディング表示
   * @param {string|HTMLElement} element - 対象要素
   * @param {boolean} show - 表示するかどうか
   */
  showLoading: (element, show) => {
    const el =
      typeof element === 'string' ? document.getElementById(element) : element;
    if (!el) return;

    el.classList.toggle('is-loading', show);
    el.setAttribute('aria-busy', String(show));
  },
};

// ========== セキュリティユーティリティ ==========
const SecurityUtils = {
  /**
   * 機密データの参照をクリア（メモリの安全な消去を保証しない）
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
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  },
};

// ========== エクスポート ==========
window.WhereShotUtils = {
  FileUtils,
  UIUtils,
  SecurityUtils,
};
