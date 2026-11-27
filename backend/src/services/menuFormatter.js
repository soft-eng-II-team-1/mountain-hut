/**
 * Menu formatting logic for MH-10 ("Define menus").
 *
 * The menu of a slot is stored as free text in `slot.menu`, written with a small
 * subset of Markdown, so it stays readable as plain text and needs no HTML:
 *
 *   **bold**              bold text
 *   *italic* or _italic_  italic text (markers can be nested: **bold _and italic_**)
 *   - item / * item       list item ("+" works too)
 *     - sub item          sub item: 2 more spaces of indentation per level (a tab counts as 2 spaces)
 *   \*                    backslash escapes a marker (\* \_ \- \+ \\) to write it literally
 *
 * Lines that are not list items form paragraphs (line breaks are kept), a blank line
 * ends a paragraph or a list. Markers that are not closed are kept as literal text.
 *
 * The parsed document is a tree of plain objects, so the frontend can render it
 * with React elements (no innerHTML, no XSS):
 *
 *   Block  = { type: 'paragraph', content: Inline[] }
 *          | { type: 'list', items: ListItem[] }
 *   ListItem = { content: Inline[], children: ListItem[] }
 *   Inline = { type: 'text', text: string }
 *          | { type: 'bold' | 'italic', content: Inline[] }
 *          | { type: 'line_break' }
 *
 * This module is pure (no DB access) so it can be unit-tested in isolation.
 */

// Max length of a menu (after normalization)
export const MAX_MENU_LENGTH = 5000;

// Max nesting of the lists: 0 = items, 1 = sub items, 2 = sub-sub items
export const MAX_LIST_DEPTH = 2;

const INDENT_SIZE = 2;
const ESCAPABLE = new Set(['*', '_', '\\', '-', '+']);
const LIST_ITEM = /^( *)[-*+] +(.*)$/;

/**
 * Normalizes a menu before it is validated, parsed or saved:
 * unifies line endings, turns tabs into spaces, removes control characters,
 * trailing spaces and repeated blank lines.
 *
 * @param {string | null | undefined} text
 * @returns {string | null} the normalized menu, or null if it is empty
 */
export function normalizeMenu(text) {
    if (text === null || text === undefined) return null;

    const normalized = String(text)
        .replace(/\r\n?/g, '\n')
        .replace(/\t/g, ' '.repeat(INDENT_SIZE))
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^\n+|\n+$/g, '');

    return normalized.trim() === '' ? null : normalized;
}

// Nesting level of a list item from its indentation
const levelOf = (indent) => Math.floor(indent.length / INDENT_SIZE);

/**
 * Checks a menu and returns the problems found (empty array if it is valid).
 * The checks are done on the normalized text.
 *
 * @param {string | null | undefined} text
 * @returns {string[]}
 */
export function validateMenu(text) {
    const menu = normalizeMenu(text);
    if (menu === null) {
        return ['The menu cannot be empty'];
    }

    const errors = [];
    if (menu.length > MAX_MENU_LENGTH) {
        errors.push(`The menu cannot be longer than ${MAX_MENU_LENGTH} characters`);
    }

    let previousLevel = -1; // -1 = not inside a list
    menu.split('\n').forEach((line, index) => {
        const match = LIST_ITEM.exec(line);
        if (!match) {
            if (line.trim() === '') previousLevel = -1;
            return;
        }
        const level = levelOf(match[1]);
        if (level > MAX_LIST_DEPTH) {
            errors.push(`Line ${index + 1}: lists can be nested at most ${MAX_LIST_DEPTH} levels deep`);
        } else if (level > previousLevel + 1) {
            errors.push(`Line ${index + 1}: a sub item must follow an item of the level above`);
        }
        previousLevel = level;
    });

    return errors;
}

/*** Inline parsing (bold / italic) ***/

const isSpace = (ch) => ch === undefined || /\s/.test(ch);

// "_" inside a word (e.g. snake_case_name) is not an italic marker
const isWordChar = (ch) => ch !== undefined && /[\p{L}\p{N}]/u.test(ch);

// Index of the marker that closes the one opened before `from`, or -1.
// Escaped characters are skipped, and while looking for a single "*" the "**" pairs
// are skipped too, so "*a **b** c*" is an italic text with a bold part
const findClosing = (s, from, marker) => {
    for (let j = from; j < s.length; j++) {
        if (s[j] === '\\' && ESCAPABLE.has(s[j + 1])) {
            j++;
            continue;
        }
        if (marker === '*' && s.startsWith('**', j) && !isSpace(s[j + 2])) {
            // a bold part inside the italic text: jump after its closing "**"
            const boldEnd = findClosing(s, j + 2, '**');
            if (boldEnd !== -1) {
                j = boldEnd + 1;
                continue;
            }
        }
        if (s.startsWith(marker, j) && j > from && !isSpace(s[j - 1])
            && !(marker === '_' && isWordChar(s[j + 1]))) {
            return j;
        }
    }
    return -1;
};

// Appends text to the list of nodes, merging it with the previous text node
const pushText = (nodes, text) => {
    if (text === '') return;
    const last = nodes[nodes.length - 1];
    if (last?.type === 'text') {
        last.text += text;
    } else {
        nodes.push({ type: 'text', text });
    }
};

/**
 * Parses the bold / italic markers of a single line.
 *
 * @param {string} s
 * @returns {Array<object>} Inline nodes
 */
export function parseInline(s) {
    const nodes = [];
    let i = 0;

    while (i < s.length) {
        const ch = s[i];

        if (ch === '\\' && ESCAPABLE.has(s[i + 1])) {
            pushText(nodes, s[i + 1]);
            i += 2;
            continue;
        }

        const marker = s.startsWith('**', i) ? '**' : (ch === '*' || ch === '_') ? ch : null;
        const opens = marker && !isSpace(s[i + marker.length]) && !(marker === '_' && isWordChar(s[i - 1]));
        if (opens) {
            const start = i + marker.length;
            const end = findClosing(s, start, marker);
            if (end !== -1) {
                nodes.push({ type: marker === '**' ? 'bold' : 'italic', content: parseInline(s.slice(start, end)) });
                i = end + marker.length;
                continue;
            }
        }

        // literal character (or a marker that is not closed)
        pushText(nodes, marker ?? ch);
        i += marker?.length ?? 1;
    }

    return nodes;
}

/*** Block parsing (paragraphs / lists) ***/

// Builds the nested items of a list from its flat items with their level
const buildListItems = (flatItems) => {
    const root = [];
    const stack = []; // stack[level] = list of the items at that level currently open
    for (const { level, content } of flatItems) {
        const item = { content, children: [] };
        // a too deep item is attached to the deepest open level (validateMenu reports it)
        const effective = Math.min(level, stack.length);
        if (effective === 0) {
            root.push(item);
        } else {
            const parentList = stack[effective - 1];
            parentList[parentList.length - 1].children.push(item);
        }
        stack.length = effective;
        stack.push(effective === 0 ? root : stack[effective - 1][stack[effective - 1].length - 1].children);
    }
    return root;
};

/**
 * Parses a menu into a list of blocks (see the top of the file).
 *
 * @param {string | null | undefined} text
 * @returns {Array<object>} Blocks (empty array if there is no menu)
 */
export function parseMenu(text) {
    const menu = normalizeMenu(text);
    if (menu === null) return [];

    const blocks = [];
    let paragraph = null; // Inline[] of the open paragraph
    let listItems = null; // flat items of the open list

    const closeParagraph = () => {
        if (paragraph) blocks.push({ type: 'paragraph', content: paragraph });
        paragraph = null;
    };
    const closeList = () => {
        if (listItems) blocks.push({ type: 'list', items: buildListItems(listItems) });
        listItems = null;
    };

    for (const line of menu.split('\n')) {
        if (line.trim() === '') {
            closeParagraph();
            closeList();
            continue;
        }

        const match = LIST_ITEM.exec(line);
        if (match) {
            closeParagraph();
            listItems ??= [];
            listItems.push({ level: levelOf(match[1]), content: parseInline(match[2]) });
            continue;
        }

        if (listItems && /^ +/.test(line)) {
            // indented line right after an item: continuation of that item
            const last = listItems[listItems.length - 1];
            last.content.push({ type: 'line_break' });
            last.content.push(...parseInline(line.trim()));
            continue;
        }

        closeList();
        if (paragraph) {
            paragraph.push({ type: 'line_break' });
        } else {
            paragraph = [];
        }
        paragraph.push(...parseInline(line.trim()));
    }

    closeParagraph();
    closeList();
    return blocks;
}
