import { DeviceShareDescription, IModule, ITKeyApi, ShareStore, StringifiedType } from "@tkey/common-types";
import { storage } from "webextension-polyfill";

export const CHROME_EXTENSION_STORAGE_MODULE_NAME = "chromeExtensionStorage";

export default class ChromeExtensionStorageModule implements IModule {
  moduleName: string;

  tbSDK: ITKeyApi;

  constructor() {
    this.moduleName = CHROME_EXTENSION_STORAGE_MODULE_NAME;
  }

  setModuleReferences(tbSDK: ITKeyApi): void {
    this.tbSDK = tbSDK;
    this.tbSDK._setDeviceStorage(this.storeDeviceShare.bind(this));
  }

  // eslint-disable-next-line
  async initialize(): Promise<void> {}

  async storeDeviceShare(deviceShareStore: ShareStore, customDeviceInfo?: StringifiedType): Promise<void> {
    // Wait for the helper function to store the share
    await this.storeShareOnChromeExtensionStorage(deviceShareStore);
    const shareDescription: DeviceShareDescription = {
      module: this.moduleName,
      userAgent: window.navigator.userAgent,
      dateAdded: Date.now(),
    };
    if (customDeviceInfo) {
      shareDescription.customDeviceInfo = JSON.stringify(customDeviceInfo);
    }
    await this.tbSDK.addShareDescription(deviceShareStore.share.shareIndex.toString("hex"), JSON.stringify(shareDescription), true);
  }

  async storeShareOnChromeExtensionStorage(share: ShareStore): Promise<void> {
    // Get the metadata containing the public key
    const metadata = this.tbSDK.getMetadata();
    // Use the metadata to get the public key and convert it to hex
    const key = metadata.pubKey.x.toString("hex"); // tbkey public
    // Store the share using the public key
    return storage.sync.set({ [key]: JSON.stringify(share) });
  }

  async getStoreFromChromeExtensionStorage(): Promise<ShareStore> {
    const metadata = this.tbSDK.getMetadata();
    const key = metadata.pubKey.x.toString("hex"); // tbkey public
    // Use the public key to retrieve the store
    const result = await storage.sync.get(key);
    // Parse the result to get the ID
    const verifierIdObj: ShareStore = JSON.parse(result[key]);
    await this.tbSDK.inputShareStoreSafe(verifierIdObj);
    return verifierIdObj;
  }

  async inputShareFromChromeExtensionStorage(): Promise<void> {
    const castedShareStore = await this.getStoreFromChromeExtensionStorage();
    const latestShareDetails = await this.tbSDK.catchupToLatestShare({ shareStore: castedShareStore, includeLocalMetadataTransitions: true });
    this.tbSDK.inputShareStore(latestShareDetails.latestShare);
  }
}
