const CopyPlugin = require('copy-webpack-plugin')
const path = require('path')

module.exports = {
    entry: './src/index.ts',
    output: {
        path: path.resolve(__dirname, 'public'),
        filename: 'bundle.js'
    },
    resolve: {
        extensions: [
            '.ts',
            '.tsx',
            '.js'
        ]
    },
    performance: {
        maxEntrypointSize: 8_192_000,
        maxAssetSize: 8_192_000
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: [
                    'style-loader',
                    'css-loader'
                ]
            },
            {
                test: /\.ts?$/i,
                loader: 'ts-loader',
                options: {
                    allowTsInNodeModules: true
                }
            },
            {
                test: /\.(gif|png|jpeg|jpg|svg|woff2)$/i,
                use: [{
                    loader: 'url-loader',
                    options: {
                        limit: 500000, // Convert images < 500kb to base64 strings
                        name: 'images/[hash]-[name].[ext]'
                    }
                }],
            }
        ]
    },
    plugins: [
        new CopyPlugin({
            patterns: [{
                from: 'node_modules/@tonclient/lib-web/tonclient.wasm',
                to: './'
            }]
        })
    ],
    mode: 'production'
};