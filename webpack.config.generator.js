const path = require('path')

function configFor(target) {

    let filenameQualifier =  'umd' === target ? '' :  '.' + target;
    let libraryTarget = 'esm' === target ? 'var' : target

    return {
        mode: 'production',
        entry: ['babel-polyfill', './tmp/embedCss.js', './js/api.js'],
        target: 'web',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: `igv${filenameQualifier}.min.js`,
            library: 'igv',
            libraryTarget: libraryTarget
        },
        module: {
            rules: [
                {
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: [
                                ["@babel/preset-env", {
                                    "targets": {
                                        // The % refers to the global coverage of users from browserslist
                                        "browsers": ">0.1%"
                                    }
                                }]
                            ],
                            plugins: [["transform-remove-console", {"exclude": ["error", "warn"]}]]
                        },

                    },
                },
            ],
        },
        devtool: "source-map"
    }
}

module.exports = configFor;