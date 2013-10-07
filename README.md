# Amazon SES mail list sender

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
		"from": "Gregory Sitnin <greg@sitnin.com>",
		"subject": "This is a mailing list"
	}


### queue.csv

	Should contain CSV-data with field names on a first row. `email` field is required, all other is optional. Every key from row will be passed to the template engine while generating email messages.

	"name","surname","email"
	"Success","Target","success@simulator.amazonses.com"
	"Bounce",,"bounce@simulator.amazonses.com"
	,"OutOfOffice","ooto@simulator.amazonses.com"
	"Complaint","List","complaint@simulator.amazonses.com"
	,,"suppressionlist@simulator.amazonses.com"

## Running

	seslist -d <workingFolder> -k <key-json-file> [-r]

## Contacts

Feel free to file issues and pull requests via [GitHub](https://github.com/sitnin/seslist)

## License

MIT
