export const ASSETS = {
  LOGO_URL: 'https://storage.moegirl.org.cn/moegirl/commons/9/9e/%E6%98%8E%E6%97%A5%E6%96%B9%E8%88%9F_LOGO.png',
};

// --- LOGO 模块级一次性缓存 (只缓存加载结果，不改变任何尺寸/样式表达) ---
let cachedLogoUrl: string | null = null;
let logoFetchPromise: Promise<string> | null = null;

/**
 * 获取 LOGO 地址：首次调用时尝试拉取远程图片并缓存为 blob URL，
 * 之后的所有页面挂载不再发起网络请求；失败时静默回退原始 URL（与未缓存时表现一致）。
 */
export function getLogoUrl(): Promise<string> {
  if (cachedLogoUrl !== null) return Promise.resolve(cachedLogoUrl);
  if (logoFetchPromise !== null) return logoFetchPromise;

  logoFetchPromise = fetch(ASSETS.LOGO_URL)
    .then(res => {
      if (!res.ok) throw new Error(`Logo fetch failed: ${res.status}`);
      return res.blob();
    })
    .then(blob => {
      cachedLogoUrl = URL.createObjectURL(blob);
      return cachedLogoUrl;
    })
    .catch(err => {
      console.warn('[ARK_STATUSBAR] Logo cache failed, fallback to original URL:', err);
      return ASSETS.LOGO_URL;
    });

  return logoFetchPromise;
}