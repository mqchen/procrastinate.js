var config = module.exports;

config["AutosaveScheduler tests"] = {
    rootPath: "../",
    environment: "node", // or "browser"
    sources: [
        "index.js"
    ],
    tests: [
        "test/*-test.js"
    ],
    'buster-istanbul': {
      outputDirectory: "coverage",
      format: "lcov",
      excludes: ["**/*.json"]
    },
    extensions: [
		require('buster-istanbul')
    ]
}