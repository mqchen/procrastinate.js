var config = module.exports;

config["AutosaveScheduler tests"] = {
    rootPath: "../",
    environment: "node", // or "browser"
    sources: [
        "src/**/*.js"
    ],
    tests: [
        "test/*-test.js"
    ]
}