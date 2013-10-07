#!/usr/bin/env node
var argv = require('optimist').argv;
var stream = require("stream");
var util = require("util");
var fs = require("fs");
var csv = require("csv");
var path = require("path");

var aws = require('aws-sdk');
aws.config.loadFromPath(argv.k);
var ses = new aws.SES();

var queue = [];
var log = {};

var workingDir = path.resolve(argv.d);
console.log("Working dir is", workingDir)

var nunjucks = require('nunjucks');
var nun = new nunjucks.Environment(new nunjucks.FileSystemLoader(argv.d));

var queueFile = path.join(workingDir, "queue.csv");
var metaFile = path.join(workingDir, "meta.json");

console.log("Loading", metaFile);
var listMeta = require(metaFile);

var messageTpl = nun.getTemplate("template.html");

var header = null;
var data = [];

csv().from(queueFile, {
    columns: true
}).transform(function (row, index) {
    data.push(row);
})
.on('end', function () {
    data.forEach(function (recipient) {
        console.log("Adding", recipient.email, "to queue");
        recipient.message = messageTpl.render(recipient);
        queue.push(recipient);
    });

    if (argv.r) {
        console.log("Running queue");

        var totalQueueLength = queue.length;
        var currentQueuePosition = 0;
        var timeoutSize = !!argv.t ? 1000/argv.t : 250;
        var timer = setInterval(function () {
            var chunk = queue.pop();
            var now = (new Date()).getTime();

            if (!!chunk) {
                currentQueuePosition++;
                console.log("Message", currentQueuePosition, "of", totalQueueLength, "["+chunk.email+"]");

                ses.sendEmail({
                    Source: listMeta.from,
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
                console.log("END OF QUEUE");
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
