const {Machine, assign} = require('xstate');

const fetchMachine = Machine({
    id: 'letters',
    initial: 'start',
    strict: true,
    context: {
        chapter: 0,
        letter: 0
    },
    states: {
        start: {
            on: {
                CHAPTER: {
                    target: 'chapter',
                    actions: assign({
                        chapter: (context, event) => context.chapter + 1
                    })
                }
            }
        },
        chapter: {
            on: {
                TITLE: {
                    target: 'title',
                    actions: assign({
                        letter: (context, event) => 1
                    })
                }
            }
        },
        title: {
            on: {
                BODY: 'body'
            }
        },
        body: {
            on: {
                APPARATUSES: 'apparatuses',
                END: 'end'
            }
        },
        apparatuses: {
            on: {
                COMMENTS: 'comments'
            }
        },
        comments: {
            on: {
                TITLE: {
                    target: 'title',
                    actions: assign({
                        letter: (context, event) => context.letter + 1
                    })
                },
                CHAPTER: {
                    target: 'chapter',
                    actions: assign({
                        chapter: (context, event) => context.chapter + 1,
                        letter: (context, event) => 1
                    })
                },
                END: 'end'
            }
        },
        end: {
            type: 'final'
        }
    }
});

module.exports = fetchMachine;
