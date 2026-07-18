const md = require('./parse/markdown/index'),
    parse = require('./parse/index'),
    hljs = require('./parse/highlight/index')

/**
 * 从 Towxml 代码节点中还原可复制的原始文本。
 *
 * @param {Record<string, any>} node Towxml 节点。
 * @returns {string} 还原后的代码文本。
 */
function extractCodeText(node) {
    if (!node) return '';
    const className = node.attr ? String(node.attr.class || '') : '';
    if (className.includes('h2w__lineNum')) return '';
    if (className.includes('h2w__br')) return '\n';
    if (typeof node.text === 'string') return node.text.replace(/\u00a0/g,' ');
    if (!Array.isArray(node.child)) return '';
    return node.child.map(extractCodeText).join('');
}

/**
 * 从富文本代码块类名中识别高亮语言。
 *
 * @param {Record<string, any>} preNode pre 节点。
 * @param {Record<string, any>} codeNode code 节点。
 * @returns {string} 已注册的语言名称，未识别时返回空字符串。
 */
function detectCodeLanguage(preNode,codeNode) {
    const className = [preNode,codeNode]
        .map(node => node && node.attr ? String(node.attr.class || '') : '')
        .join(' ');
    const pattern = /(?:^|\s)(?:language-|lang-)([\w-]+)/g;
    let match = pattern.exec(className);
    while (match) {
        const language = match[1].toLowerCase();
        if (language !== 'hljs' && hljs.getLanguage(language)) {
            return language;
        };
        match = pattern.exec(className);
    };
    return '';
}

/**
 * 为富文本代码节点生成语法高亮子节点。
 *
 * @param {Record<string, any>} preNode pre 节点。
 * @param {Record<string, any>} codeNode code 节点。
 * @param {Record<string, any>} option Towxml 渲染选项。
 * @returns {void}
 */
function highlightHtmlCodeNode(preNode,codeNode,option) {
    const code = extractCodeText(codeNode);
    if (!code.trim()) return;
    const language = detectCodeLanguage(preNode,codeNode);
    const highlighted = language
        ? hljs.highlight(language,code,true).value
        : hljs.highlightAuto(code).value;
    const highlightedRoot = parse(`<div>${highlighted}</div>`,option);
    const wrapperNode = highlightedRoot.child && highlightedRoot.child[0];
    if (wrapperNode && Array.isArray(wrapperNode.child)) {
        codeNode.child = wrapperNode.child;
    };
}

/**
 * 将富文本代码中的普通换行转换为 Towxml 显式节点。
 *
 * @param {string} text 原始代码文本。
 * @param {{lineStart: boolean}} state 当前行状态。
 * @returns {Array<Record<string, any>>} 转换后的 Towxml 节点。
 */
function convertCodeTextNodes(text,state) {
    const nodes = [];
    String(text).split(/(\r\n|\r|\n)/).forEach(part => {
        if (/^(\r\n|\r|\n)$/.test(part)) {
            if (state.lineStart) {
                nodes.push({type:'text',text:'\u00a0'});
            };
            nodes.push({
                type:'tag',
                tag:'view',
                attr:{class:'h2w__br'},
                child:[]
            });
            state.lineStart = true;
            return;
        };
        if (!part) return;
        let content = part;
        if (state.lineStart) {
            content = content.replace(/^[ \t]+/,whitespace => {
                return whitespace.replace(/\t/g,'    ').replace(/ /g,'\u00a0');
            });
        };
        nodes.push({type:'text',text:content});
        state.lineStart = false;
    });
    return nodes;
}

/**
 * 递归规范化富文本代码节点的换行、空行和缩进。
 *
 * @param {Record<string, any>} node Towxml 代码节点。
 * @param {{lineStart: boolean}} state 当前行状态。
 * @returns {void}
 */
function normalizeHtmlCodeNode(node,state) {
    if (!node || !Array.isArray(node.child)) return;
    const normalizedChildren = [];
    node.child.forEach(child => {
        if (typeof child.text === 'string') {
            normalizedChildren.push(...convertCodeTextNodes(child.text,state));
            return;
        };
        const className = child.attr ? String(child.attr.class || '') : '';
        if (className.includes('h2w__br')) {
            if (state.lineStart) {
                normalizedChildren.push({type:'text',text:'\u00a0'});
            };
            normalizedChildren.push(child);
            state.lineStart = true;
            return;
        };
        normalizeHtmlCodeNode(child,state);
        normalizedChildren.push(child);
    });
    node.child = normalizedChildren;
}

/**
 * 查找并规范化富文本中的全部代码块。
 *
 * @param {Record<string, any>} node Towxml 节点。
 * @param {Record<string, any>} option Towxml 渲染选项。
 * @returns {void}
 */
function normalizeHtmlCodeBlocks(node,option) {
    if (!node || !Array.isArray(node.child)) return;
    const className = node.attr ? String(node.attr.class || '') : '';
    if (className.includes('h2w__pre')) {
        const codeNode = node.child.find(item => {
            const childClassName = item.attr ? String(item.attr.class || '') : '';
            return childClassName.includes('h2w__code');
        });
        if (codeNode) {
            if (option.highlightCode) {
                highlightHtmlCodeNode(node,codeNode,option);
            };
            normalizeHtmlCodeNode(codeNode,{lineStart:true});
        };
    };
    node.child.forEach(child => normalizeHtmlCodeBlocks(child,option));
}

/**
 * 为 Towxml 代码块插入复制按钮。
 *
 * @param {Record<string, any>} node Towxml 节点。
 * @returns {void}
 */
function appendCodeCopyButtons(node) {
    if (!node || !Array.isArray(node.child)) return;
    const className = node.attr ? String(node.attr.class || '') : '';
    if (className.includes('h2w__pre')) {
        const codeNode = node.child.find(item => {
            const childClassName = item.attr ? String(item.attr.class || '') : '';
            return childClassName.includes('h2w__code');
        });
        if (codeNode) {
            const code = extractCodeText(codeNode)
                .replace(/^[ \t]+$/gm,'')
                .replace(/\n$/,'');
            node.child.unshift({
                type:'tag',
                tag:'view',
                attr:{
                    class:'h2w__copyButton',
                    data:code
                },
                child:[{type:'text',text:'复制'}]
            });
        }
    }
    node.child.forEach(appendCodeCopyButtons);
}

/**
 * 将 HTML 或 Markdown 转换为 Towxml 渲染节点。
 *
 * @param {string} str 原始内容。
 * @param {'html'|'markdown'} type 内容类型。
 * @param {Record<string, any>} option 渲染选项。
 * @returns {Record<string, any>} Towxml 渲染节点。
 */
function towxml(str,type,option) {
    option = option || {};
    let result;
    switch (type) {
        case 'markdown':
            result = parse(md(str),option);
        break;
        case 'html':
            result = parse(str,option);
        break;
        default:
            throw new Error('Invalid type, only markdown and html are supported');
        break;
    };
    if(type === 'html'){
        normalizeHtmlCodeBlocks(result,option);
    };
    if(option.copyCode){
        appendCodeCopyButtons(result);
    };
    return result;
}

module.exports = towxml;
