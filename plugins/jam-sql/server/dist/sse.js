"use strict";
/**
 * Incremental Server-Sent Events parser for the streamable-HTTP responses:
 * fed decoded text chunks as they arrive, it emits each complete event.
 * Handles LF, CRLF and bare CR line ends (also split across chunks),
 * multi-line `data:`, `event:` names and `:` comments. Lines of one event are
 * kept as pieces and joined once, so a multi-megabyte result is not
 * re-scanned on every chunk.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSseParser = void 0;
const createSseParser = (onEvent) => {
    let linePieces = [];
    let skipLeadingLf = false;
    let dataLines = [];
    let eventName = '';
    const dispatch = () => {
        if (dataLines.length > 0) {
            onEvent({ event: eventName || 'message', data: dataLines.join('\n') });
        }
        dataLines = [];
        eventName = '';
    };
    const processLine = (line) => {
        if (line === '') {
            dispatch();
            return;
        }
        if (line.startsWith(':'))
            return;
        const colon = line.indexOf(':');
        const field = colon === -1 ? line : line.slice(0, colon);
        let value = colon === -1 ? '' : line.slice(colon + 1);
        if (value.startsWith(' '))
            value = value.slice(1);
        if (field === 'data')
            dataLines.push(value);
        else if (field === 'event')
            eventName = value;
        // `id` and `retry` need no handling: the app's transport keeps no event store to resume from.
    };
    const nextBreak = (text, from) => {
        const lf = text.indexOf('\n', from);
        const cr = text.indexOf('\r', from);
        if (lf === -1)
            return cr;
        if (cr === -1)
            return lf;
        return Math.min(lf, cr);
    };
    const feed = (chunk) => {
        let start = 0;
        if (skipLeadingLf) {
            skipLeadingLf = false;
            if (chunk.startsWith('\n'))
                start = 1;
        }
        for (;;) {
            const at = nextBreak(chunk, start);
            if (at === -1) {
                if (start < chunk.length)
                    linePieces.push(chunk.slice(start));
                return;
            }
            linePieces.push(chunk.slice(start, at));
            const line = linePieces.length === 1 ? linePieces[0] : linePieces.join('');
            linePieces = [];
            processLine(line);
            if (chunk[at] === '\r') {
                if (at + 1 === chunk.length) {
                    skipLeadingLf = true;
                    return;
                }
                start = chunk[at + 1] === '\n' ? at + 2 : at + 1;
            }
            else {
                start = at + 1;
            }
        }
    };
    const end = () => {
        if (linePieces.length > 0) {
            processLine(linePieces.join(''));
            linePieces = [];
        }
        dispatch();
    };
    return { feed, end };
};
exports.createSseParser = createSseParser;
