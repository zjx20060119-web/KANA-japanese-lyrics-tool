declare module "kuromoji/src/loader/BrowserDictionaryLoader" {
  type DictionaryLoadCallback = (
    error: Error | null,
    buffer: ArrayBuffer | null,
  ) => void;

  const BrowserDictionaryLoader: {
    prototype: {
      loadArrayBuffer(
        url: string,
        callback: DictionaryLoadCallback,
      ): void;
    };
  };

  export default BrowserDictionaryLoader;
}
