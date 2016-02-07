# Amazon SES mail list sender

Sometimes it is necessary to send mail list via the tough channel like Amazon Simple Email Services. Just to be sure that emails will arrive to the user's mailboxes and arrive perfectly in time. No matter how much does it cost.

This software tends to realize this need.

## Installation

    [sudo] npm install -g seslist

## Preparation and usage

1. Make sure you have copied `sample_keys.json` to anothe file and filled it with correct credentials

2. Create a working folder

    mkdir workingFld
    cd workingFld

3. Create `meta.json` and edit it according to this instruction (see below)

4. Create `queue.csv` and fill it with your mailing list queue settings (see below)

5. (optional) Run seslist without `-r` option to generate email messages and save them to files (prefixed with `out_`) rather than sending

6. Run with `-r` option to perform mail list sending operation

### meta.json

JSON-file which should contain two keys: `from` which is sender's email address and `subject` which is a mail message subject.

	{
		"from": "greg@sitnin.com",
		"name": "Gregory Sitnin"
		"subject": "This is a mailing list"
	}

This file also may contain any number of additional keys which will be passed to the template renderer.

Additionally you can add ``attachments`` key to the meta dictionary which consists of filenames (without path) which will be read from working folder and attached to the email message. Message can address this files (i.e.: as an image sources) by CID which is equals to the filename.

	{
		...
		"attachments": ["somepic.jpg", "file.pdf"]
	}

All other keys from this JSON will be passed to the email template while rendering particular message.


### queue.csv

Should contain CSV-data with field names on a first row. `email` field is required, all other is optional. Every key from row will be passed to the template engine while generating email messages.

	"name","surname","email"
	"Success","Target","success@simulator.amazonses.com"
	"Bounce",,"bounce@simulator.amazonses.com"
	,"OutOfOffice","ooto@simulator.amazonses.com"
	"Complaint","List","complaint@simulator.amazonses.com"
	,,"suppressionlist@simulator.amazonses.com"

## Usage

    seslist --workdir <directory> --queuefile <filename> [--keyfile <filename>] [--queuefile <filename>] [--template <filename>] [--timeout <ms>] [--run]

### Options:

* `--workdir`, `-d` [required] working directory path (should contain meta.json, template and queue files)
* `--keyfile`, `-k` [required for --run mode] transport setup in json format (see examples below)
* `--queuefile`, `-q` [default: "queue.csv"] CSV-file whith the maillist variables (should contain email field)
* `--template`, `-t` [default: "template.html"] nunjucks/jinja2 template file to render emails
* `--rate`, `-z` [default: 5] Amazon SES rate limit (emails per second)
* `--run`, `-r` [default: false] if true, emails will be send otherwise they will be rendered to the working directory

### Keys file for SES

    {
        "accessKeyId": "Your-App-Key-Id",
        "secretAccessKey": "Your-App-Secret-Access-Key"
    }

### Keys file for Mandrill

    {
        "auth": {
            "apiKey": "Your-Mandrill-Api-Key"
        }
    }

## Changelog

### Version 1.1.0

  * Heavily updated dependencies
  * Added Mandrill support (only direct sending, no templates)
  * JSON files now supports commentaries (with double-slash)

### Version 1.0.0

  * Switched to ``nodemailer`` library instead of ``AWS-SDK``
  * Added email attachments with CID
  * Clarified email task status reporting
  * Test rendering doesn't require AWS keyfile
  * Refreshed dependencies

### Prior versions

Long time there was 0.x version. It worked, but wasn't good enough for me.
I've decided to release 1.x major release due to various circumstances,
but mainly because the tool is tested on about 100 email sending sessions.

Also,

## Contacts

Feel free to file issues and pull requests via [GitHub](https://github.com/sitnin/seslist)

## License

MIT
