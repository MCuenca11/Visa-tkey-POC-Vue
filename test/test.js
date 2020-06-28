const { deepStrictEqual, fail } = require("assert");
const { Point, BN } = require("../src/types.js");
const { generatePrivate } = require("eccrypto");

const { ThresholdBak, Polynomial, Metadata, generateRandomPolynomial } = require("../src/index");
const TorusServiceProvider = require("../src/service-provider");
const TorusStorageLayer = require("../src/storage-layer");
// const { privKeyBnToPubKeyECC } = require("../src/utils");

global.fetch = require("node-fetch");

describe("threshold bak", function () {
  it("#should return correct values when initializing a key", async function () {
    const tb = new ThresholdBak();
    const keyz = await tb.initializeNewKey();
    console.log("keyz", keyz);
    const resp2 = await tb.retrieveMetadata();
    console.log("resp2", JSON.parse(resp2));
  });
});

// describe("TorusServiceProvider", function () {
//   it("#should encrypt and decrypt correctly", async function () {
//     const privKey = "d573b6c7d8fe4ec7cbad052189d4a8415b44d8b87af024872f38db3c694d306d";
//     let tmp = new BN(123);
//     const message = Buffer.from(tmp.toString("hex", 15));
//     const privKeyBN = new BN(privKey, 16);
//     const tsp = new TorusServiceProvider({ postboxKey: privKey });
//     const encDeets = await tsp.encrypt(privKeyBN.getPubKeyECC(), message);
//     const result = await tsp.decrypt(encDeets);
//     deepStrictEqual(result, message, "encrypted and decrypted message should be equal");
//   });

//   it("#should encrypt and decrypt correctly messages > 15", async function () {
//     const privKey = "d573b6c7d8fe4ec7cbad052189d4a8415b44d8b87af024872f38db3c694d306d";
//     let tmp = new BN(123);
//     const message = Buffer.from(tmp.toString("hex", 16));
//     const privKeyBN = new BN(privKey, 16);
//     const tsp = new TorusServiceProvider({ postboxKey: privKey });
//     const encDeets = await tsp.encrypt(privKeyBN.getPubKeyECC(), message);
//     const result = await tsp.decrypt(encDeets);
//     deepStrictEqual(result, message, "encrypted and decrypted message should be equal");
//   });
// });

// describe("TorusStorageLayer", function () {
//   it("#should get or set correctly", async function () {
//     const privKey = "d573b6c7d8fe4ec7cbad052189d4a8415b44d8b87af024872f38db3c694d306d";
//     const tsp = new TorusServiceProvider({ postboxKey: privKey });
//     const storageLayer = new TorusStorageLayer({ enableLogging: true, serviceProvider: tsp });
//     const message = { test: Math.random().toString(36).substring(7) };
//     await storageLayer.setMetadata(message);
//     let resp = await storageLayer.getMetadata();
//     deepStrictEqual(resp, message, "set and get message should be equal");
//   });
// });

// describe("polynomial", function () {
//   it("#should polyEval indexes correctly", async function () {
//     let polyArr = [new BN(5), new BN(2)];
//     let poly = new Polynomial(polyArr);
//     result = poly.polyEval(new BN(1));
//     if (result.cmp(new BN(7)) != 0) {
//       fail("poly result should equal 7");
//     }
//   });
// });

// describe("Metadata", function () {
//   it("#should serialize and deserialize into JSON seamlessly", async function () {
//     const privKey = "d573b6c7d8fe4ec7cbad052189d4a8415b44d8b87af024872f38db3c694d306d";
//     const privKeyBN = new BN(privKey, 16);
//     // create a random poly and respective shares
//     const shareIndexes = [new BN(1), new BN(2)];
//     for (let i = 1; i <= 2; i++) {
//       let ran = generatePrivate();
//       while (ran < 2) {
//         ran = generatePrivate();
//       }
//       shareIndexes.push(new BN(ran));
//     }
//     const poly = generateRandomPolynomial(1, privKeyBN);
//     const shares = poly.generateShares(shareIndexes);
//     const metadata = new Metadata(privKeyBN.getPubKeyPoint());
//     metadata.addFromPolynomialAndShares(poly, shares);

//     let serializedMetadata = JSON.stringify(metadata);
//     const deserializedMetadata = new Metadata(JSON.parse(serializedMetadata));
//     deepStrictEqual(metadata, deserializedMetadata, "metadata and deserializedMetadata should be equal");
//   });
// });