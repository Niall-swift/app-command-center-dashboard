export interface AvlDesktopBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AvlDesktopIspfyState {
  mounted: boolean;
  visible: boolean;
  loading: boolean;
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface AvlDesktopIspfyError {
  code: number;
  description: string;
  url: string;
}

export interface AvlDesktopBridge {
  isDesktop: true;
  platform: string;
  ispfy: {
    show: (bounds: AvlDesktopBounds) => Promise<boolean>;
    setBounds: (bounds: AvlDesktopBounds) => Promise<boolean>;
    hide: () => Promise<boolean>;
    reload: () => Promise<boolean>;
    goBack: () => Promise<boolean>;
    goForward: () => Promise<boolean>;
    goHome: () => Promise<boolean>;
    destroy: () => Promise<boolean>;
    getState: () => Promise<{ mounted: boolean; visible: boolean; url: string }>;
    onState: (callback: (state: AvlDesktopIspfyState) => void) => () => void;
    onError: (callback: (err: AvlDesktopIspfyError) => void) => () => void;
    onRequestSync?: (callback: () => void) => () => void;
  };
}

declare global {
  interface Window {
    avlDesktop?: AvlDesktopBridge;
  }
}
