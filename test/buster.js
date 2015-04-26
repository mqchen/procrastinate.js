var config = module.exports;

config["AutosaveScheduler tests"] = {
    rootPath: "../",
    environment: "node", // or "browser"
    sources: [
        "index.js"
    ],
    tests: [
        "test/*-test.js"
    ]
}