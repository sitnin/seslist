#!/usr/bin/env node

var pkgInfo = require("./package.json");
var fs = require("fs");
var path = require("path");
var util = require("util");
var csv = require("csv-parse");
var optimist = require('optimist');
var nodemailer = require('nodemailer');
var sesTransport = require('nodemailer-ses-transport');
var Promise = require("bluebird").Promise;

// Setup CLI

console.log("seslist "+pkgInfo.version);

var argv = optimist
    .usage("Usage:\n  seslist --workdir <directory> [--queuefile <filename>] [--keyfile <filename>] [--queuefile <filename>] [--template <filename>] [--rate <count>] [--run]")
    .boolean(["r"])
    .default({
        "queuefile": "queue.csv",
        "template": "template.html",
        "rate": 5,
        "keyfile": "./keys.json",
        "run": false
    })
    .demand(["workdir"])
    .alias({
        "workdir": "d",
        "queuefile": "q",
        "keyfile": "k",
        "template": "t",
        "run": "r",
        "rate": "z"
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

var aws_keys = null;
var keyFilename = path.resolve(argv.k);
if (!fs.existsSync(keyFilename)) {
    console.warn("WARNING: Keyfile", keyFilename, "not found");
    if (argv.run) {
        optimist.showHelp();
        console.error("Cannot run without keyfile", keyFilename);
        process.exit(-1);
    }
} else {
    console.log("Keyfile is", keyFilename);
    try {
        aws_keys = require(keyFilename);
    } catch (ex) {
        console.error("Cannot load keyfile:", ex.message);
        process.exit(-1);
    }
}

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

var workingFrom = !!listMeta.name ? util.format("%s <%s>", listMeta.name, listMeta.from) : listMeta.from;

// Main

var header = null;
var queue = [];
var data = [];
var log = {};

var pQueue = new Promise(function (resolve, reject) {
    var parser = new csv({
        delimiter: ",",
        columns: true,
        auto_parse: true,
        skip_empty_lines: true,
        trim: true
    }, function (err, data) {
        if (err) {
            reject(err);
        } else {
            resolve(data);
        }
    });
    fs.createReadStream(queueFilename).pipe(parser);
});

pQueue.then(function (data) {
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
        var transporter = nodemailer.createTransport(sesTransport({
            accessKeyId: aws_keys.accessKeyId,
            secretAccessKey: aws_keys.secretAccessKey,
            rateLimit: argv.rate
        }));

        var sendPromisesQueue = [];
        queue.forEach(function (item) {
            var p = new Promise(function (resolve, reject) {
                var message = {
                    from: workingFrom,
                    to: item.email,
                    subject: listMeta.subject,
                    html: item.message
                };

                if (!!listMeta.attachments) {
                    message.attachments = [];
                    listMeta.attachments.forEach(function (filename) {
                        message.attachments.push({
                            filename: filename,
                            path: path.join(workingDir, filename),
                            cid: filename
                        });
                    });
                }

                transporter.sendMail(message, function (err, info) {
                    if (err) {
                        resolve([item.email, err]);
                    } else {
                        resolve([item.email, info.messageId]);
                    }
                });
            });

            sendPromisesQueue.push(p);
        });

        console.log("Running queue...");
        Promise.all(sendPromisesQueue).then(function (data) {
            console.log("All emails are sent and this is the report");
            data.forEach(function (report) {
                if (report[1] instanceof Error) {
                    console.log("To:", report[0], "ERROR:", report[1].message);
                } else {
                    console.log("To:", report[0], "OK:", report[1]);
                }
            });
        });
    } else {
        console.log("Rendering queue...");
        queue.forEach(function (chunk) {
            fs.writeFileSync(path.join(workingDir, "out_"+chunk.email+".html"), chunk.message);
        });
    }
});
