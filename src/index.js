const Torus = require("@toruslabs/torus.js");
// const { decrypt, encrypt, generatePrivate, getPublic } = require("eccrypto");
const { generatePrivate } = require("eccrypto");

const TorusServiceProvider = require("./service-provider");
const TorusStorageLayer = require("./storage-layer");
const { ecCurve } = require("./utils");
const { Point, BN } = require("./types.js");

class ThresholdBak {
  constructor({ enableLogging = false, postboxKey = "d573b6c7d8fe4ec7cbad052189d4a8415b44d8b87af024872f38db3c694d306d" } = {}) {
    this.enableLogging = enableLogging;
    this.torus = new Torus();
    this.postboxKey = new BN(postboxKey, "hex");
    this.serviceProvider = new TorusServiceProvider({ postboxKey: postboxKey });
    this.storageLayer = new TorusStorageLayer({ enableLogging: true, serviceProvider: this.serviceProvider });

    this.shares = {};
  }

  async initialize() {
    // first we see if a share has been kept for us
    let rawShareStore;
    try {
      rawShareStore = await this.storageLayer.getMetadata();
    } catch (err) {
      throw new Error(`getMetadata for rawShareStore in initialize errored: ${err}`);
    }
    let shareStore = new ShareStore(rawShareStore);

    // if there is no error we fetch metadata for the account

    let metadata;
    try {
      metadata = await this.storageLayer.getMetadata(shareStore.share.share);
    } catch (err) {
      throw new Error(`getMetadata in initialize errored: ${err}`);
    }
    this.metadata = new Metadata(metadata);
    this.addShare(shareStore);
    // now that we have metadata we set the requirements for reconstruction
    return;
  }

  reconstructKey() {
    if (!this.metadata) {
      throw Error("metadata not found, SDK likely not intialized");
    }
    let pubPoly = this.metadata.getLatestPublicPolynomial();
    let requiredThreshold = pubPoly.getThreshold();
    let pubPolyID = pubPoly.getPolynomialID();

    // check if threshold is met
    let polyShares = Object.keys(this.shares[pubPolyID]);
    let numberOfShares = polyShares.length;
    if (numberOfShares < requiredThreshold) {
      // check if we have any encrypted shares first
      throw Error(`not enough shares for reconstruction, require ${requiredThreshold} but got ${numberOfShares}`);
    }
    debugger;
    let shareArr = [];
    let shareIndexArr = [];
    for (let i = 0; i < requiredThreshold; i++) {
      shareArr.push(this.shares[pubPolyID][polyShares[i]].share.share);
      shareIndexArr.push(this.shares[pubPolyID][polyShares[i]].share.shareIndex);
    }
    let privKey = lagrangeInterpolation(shareArr, shareIndexArr);
    this.setKey(privKey);
    debugger;
    return this.privKey;
  }

  async initializeNewKey() {
    const tmpPriv = generatePrivate();
    this.setKey(new BN(tmpPriv));

    // create a random poly and respective shares
    const shareIndexes = [new BN(1), new BN(2)];
    for (let i = 1; i <= 2; i++) {
      let ran = generatePrivate();
      while (ran < 2) {
        ran = generatePrivate();
      }
      shareIndexes.push(new BN(ran));
    }
    const poly = generateRandomPolynomial(1, this.privKey);
    const shares = poly.generateShares(shareIndexes);

    // create metadata to be stored
    const metadata = new Metadata(this.privKey.getPubKeyPoint());
    metadata.addFromPolynomialAndShares(poly, shares);
    let serviceProviderShare = shares[shareIndexes[2].toString("hex")];

    // store torus share on metadata
    let shareStore = new ShareStore({ share: serviceProviderShare, polynomialID: poly.getPolynomialID() });
    try {
      await this.storageLayer.setMetadata(shareStore);
    } catch (err) {
      throw new Error(`setMetadata errored: ${err}`);
    }

    // store metadata on metadata respective to share
    try {
      await this.storageLayer.setMetadata(metadata, serviceProviderShare.share);
    } catch (err) {
      throw new Error(`setMetadata errored: ${err}`);
    }
    return {
      privKey: this.privKey,
      deviceShare: new ShareStore({ share: shares[shareIndexes[3].toString("hex")], polynomialID: poly.getPolynomialID() }),
    };
  }

  addShare(shareStore) {
    if (!(shareStore instanceof ShareStore)) {
      throw TypeError("can only add type ShareStore into shares");
    }
    if (!(shareStore.polynomialID in this.shares)) {
      this.shares[shareStore.polynomialID] = {};
    }
    this.shares[shareStore.polynomialID][shareStore.share.shareIndex.toString("hex")] = shareStore;
  }

  setKey(privKey) {
    this.privKey = privKey;
    this.ecKey = ecCurve.keyFromPrivate(this.privKey);
  }
}

// PRIMATIVES (TODO: MOVE TYPES AND THIS INTO DIFFERENT FOLDER)

function lagrangeInterpolation(shares, nodeIndex) {
  if (shares.length !== nodeIndex.length) {
    throw Error("shares not equal to nodeIndex length in lagrangeInterpolation");
  }
  let secret = new BN(0);
  for (let i = 0; i < shares.length; i += 1) {
    let upper = new BN(1);
    let lower = new BN(1);
    for (let j = 0; j < shares.length; j += 1) {
      if (i !== j) {
        upper = upper.mul(nodeIndex[j].neg());
        upper = upper.umod(ecCurve.curve.n);
        let temp = nodeIndex[i].sub(nodeIndex[j]);
        temp = temp.umod(ecCurve.curve.n);
        lower = lower.mul(temp).umod(ecCurve.curve.n);
      }
    }
    let delta = upper.mul(lower.invm(ecCurve.curve.n)).umod(ecCurve.curve.n);
    delta = delta.mul(shares[i]).umod(ecCurve.curve.n);
    secret = secret.add(delta);
  }
  return secret.umod(ecCurve.curve.n);
}

// function generateRandomShares(degree, numOfShares, secret) {
//   const poly = this.generateRandomPolynomial(degree, secret);
//   const shares = [];
//   for (let x = 1; x <= numOfShares; x += 1) {
//     shares.push({ index: x, share: this.polyEval(poly, x) });
//   }
//   return { shares, poly };
// }

// function generateShares(shareIndexes, poly) {
//   const shares = {};
//   for (let x = 0; x <= shareIndexes.length; x += 1) {
//     shares[shareIndexes[x].toString("hex")] = new Share(shareIndexes[x], poly.polyEval(shareIndexes[x]));
//   }
//   return { shares, poly };
// }

function generateRandomPolynomial(degree, secret) {
  let actualS = secret;
  if (!secret) {
    actualS = new BN(generatePrivate());
  }
  const poly = [actualS];
  for (let i = 0; i < degree; i += 1) {
    poly.push(new BN(generatePrivate()));
  }
  return new Polynomial(poly);
}

// function polyEval(polynomial, x) {
//   let xi = new BN(x);
//   let sum = new BN(0);
//   for (let i = 1; i < polynomial.length; i += 1) {
//     const tmp = xi.mul(polynomial[i]);
//     sum = sum.add(tmp);
//     sum = sum.umod(ecCurve.curve.n);
//     xi = xi.mul(new BN(x));
//     xi = xi.umod(ecCurve.curve.n);
//   }
//   return sum;
// }

/*
Metadata
{
  pubKey
  publicPolynomials[polyID]PublicPolynomial
  publicShares[polyID]PublicShares
}

Share
{
  share
  shareIndex
}

PublicPolynomial
{
  threshold
  publicShareDetails
  idCommitments (of 1...n = t)
}

PublicShareDetails 
{
  shareIndex
  shareCommitment
}

IdCommitments 
{
  shareIndex
  shareCommitment 
}

PolyID
hash(threshold | commitment of 1 | 2 | ... | n = t)
*/

class Metadata {
  constructor(input) {
    if (input instanceof Point) {
      this.pubKey = input;
      this.publicPolynomials = {};
      this.publicShares = {};
      this.polyIDList = [];
    } else if (typeof input == "object") {
      // assumed to be JSON.parsed object
      this.pubKey = new Point(input.pubKey.x, input.pubKey.y);
      this.publicPolynomials = {};
      this.publicShares = {};
      this.polyIDList = input.polyIDList;
      // for publicPolynomials
      for (let pubPolyID in input.publicPolynomials) {
        let pointCommitments = [];
        input.publicPolynomials[pubPolyID].polynomialCommitments.forEach((commitment) => {
          pointCommitments.push(new Point(commitment.x, commitment.y));
        });
        let publicPolynomial = new PublicPolynomial(pointCommitments);
        this.publicPolynomials[pubPolyID] = publicPolynomial;
      }
      // for publicShares
      for (let pubPolyID in input.publicShares) {
        let newPubShare = new PublicShare(
          input.publicShares[pubPolyID].shareIndex,
          new Point(input.publicShares[pubPolyID].shareCommitment.x, input.publicShares[pubPolyID].shareCommitment.y)
        );
        this.addPublicShare(pubPolyID, newPubShare);
      }
    } else {
      throw TypeError("not a valid constructor argument for Metadata");
    }
  }

  getLatestPublicPolynomial() {
    return this.publicPolynomials[this.polyIDList[this.polyIDList.length - 1]];
  }

  addPublicPolynomial(publicPolynomial) {
    let polyID = publicPolynomial.getPolynomialID();
    this.publicPolynomials[polyID] = publicPolynomial;
    this.polyIDList.push(polyID);
  }

  addPublicShare(polynomialID, publicShare) {
    this.publicShares[polynomialID] = publicShare;
  }

  addFromPolynomialAndShares(polynomial, shares) {
    let publicPolynomial = polynomial.getPublicPolynomial();
    this.addPublicPolynomial(publicPolynomial);
    if (Array.isArray(shares)) {
      for (let i = 0; i < shares.length; i++) {
        this.addPublicShare(publicPolynomial.getPolynomialID(), shares[i].getPublicShare());
      }
    } else {
      for (let k in shares) {
        this.addPublicShare(publicPolynomial.getPolynomialID(), shares[k].getPublicShare());
      }
    }
  }

  // toJSON() {}
}

class Share {
  constructor(shareIndex, share) {
    if (typeof share === "string") {
      this.share = new BN(share, "hex");
    } else if (share instanceof BN) {
      this.share = share;
    } else {
      throw new TypeError(`expected share to be either BN or hex string instead got :${share}`);
    }

    if (typeof shareIndex === "string") {
      this.shareIndex = new BN(shareIndex, "hex");
    } else if (shareIndex instanceof BN) {
      this.shareIndex = shareIndex;
    } else {
      throw new TypeError("expected shareIndex to be either BN or hex string");
    }
  }

  getPublicShare() {
    return new PublicShare(this.shareIndex, this.share.getPubKeyPoint());
  }
}

class ShareStore {
  constructor({ share, polynomialID }) {
    if (share instanceof Share && typeof polynomialID === "string") {
      this.share = share;
      this.polynomialID = polynomialID;
    } else if (typeof share === "object" && typeof polynomialID === "string") {
      this.share = new Share(share.shareIndex, share.share);
      this.polynomialID = polynomialID;
    } else {
      throw new TypeError("expected ShareStore inputs to be Share and string");
    }
  }
}

class PublicPolynomial {
  constructor(polynomialCommitments) {
    this.polynomialCommitments = polynomialCommitments;
  }
  getThreshold() {
    return this.polynomialCommitments.length;
  }
  getPolynomialID() {
    let idSeed = "";
    for (let i = 0; i < this.polynomialCommitments.length; i++) {
      let nextChunk = this.polynomialCommitments[i].x.toString("hex");
      if (i != 0) {
        nextChunk = `|${nextChunk}`;
      }
      idSeed = idSeed + nextChunk;
    }
    return idSeed;
  }
}

class Polynomial {
  constructor(polynomial) {
    this.polynomial = polynomial;
  }

  getThreshold() {
    return this.polynomial.length;
  }

  polyEval(x) {
    let xi = new BN(x);
    let sum = new BN(0);
    sum = sum.add(this.polynomial[0]);
    for (let i = 1; i < this.polynomial.length; i += 1) {
      const tmp = xi.mul(this.polynomial[i]);
      sum = sum.add(tmp);
      sum = sum.umod(ecCurve.curve.n);
      xi = xi.mul(new BN(x));
      xi = xi.umod(ecCurve.curve.n);
    }
    return sum;
  }

  generateShares(shareIndexes) {
    const shares = {};
    for (let x = 0; x < shareIndexes.length; x += 1) {
      shares[shareIndexes[x].toString("hex")] = new Share(shareIndexes[x], this.polyEval(shareIndexes[x]));
    }
    return shares;
  }

  getPublicPolynomial() {
    let polynomialCommitments = [];
    for (let i = 0; i < this.polynomial.length; i++) {
      polynomialCommitments.push(this.polynomial[i].getPubKeyPoint());
    }
    return new PublicPolynomial(polynomialCommitments);
  }

  // TODO: inefficinet optimize this
  getPolynomialID() {
    return this.getPublicPolynomial().getPolynomialID();
  }
}

class PublicShare {
  constructor(shareIndex, shareCommitment) {
    if (shareCommitment instanceof Point) {
      this.shareCommitment = shareCommitment;
    } else {
      throw new TypeError("expected shareCommitment to be Point");
    }

    if (typeof shareIndex === "string") {
      this.shareIndex = new BN(shareIndex, "hex");
    } else if (shareIndex instanceof BN) {
      this.shareIndex = shareIndex;
    } else {
      throw new TypeError("expected shareIndex to be either BN or hex string");
    }
  }
}

// DEPRECATED BECAUSE WE CAN'T EXTEND BN
// class Scalar extends BN {
//   constructor(...args) {
//     super(...args);
//     // Done because https://stackoverflow.com/questions/47429157/instanceof-not-working-properly
//     Object.setPrototypeOf(this, Scalar.prototype);
//   }
//   toPrivKeyEcc() {
//     return this.toBuffer("be", 32);
//   }

//   getPubKeyECC() {
//     return getPublic(this.toPrivKeyEcc());
//   }

//   getPubKeyPoint() {
//     return new Point(this.toPubKeyECC().getX(), this.toPubKeyECC().getY());
//   }
// }

module.exports = {
  ThresholdBak,
  Polynomial,
  Metadata,
  generateRandomPolynomial,
  lagrangeInterpolation,
};
