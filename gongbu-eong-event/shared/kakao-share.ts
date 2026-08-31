export type KakaoSdk = {
  isInitialized: () => boolean;
  init: (key: string) => void;
  Share?: {
    sendDefault: (options: Record<string, unknown>) => void;
    sendScrap?: (options: Record<string, unknown>) => void;
  };
};

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

const KAKAO_SDK_SRC = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";

export function loadKakaoSdk() {
  return new Promise<KakaoSdk>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Kakao SDK requires browser"));
      return;
    }

    if (window.Kakao) {
      resolve(window.Kakao);
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>("script[data-kakao-sdk]");
    if (existingScript) {
      existingScript.addEventListener("load", () => window.Kakao ? resolve(window.Kakao) : reject(new Error("Kakao SDK load failed")), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Kakao SDK load failed")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = KAKAO_SDK_SRC;
    script.async = true;
    script.dataset.kakaoSdk = "true";
    script.onload = () => window.Kakao ? resolve(window.Kakao) : reject(new Error("Kakao SDK load failed"));
    script.onerror = () => reject(new Error("Kakao SDK load failed"));
    document.head.appendChild(script);
  });
}
