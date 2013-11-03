#!/usr/bin/env node
var pkgInfo = require("./package.json");
var fs = require("fs");
var path = require("path");
var util = require("util");
var csv = require("csv");
var optimist = require('optimist');
var mimelib = require('mimelib');

// Setup CLI

console.log("seslist "+pkgInfo.version);

var argv = optimist
    .usage("Usage:\n  seslist --workdir <directory> --queuefile <filename> --keyfile <filename> [--queuefile <filename>] [--template <filename>] [--timeout <ms>] [--run]")
    .boolean(["r"])
    .default({
        "queuefile": "queue.csv",
        "template": "template.html",
        "timeout": 1000,
        "run": false
    })
    .demand(["workdir", "keyfile"])
    .alias({
        "workdir": "d",
        "queuefile": "q",
        "keyfile": "k",
        "template": "t",
        "run": "r",
        "timeout": "t"
    })
    .argv;

// Check if workdir set correctly

if ("boolean" === typeof argv.workdir) {
    optimist.showHelp();
    process.exit(-1);
}

var workingDir = path.resolve(argv.workdir);
if (!fs.existsSync(workingDir)) {
    optimist.showHelp();
    console.error("Cannot find working directory", workingDir);
    process.exit(-1);
}

console.log("Working directory is", workingDir);

// Check if keyfile set correctly

if ("boolean" === typeof argv.keyfile) {
    optimist.showHelp();
    process.exit(-1);
}

var keyFilename = path.resolve(argv.k);
if (!fs.existsSync(keyFilename)) {
    optimist.showHelp();
    console.error("Cannot find keyfile", keyFilename);
    process.exit(-1);
}

console.log("Keyfile is", keyFilename);

// Check if queuefile set correctly

if ("boolean" === typeof argv.queuefile) {
    optimist.showHelp();
    process.exit(-1);
}

var queueFilename = path.resolve(path.join(workingDir, argv.queuefile));
if (!fs.existsSync(queueFilename)) {
    optimist.showHelp();
    console.error("Cannot find queue file", queueFilename);
    process.exit(-1);
}

console.log("Queue file is", queueFilename);

// Check if template filename set correctly

if ("boolean" === typeof argv.template) {
    optimist.showHelp();
    process.exit(-1);
}

var templateFilename = path.resolve(path.join(workingDir, argv.template));
if (!fs.existsSync(templateFilename)) {
    optimist.showHelp();
    console.error("Cannot find template file", templateFilename);
    process.exit(-1);
}

console.log("Template file is", templateFilename);

// Check if meta.json exists

var metaFilename = path.resolve(path.join(workingDir, "meta.json"));
if (!fs.existsSync(metaFilename)) {
    optimist.showHelp();
    console.error("Cannot find meta file", metaFilename);
    process.exit(-1);
}

console.log("Meta file is", metaFilename);

// Setup timeout

var timeoutSize = argv.timeout;
console.log("Timeout set to", argv.timeout, "ms");

// Init AWS-SDK

var aws = require('aws-sdk');
aws.config.loadFromPath(keyFilename);
var ses = new aws.SES();

// Init nunjucks

var nunjucks = require('nunjucks');
var nun = new nunjucks.Environment(new nunjucks.FileSystemLoader(workingDir));
var messageTpl = nun.getTemplate(argv.template);

console.log("Loading", metaFilename);

// Load and handle list metafile

try {
    var listMeta = require(metaFilename);
} catch (ex) {
    console.error("Cannot load meta.json:", ex.message);
    process.exit(-1);
}

if (!listMeta.hasOwnProperty("from") || !listMeta.hasOwnProperty("subject")) {
    console.error('Meta file should contain "from" and "subject" keys.');
    process.exit(1);
}

// Setup "from" field

var workingFrom = !!listMeta.name ? util.format("%s <%s>", mimelib.encodeMimeWord(listMeta.name), listMeta.from) : listMeta.from;

// Main

var header = null;
var queue = [];
var data = [];
var log = {};

csv().from(queueFilename, {
    columns: true
}).transform(function (row, index) {
    data.push(row);
})
.on('end', function () {
    data.forEach(function (recipient) {
        console.log("Adding", recipient.email, "to queue");
        var tplDict = {};
        Object.keys(listMeta).forEach(function (key) {
            tplDict[key] = listMeta[key];
        });
        Object.keys(recipient).forEach(function (key) {
            tplDict[key] = recipient[key];
        });
        recipient.message = messageTpl.render(tplDict);
        queue.push(recipient);
    });

    if (argv.run) {
        console.log("Running queue");

        var totalQueueLength = queue.length;
        var currentQueuePosition = 0;
        var timer = setInterval(function () {
            var chunk = queue.pop();
            var now = (new Date()).getTime();

            if (!!chunk) {
                currentQueuePosition++;
                console.log("Message", currentQueuePosition, "of", totalQueueLength, "["+chunk.email+"]");

                ses.sendEmail({
                    Source: workingFrom,
                    Destination: {
                        ToAddresses: [chunk.email]
                    },
                    Message: {
                        Subject: {
                            Data: listMeta.subject,
                            Charset: "utf-8"
                        },
                        Body: {
                            Html: {
                                Data: chunk.message,
                                Charset: "utf-8"
                            }
                        }
                    }
                }, function (err, data) {
                    log[chunk.email] = {
                        error: err,
                        data: data
                    }
                    if (err) {
                        console.log("ERROR", chunk.email, err.message, data);
                    } else {
                        console.log("OK", chunk.email, data);
                    }
                });
            } else {
                console.log("QUEUE DRAINED");
                clearInterval(timer);
            }
        }, timeoutSize);
    } else {
        console.log("Rendering queue");
        queue.forEach(function (chunk) {
            fs.writeFileSync(path.join(workingDir, "out_"+chunk.email+".html"), chunk.message);
        });
        console.log("END OF QUEUE");
    }

});
