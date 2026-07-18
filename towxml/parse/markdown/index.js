let hljs;
hljs = require('../highlight/index');

/**
 * 将代码行首空白和空代码行转换为 WXML 不会折叠的空格实体。
 *
 * @param {string} value 高亮后的代码 HTML。
 * @returns {string} 保留行首缩进的代码 HTML。
 */
function preserveCodeWhitespace(value) {
    return String(value)
        .replace(/<br\/>(?=<br\/>)/g,'<br/>&nbsp;')
        .replace(/(^|<br\/>)([ \t]+)/g,(match,prefix,whitespace)=>{
            return prefix + whitespace.replace(/\t/g,'    ').replace(/ /g,'&nbsp;');
        });
}

const config = require('../../config'),
    mdOption = (()=>{
        let result = {
            html: true,
            xhtmlOut: true,
            typographer: true,
            breaks: true,
        };

        if(config.highlight.length && hljs){
            result.highlight = (code,lang,callback)=>{
                let lineLen = code.split(/\r|\n/ig).length,
                    result = hljs.highlightAuto(code).value;

                    result = preserveCodeWhitespace(result.replace(/\r|\n/g,'<br/>'));

                if(config.showLineNumber){
                    let lineStr = (()=>{
                        let str = `<ul class="h2w__lineNum">`;
                        for(let i=0;i<lineLen-1;i++){
                            str += `<li class="h2w__lineNumLine">${i+1}</li>`
                        };

                        str += `</ul>`;
                        return str;
                    })();
                    return lineStr + result;
                };
                return result;
            }
        };
        return result;
    })(),
    md = require('./markdown')(mdOption);

// 应用Markdown解析扩展，包括自定义组件（['sub','sup','ins','mark','emoji','todo','latex','yuml','echarts']）
[...config.markdown,...config.components].forEach(item => {
    if(!/^audio-player|table|todogroup|img$/.test(item)){
        md.use(require(`./plugins/${item}`));
    };
});

// 定义emoji渲染规则
md.renderer.rules.emoji = (token,index)=>{
    let item = token[index];
    return `<g-emoji class="h2w__emoji h2w__emoji--${item.markup}">${item.content}</g-emoji>`;
};

// 导出模块
module.exports = str => {
    return md.render(str);
};
