// babel-plugin-react-translate
// (c) Vitaliy Filippov 2021+
// SPDX-License-Identifier: LGPL-3.0

const fs = require('fs');

module.exports = function(babel)
{
    const t = babel.types;
    const importAdded = new WeakSet();
    const arg0 = new WeakSet();
    const regexp = new WeakMap();
    const ru = /[А-ЯЁа-яё]/;
    const strings = {};
    const getRegexp = function(state)
    {
        let re = regexp.get(state.opts);
        if (!re)
        {
            re = new RegExp(state.opts.regexp || '[А-ЯЁа-яё]');
            regexp.set(state.opts, re);
        }
        return re;
    };
    const splitWhite = function(str)
    {
        let l = /^\s+/.exec(str), r = /\s+$/.exec(str);
        l = l ? l[0] : '';
        r = r ? r[0] : '';
        return [ l, str.substr(l.length, str.length-r.length-l.length), r ];
    };
    const withWhite = function(l, repl, r)
    {
        if (l)
            repl = t.binaryExpression('+', t.stringLiteral(l), repl);
        if (r)
            repl = t.binaryExpression('+', repl, t.stringLiteral(r));
        return repl;
    };
    const addString = function(path, str)
    {
        const fn = path.hub.file.opts.filename.substr(path.hub.file.opts.root.length+1);
        strings[fn][str] = true;
    };
    const addImport = function(path)
    {
        const program = path.findParent(p => t.isProgram(p));
        if (!program)
        {
            throw new Error('<Program> AST element not found, can\'t add import');
        }
        if (!importAdded.has(program))
        {
            program.unshiftContainer('body', t.importDeclaration(
                [ t.importSpecifier(t.identifier('L'), t.identifier('L')) ],
                t.stringLiteral('babel-plugin-react-translate/runtime')
            ));
            importAdded.add(program);
        }
    };
    return {
        visitor: {
            Program: {
                enter(path, state)
                {
                    const fn = path.hub.file.opts.filename.substr(path.hub.file.opts.root.length+1);
                    strings[fn] = {};
                },
                exit(path, state)
                {
                    const fn = path.hub.file.opts.filename.substr(path.hub.file.opts.root.length+1);
                    let found = false;
                    for (let k in strings[fn])
                    {
                        found = true;
                        break;
                    }
                    if (!found)
                        delete strings[path.hub.file.opts.filename];
                    const arrays = { ...strings };
                    for (let k in arrays)
                        arrays[k] = Object.keys(arrays[k]);
                    fs.writeFileSync(
                        path.hub.file.opts.root+'/'+(state.opts['output'] || 'react-translate-output.json'),
                        JSON.stringify(arrays, null, 2)
                    );
                },
            },
            // Convert concatenated string literals and expressions to localization calls with arguments
            // I.e. 'Really delete '+item.name+'?' -> L('Really delete {1}?', item.name)
            BinaryExpression(path, state)
            {
                if (path.node.operator === '+')
                {
                    let added = [ path.node.left, path.node.right ];
                    for (let i = 0; i < added.length; i++)
                    {
                        if (t.isBinaryExpression(added[i]) && added[i].operator === '+')
                        {
                            added.splice(i, 1, added[i].left, added[i].right);
                            i--;
                        }
                    }
                    let ru = getRegexp(state);
                    let i18n = false;
                    for (let i = 0; i < added.length; i++)
                    {
                        if (t.isStringLiteral(added[i]) && ru.exec(added[i].value))
                        {
                            i18n = true;
                            break;
                        }
                    }
                    if (i18n)
                    {
                        let tpl = '', expressions = [];
                        let lit = true, i = 0;
                        while (i < added.length)
                        {
                            if (lit)
                            {
                                let text = '';
                                while (i < added.length && t.isStringLiteral(added[i]))
                                    text += added[i++].value;
                                tpl += text;
                            }
                            else
                            {
                                let expr = null;
                                while (i < added.length && !t.isStringLiteral(added[i]))
                                    expr = expr ? t.binaryExpression('+', expr, added[i++]) : added[i++];
                                expressions.push(expr);
                                tpl += '{'+expressions.length+'}';
                            }
                            lit = !lit;
                        }
                        let [ lwhite, text, rwhite ] = splitWhite(tpl);
                        addString(path, text);
                        text = t.stringLiteral(text);
                        // Stop the string literal from being visited again
                        arg0.add(text);
                        let repl = t.callExpression(t.identifier('L'), [ text, ...expressions ]);
                        repl = withWhite(lwhite, repl, rwhite);
                        path.replaceWith(repl);
                    }
                }
            },
            // Convert simple string literals to localization calls
            // I.e. "Hello" -> L("Hello")
            Literal(path, state)
            {
                let ru = getRegexp(state);
                if (ru.exec(path.node.value))
                {
                    const parent = path.findParent(() => true);
                    const isJSX = parent.isJSXAttribute();
                    if (isJSX || !arg0.has(path.node) && !path.findParent(parent => arg0.has(parent.node)))
                    {
                        const [ lwhite, text, rwhite ] = splitWhite(path.node.value);
                        addString(path, text);
                        addImport(path);
                        let repl = t.callExpression(t.identifier('L'), [ t.stringLiteral(text) ]);
                        repl = withWhite(lwhite, repl, rwhite);
                        if (isJSX)
                            path.replaceWith(t.jsxExpressionContainer(repl));
                        else
                        {
                            // Stop the original string from being visited again
                            arg0.add(repl);
                            path.replaceWith(repl);
                        }
                    }
                }
            },
            CallExpression(path)
            {
                if (path.node.callee.type === 'Identifier' && path.node.callee.name === 'L')
                {
                    if (t.isStringLiteral(path.node.arguments[0]))
                    {
                        // Remember the user-provided string
                        addString(path, path.node.arguments[0].value);
                        addImport(path);
                    }
                    // Skip the first argument
                    arg0.add(path.node.arguments[0]);
                }
            },
            // Convert simple JSX literals to localization calls
            // I.e. <b>Text</b> -> <b>{L("Text")}</b>
            JSXText(path, state)
            {
                let ru = getRegexp(state);
                if (ru.exec(path.node.value))
                {
                    const [ lwhite, text, rwhite ] = splitWhite(path.node.value);
                    addImport(path);
                    addString(path, text);
                    const repl = [];
                    if (lwhite)
                        repl.push(t.jsxText(lwhite));
                    repl.push(t.jsxExpressionContainer(t.callExpression(t.identifier('L'), [ t.stringLiteral(text) ])));
                    if (rwhite)
                        repl.push(t.jsxText(rwhite));
                    path.replaceWithMultiple(repl);
                }
            },
            // Convert template literals to localization calls with arguments
            // I.e. `Really delete ${item.name}?` -> L("Really delete {1}?", item.name)
            TemplateLiteral(path, state)
            {
                let ru = getRegexp(state);
                if (path.node.quasis.find(q => ru.exec(q.value.cooked)))
                {
                    addImport(path);
                    let tpl = path.node.quasis[0].value.cooked;
                    for (let i = 1; i < path.node.quasis.length; i++)
                        tpl += '{'+i+'}'+path.node.quasis[i].value.cooked;
                    let [ lwhite, text, rwhite ] = splitWhite(tpl);
                    addString(path, text);
                    text = t.stringLiteral(text);
                    // Stop the string literal from being visited again
                    arg0.add(text);
                    let repl = t.callExpression(t.identifier('L'), [ text, ...path.node.expressions ]);
                    repl = withWhite(lwhite, repl, rwhite);
                    path.replaceWith(repl);
                }
            },
        },
    };
}
