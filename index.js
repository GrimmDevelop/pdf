
const fs = require("fs");
const Converter = require('pdftohtmljs');
const uuid = require('uuid-random');
const inlineCSS = require('inlinecss');
const moment = require('moment');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

if(process.argv.length < 3) {
    console.log("please provide a valid pdf path");
    process.exit(1);
}

let input = process.argv[2];

let path = 'output';
let outputFile = moment().format('YMMDD-HHmmss') + "-raw.html";
let inlineFile = moment().format('YMMDD-HHmmss') + "-inlinecss.html";

let pdf = Converter(input, outputFile, {
    bin: './php2htmlEX.sh',
});

pdf.add_options([
    "--dest-dir " + path,
    "--fit-width 968",
    "-f 187",
    "-l 188",
    "--optimize-text 5",
    "--printing 0",
    "--embed-css 0",
    "--embed-font 0",
    "--embed-javascript 0",
]);

pdf.convert().then(function() {
    console.log("Generated raw html output [" + path + "/" + outputFile + "]");

    return new Promise(function(resolve, reject) {
        let html = fs.readFileSync(path + "/" + outputFile).toString();

        // remove styles generated by pdf2htmlEX
        html = html
            .replace('<link rel="stylesheet" href="base.min.css"/>', '')
            .replace('<link rel="stylesheet" href="fancy.min.css"/>', '')
            .replace('<div id="sidebar">\n<div id="outline">\n</div>\n</div>\n', '')
            .replace('<div class="pi" data-data=\'{"ctm":[1.330000,0.000000,0.000000,1.330000,0.000000,0.000000]}\'></div>', '');

        fs.writeFileSync(path + "/" + outputFile, html);

        resolve();
    });
}).then(function() {
    console.log("Cleaned up html output");

    // convert css classes etc to inline css
    return new Promise(function(resolve, reject) {
        inlineCSS.inlineFile(path + "/" + outputFile, path + "/" + inlineFile, {
            removeAttributes: false,
        }, resolve);
    });
}).then(function() {
    console.log("Parsed raw html and generated inline css [" + path + "/" + inlineFile + "]");

    let document = new JSDOM(fs.readFileSync(path + "/" + inlineFile).toString()).window.document;

    let pages = document.querySelectorAll('body > div#page-container > div > div');

    let familyMap = {
        'ff1': 'italic',
        'ff2': 'normal',
        'ff3': 'bold',
    };

    let leftMap = {
        94: 'line-number',
        101: 'line-number',
        132: 'line',
        155: 'new-paragraph',
    };

    // use state machine
    //  - current chapter
    //  - current letter
    //  - position inside letter (date, title, paragraph, apparatus, ...)
    //  - parse next line in document and decide based on current position

    // find chapters
    // find start/title of letter
    // extract date
    // extract opener
    // extract paragraphs and line breaks
    // drop line numbers
    // extract salute
    // extract signature
    // skip apparatuses and comments
    // processes next letter

    let letters = [];

    let letter, lineGroup;

    pages.forEach(function(page) {
        page.childNodes.forEach(function(line, index) {
            if(index === 0) {
                console.log('');
                console.log('=========== new page ===========');
            }

            if(index < 2) {
                console.log('page header or number');
            }

            let left = Math.round(parseFloat(line.style.left));

            let lineType = leftMap[left];

            let normal = line.classList.contains('ff2');
            let italic = line.classList.contains('ff1');
            let bold = line.classList.contains('ff3');

            if(!(bold && lineType === 'line') && !letter) {
                return;
            }

            if(bold && lineType === 'line') {
                console.log(line.textContent);
                if(letter) {
                    letters.push(letter);
                }

                letter = {
                    title: line.textContent,
                    lines: [],
                    apparatuses: null,
                    comments: null,
                };

                lineGroup = [];
            } else if(lineType === 'new-paragraph') {
                if(lineGroup.length > 0) {
                    letter.lines.push(lineGroup);
                }

                lineGroup = [];

                lineGroup.push(line.textContent);
                console.log(line.textContent);
            } else if(lineType === 'line' && italic) {
                // apparatuses or comment?
            } else if(lineType === 'line') {
                lineGroup.push(line.textContent);
                console.log(line.textContent);
            }
        });
    });

    if(letter) {
        letters.push(letter);
    }

    console.log(letters);
}).catch(function(err) {
    console.log(err);
});
