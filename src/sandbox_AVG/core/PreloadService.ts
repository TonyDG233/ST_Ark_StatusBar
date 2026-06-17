/**
 * @file PreloadService.ts
 * @description 现代化的资源预加载服务，用于彻底替代原版陈旧的 preloadjs.min.js
 */

export class PreloadService {
    private assets: Set<string> = new Set();
    private loadedCount: number = 0;
    
    // 回调钩子
    public onFileLoad?: (url: string) => void;
    public onComplete?: () => void;

    /**
     * 将资源加入待加载队列
     * @param url 资源的绝对或相对路径
     */
    public loadFile(url: string) {
        if (!url) return;
        this.assets.add(url);
    }

    /**
     * 启动预加载队列
     */
    public async load() {
        if (this.assets.size === 0) {
            this.onComplete?.();
            return;
        }

        const promises = Array.from(this.assets).map(url => this.loadSingle(url));
        await Promise.all(promises);
        
        this.onComplete?.();
    }

    /**
     * 加载单个资源并返回 Promise
     */
    private loadSingle(url: string): Promise<void> {
        return new Promise((resolve) => {
            const ext = url.split('.').pop()?.toLowerCase() || '';
            
            if (['mp3', 'wav', 'ogg'].includes(ext)) {
                // 音频预加载
                const audio = new Audio();
                audio.oncanplaythrough = () => {
                    this.handleFileLoaded(url);
                    resolve();
                };
                audio.onerror = () => {
                    console.warn(`[PreloadService] Failed to load audio: ${url}`);
                    resolve(); // 忽略报错，防止阻断整个队列
                };
                audio.src = url;
                audio.load();
            } else {
                // 默认走图片预加载
                const img = new Image();
                img.onload = () => {
                    this.handleFileLoaded(url);
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`[PreloadService] Failed to load image: ${url}`);
                    resolve(); // 忽略报错，防止阻断整个队列
                };
                img.src = url;
            }
        });
    }

    private handleFileLoaded(url: string) {
        this.loadedCount++;
        this.onFileLoad?.(url);
    }
}

export const preloadQueue = new PreloadService();
