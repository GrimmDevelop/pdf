const fs = require("fs");
const Converter = require('pdftohtmljs');
const inlineCSS = require('inline-css');
const {jsdom} = require("jsdom");
const {interpret} = require('xstate');

if (process.argv.length < 3) {
    console.log("please provide a valid pdf path");
    process.exit(1);
}

let input = process.argv[2];

let path = 'output';
let outputFile = 'raw.html';

// check if OS is Win, to use *.bat, else *.sh
let bin = process.platform.toUpperCase().indexOf('WIN') >= 0 ? '.\\pdf2htmlEX.bat' : '.\\pdf2htmlEX.sh';

let pdf = Converter(input, outputFile, {
    bin,
});

// for testing only parse page 187 and 188
pdf.add_options([
    "--dest-dir " + path,
    "--fit-width 968",
    "-f 187",
    "-l 188",
    "--optimize-text 5",
    "--printing 0",
    //"--embed-css 0",
    //"--embed-font 0",
    //"--embed-javascript 0",
]);

pdf.convert().then(function () {
    console.log("Generated raw html output [" + path + "/" + outputFile + "]");
    console.log("Loading generated html.");

    return new Promise(function (resolve, reject) {
        fs.readFile(path + "/" + outputFile, function (err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data.toString());
            }
        });
    });
}).then(function (html) {
    // Remove styles generated by pdf2htmlEX because they use invalid CSS syntax and cause inlineCSS to fail.
    console.log("Cleaning up generated html output");

    return html
        .replace('<link rel="stylesheet" href="base.min.css"/>', '')
        .replace('<link rel="stylesheet" href="fancy.min.css"/>', '')
        .replace('<link rel="stylesheet" href="document.css"/>', '<link rel="stylesheet" href="' + path + '/document.css"/>')
        .replace('<div id="sidebar">\n<div id="outline">\n</div>\n</div>\n', '')
        .replace('<div class="pi" data-data=\'{"ctm":[1.330000,0.000000,0.000000,1.330000,0.000000,0.000000]}\'></div>', '');
}).then(function (html) {
    console.log("Converting pdf2htmlEX generated css to inline css");

    return new Promise(function (resolve) {
        inlineCSS(html, {url: ' '}).then(function (html) {
            fs.writeFile('output/inline.html', html, function () {
                resolve(html);
            });
        });
    });
}).then(function (html) {
    console.log("Parsing generated html data");

    return new jsdom(html).window.document;
}).then(function (document) {
    console.log("Analysing document");
    console.log("");

    const {leftMap, keyWords} = require('./structure');

    // Available variables:
    // - Machine
    // - interpret
    // - assign
    // - send
    // - sendParent
    // - spawn
    // - raise
    // - actions
    // - XState (all XState exports)

    const fetchMachine = require('./machine');

    let chapters, chapter, letter, paragraph;

    const fetchService = interpret(fetchMachine).onTransition(state => {
        console.log("transition to", state.value);
        switch (state.value) {
            case "start":
                chapters = [];
                break;
            case "chapter":
                if (chapter) {
                    chapters.push(chapter);
                }

                chapter = newChapter(state.context.chapter);
                break;

            case "title":
                if (letter) {
                    chapter.letters.push(letter);
                }

                letter = newLetter(state.context.letter);
                break;

            case "end":
                if (chapter) {
                    if (letter) {
                        chapter.letters.push(letter);
                    }

                    chapters.push(chapter);
                }
                break;
        }
    }).start();

    // fake new chapter
    fetchService.send('CHAPTER');

    // TODO:
    // use state machine (?)
    //  - current chapter
    //  - current letter
    //  - position inside letter (date, title, paragraph, apparatus, ...)
    //  - parse next line in document and decide based on current position

    // find chapters
    // find start/title of letter
    // extract paragraphs and line breaks
    // drop line numbers
    // skip apparatuses and comments
    // processes next letter

    function checkLine(line) {
        let lineType = type(line, leftMap);
        let lineFont = font(line);

        switch (fetchService.state.value) {
            case "chapter":
            case "comments":
                if (lineFont === 'bold' && lineType === 'line') {
                    fetchService.send('TITLE');
                }
                break;
            case "title":
                fetchService.send('BODY');
                break;
            case "body":
                if (keyWords.apparatuses.some((keyWord) => line.textContent.includes(keyWord))) {
                    fetchService.send('APPARATUSES');
                }
                break;
            case 'apparatuses':
                if (keyWords.comments.some((keyWord) => line.textContent.includes(keyWord))) {
                    fetchService.send('COMMENTS');
                }
                break;
        }
    }

    let pages = document.querySelectorAll('body > div#page-container > div > div');

    // loop over all pages an lines
    pages.forEach(function (page) {

        if (isNewChapter(page)) {
            fetchService.send('CHAPTER');
        }

        console.log('');
        console.log('=========== new page ===========');

        page.childNodes.forEach(function (line, index) {
            if (index < 2) { //TODO: is this always right?
                console.log('page header or number');
            } else {
                // detect state change
                checkLine(line);

                // add line
                if (letter.hasOwnProperty(fetchService.state.value)) {
                    letter[fetchService.state.value].push(line);
                }

                // processLine(line);
            }
        });
    });

    fetchService.send('END');

    return chapters;
}).then(function (chapters) {
    console.log("Generating xml");

    function processLine(line) {
        if (lineType === 'new-paragraph') {
            xml += "</p><lb/><p>";

            // '<div><span style="font-weight: bold;">fett</span> <span style="font-style: italic;">ita<span style="font-weight: bold;">l</span>ic</span> normal</div>';

            function format(node) {
                let xml = '';

                node.childNodes.forEach((node) => {
                    switch (node.nodeType) {
                        case "3":
                            xml += node.textContent;
                            break;

                        default:
                            // recursive
                            if (font(node) === 'bold') {
                                xml += '<hi redention="#f">' + format(node) + '</hi>';
                            } else if (font(node) === 'italic') {
                                // ...
                            }
                    }
                });

                return xml;
            }

            format(line);
            console.log(line.textContent);
        } else if (lineType === 'line') {
            console.log(line.textContent);
            paragraph.push(line.textContent);
        } else if (lineType === 'line-number') {
            // skip line numbers
        } else {
            // unknown line indent -> probably right aligned text
            // does not detect indented text with left alignment
            console.log(line.textContent);
            paragraph.push(`<hi redention="#right">${line.textContent}</hi>`);
        }
    }

    // TODO: generate xml for letters
    chapters.forEach(function (chapter) {
        console.log("chapter: " + chapter.number);
        chapter.letters.forEach((letter) => {
            console.log("letter: " + letter.number);
            console.log(letter);

            // 1. letter.body to xml
            letter.body.map((line) => processLine(line));

            // 2. clean up apparatuses
            // 3. clean up comments
        });
    });
}).catch(function (err) {
    console.log(err);
});

function isNewChapter(page) {
    // gather chapters from excel list
    // check if chapter is on page
    return false;
}

function newChapter(number) {
    return {
        number,
        letters: [],
    };
}

function newLetter(number) {
    return {
        number,
        title: [],
        body: [],
        apparatuses: [],
        comments: [],
    };
}

function type(line, leftMap) {
    let left = Math.round(parseFloat(line.style.left));

    return leftMap[left];
}

function font(node) {
    if (node.classList.contains('ff1')) {
        return 'italic';
    }

    if (node.classList.contains('ff3')) {
        return 'bold';
    }

    return 'normal';
}
