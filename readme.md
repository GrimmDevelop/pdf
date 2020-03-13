# Convert PDF documents

## Requirements

* Docker
* Node.js 13.10.0 or newer

## Installation

* run `chmod +x ./php2htmlEX.sh`
* run `npm ci`

## Usage

* provide a valid pdf file: &lt;pdf&gt; is path to pdf
* run `node index.js <pdf>`
* first run will take some time as docker has to pull the image

## Output (WIP)

An XML-file is generated for each letter in given PDF document.
The format of the XML file corresponds to the standard according to TEI and DTABf.

http://www.deutschestextarchiv.de/doku/basisformat/uebersichtText.html

http://www.deutschestextarchiv.de/doku/basisformat/typogrAllg.html

https://tei-c.org/
