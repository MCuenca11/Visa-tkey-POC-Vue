import { ecCurve, generateID, IPrivateKeyFormat, SECP256k1NStore } from "@tkey/common-types";
import BN from "bn.js";
import randombytes from "randombytes";

class SECP256K1Format implements IPrivateKeyFormat {
  privateKey: BN;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ecParams: any;

  type: string;

  constructor(privateKey: BN) {
    this.privateKey = privateKey;
    this.ecParams = ecCurve.curve;
    this.type = "secp256k1n";
  }

  validatePrivateKey(privateKey: BN): boolean {
    // use the eliptic curve to determine if its a valid private key if its not null
    return privateKey.cmp(this.ecParams.n) < 0 && !privateKey.isZero();
  }

  createPrivateKeyStore(privateKey?: BN): SECP256k1NStore {
    // Set the private key to parameter if it exists, else generate one?
    const finalPrivateKey = privateKey || new BN(randombytes(64));
    return {
      id: generateID(),
      privateKey: finalPrivateKey,
      type: this.type,
    };
  }
}
export default SECP256K1Format;
