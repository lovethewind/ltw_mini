const parse2 = require('./parse2/index'),
    // parse5 = require('./parse5/index').parse,
    config = require('../config'),

    // html与wxml转换关系
    correspondTag = (()=>{
        let result = {
                a:'navigator',
                todogroup:'checkbox-group',
                audio:'audio-player'
            };
        
        // // 该系列的标签都转换为text
        // ['span','b','strong','i','em','code','sub','sup','g-emoji','mark','ins'].forEach(item => {
        //     result[item] = 'text';
        // });

        // 该系列小程序原生tag，不需转换
        [...config.wxml,...config.components].forEach(item => {
            result[item] = item;
        });
        return result;
    })(),

    // 元素与html对应的wxml标签名
    getWxmlTag = tagStr => !tagStr ? undefined : correspondTag[tagStr] || 'view',

    // 精简数据，并初始化相关事件等
    initObj = (obj,option)=>{
        const result = {
                theme:option.theme || 'light',
                _e:{}
            },
            events = global._events = {},
            base = option.base;

        // 主题保存到全局
        global._theme = result.theme;

        // 事件添加到全局中，各个组件在触发事件时会从全局调用
        if(option.events){
            for(let key in option.events){
                events[key] = option.events[key];
            };
        };

        // 将列表符号合并到第一个可见文字节点，避免它与首个 strong/em 节点
        // 跨越 decode 子组件边界后被微信渲染成单独一行。
        const prependRenderedText = (node,prefix) => {
            if(!node) return false;
            if(node.type === 'text'){
                node.text = `${prefix}${node.text || ''}`;
                return true;
            };
            if(!Array.isArray(node.child)) return false;
            for(let i = 0; i < node.child.length; i++){
                if(prependRenderedText(node.child[i],prefix)) return true;
            };
            return false;
        };

        // 遍历原始数据，处理成能解析的数据
        let eachFn;
        (eachFn = (arr,obj,_e,preserveWhitespace = false,parentTag = '',parentClass = '') => {
            obj.child = obj.child || [];
            _e.child = _e.child || [];

            arr.forEach((item,itemIndex) => {
                if(item.type === 'comment'){
                    return;
                };
                let o = {},
                    e = {};
                o.type = e.type = item.type;
                o._e = e;
                if(item.type === 'text'){
                    // Markdown 解析会在块级节点之间保留格式换行。对网页来说这些
                    // 换行没有可见影响，但小程序会把它们渲染成独立的 text 行，
                    // 叠加行高后会造成段落间距异常。代码块中的换行仍需保留。
                    if(!preserveWhitespace && /^[\t\r\n ]*[\r\n][\t\r\n ]*$/.test(item.data || '')){
                        return;
                    };
                    o.text = e.text = item.data;
                }else{
                    o.tag = getWxmlTag(item.name);      // 转换之后的标签
                    // o.tag = o.tag === 'text' ? 'view' : o.tag;
                    e.tag = item.name;                  // 原始
                    o.attr = item.attribs;
                    e.attr = JSON.parse(JSON.stringify(item.attribs));

                    o.attr.class = o.attr.class ? `h2w__${item.name} ${o.attr.class}` : `h2w__${item.name}`;

                    // WXSS 的 list-style 在小程序 view 上兼容性不稳定，列表项的
                    // 项目符号/编号会在子节点完成后合并到第一个文字节点。
                    const itemClass = String(item.attribs && item.attribs.class || '');
                    const isLineNumber = `${itemClass} ${parentClass}`.includes('lineNum');
                    const isListItem = item.name === 'li' && (parentTag === 'ul' || parentTag === 'ol');
                    const shouldAddListPrefix = isListItem && !isLineNumber;
                    const listItemNumber = arr
                        .slice(0,itemIndex)
                        .filter(child => child.type !== 'text' && child.name === 'li')
                        .length + 1;
                    const listPrefix = parentTag === 'ol' ? `${listItemNumber}. ` : '• ';
                    if(isListItem){
                        o.attr.style = `${o.attr.style || ''}${o.attr.style ? ';' : ''}display:block;`;
                    };

                    // 处理资源相对路径
                    if(base && o.attr.src){
                        let src = o.attr.src;
                        switch (src.indexOf('//')) {
                            case 0:
                                o.attr.src = `https:${src}`;
                            break;
                            case -1:
                                o.attr.src = `${base}${src}`;
                            break;
                        };
                    };

                    if(item.children){
                        const childPreserveWhitespace = preserveWhitespace || item.name === 'pre' || item.name === 'code';
                        eachFn(item.children,o,e,childPreserveWhitespace,item.name,item.attribs && item.attribs.class || '');
                    };
                    if(shouldAddListPrefix){
                        // 对 `1. **加粗内容**`，编号会进入 strong 内的文字节点，
                        // 不再作为 decode 子组件前的独立节点触发换行。
                        if(!prependRenderedText(o,listPrefix)){
                            const markerText = {type:'text',text:listPrefix};
                            const markerEventText = {type:'text',text:listPrefix};
                            markerText._e = markerEventText;
                            o.child.unshift(markerText);
                            e.child.unshift(markerEventText);
                        }else{
                            prependRenderedText(e,listPrefix);
                        };
                    };
                };
                _e.child.push(e);
                obj.child.push(o);
            });
        })(obj,result,result._e);
        return result;
    };

module.exports = (str,option) => {
    str = (()=>{
        let re = /<body[^>]*>([\s\S]*)<\/body>/i;
        if(re.test(str)){
            let result = re.exec(str);
            return result[1] || str;
        }else{
            return str;
        };
    })();
    return initObj(parse2(str,{decodeEntities:true}),option);
};
