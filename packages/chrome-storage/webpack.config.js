/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");
const generateWebpackConfig = require("../../webpack.config");

const pkg = require("./package.json");

const currentPath = path.resolve(".");

const config = generateWebpackConfig({ currentPath, pkg });

exports.baseConfig = config.baseConfig;

const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

// module.exports = {
// 	// Other rules...
// 	plugins: [
// 		new NodePolyfillPlugin()
// 	]
// };