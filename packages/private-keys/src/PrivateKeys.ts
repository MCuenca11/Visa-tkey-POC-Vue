import { IModule, IPrivateKeyFormat, IPrivateKeyStore, ITKeyApi } from "@tkey/common-types";
import BN from "bn.js";

import PrivateKeysError from "./errors";

export const PRIVATE_KEY_MODULE_NAME = "privateKeyModule";

class PrivateKeyModule implements IModule {
  moduleName: string;

  tbSDK: ITKeyApi;

  privateKeyFormats: IPrivateKeyFormat[];

  constructor(formats: IPrivateKeyFormat[]) {
    this.moduleName = PRIVATE_KEY_MODULE_NAME;
    this.privateKeyFormats = formats;
  }

  setModuleReferences(tbSDK: ITKeyApi): void {
    this.tbSDK = tbSDK;
    this.tbSDK._addReconstructKeyMiddleware(this.moduleName, this.getAccounts.bind(this));
  }

  // eslint-disable-next-line
  async initialize(): Promise<void> {}

  async setPrivateKey(privateKeyType: string, privateKey?: BN): Promise<void> {
    // Find the correct format for the private key
    const format = this.privateKeyFormats.find((el) => el.type === privateKeyType);
    // If the privat ekey has the wrong format throw an error
    if (!format) {
      throw PrivateKeysError.notSupported();
    }
    // If you have a private key but it's not valid, throw an error
    if (privateKey && !format.validatePrivateKey(privateKey)) {
      throw PrivateKeysError.invalidPrivateKey(`${privateKey}`);
    }
    // Create a key store for the private key and store it
    // This helper returns the private key, and ID, and the type (secp256k1n)
    const privateKeyStore = format.createPrivateKeyStore(privateKey);
    return this.tbSDK._setTKeyStoreItem(this.moduleName, privateKeyStore);
  }

  async getPrivateKeys(): Promise<IPrivateKeyStore[]> {
    // Retrieve the private key from the key store
    return this.tbSDK.getTKeyStore(this.moduleName) as Promise<IPrivateKeyStore[]>;
  }

  async getAccounts(): Promise<BN[]> {
    try {
      // Get all private keys
      const privateKeys = await this.getPrivateKeys();
      return privateKeys.reduce((acc: BN[], x) => {
        acc.push(BN.isBN(x.privateKey) ? x.privateKey : new BN(x.privateKey, "hex"));
        return acc;
      }, []);
    } catch (err) {
      return [];
    }
  }
}

export default PrivateKeyModule;
