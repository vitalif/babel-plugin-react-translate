const fs = require('fs');

module.exports = function(babel)
{
    const t = babel.types;
    const importAdded = new WeakSet();
    const arg0 = new WeakSet();
    const ru = /[А-ЯЁа-яё]/;
    const strings = {};
    const addString = function(path, str)
    {
        strings[path.hub.file.opts.filename][str] = str;
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
                    strings[path.hub.file.opts.filename] = {};
                },
                exit(path, state)
                {
                    let found = false;
                    for (let k in strings[path.hub.file.opts.filename])
                    {
                        found = true;
                        break;
                    }
                    if (!found)
                        delete strings[path.hub.file.opts.filename];
                    fs.writeFileSync(
                        path.hub.file.opts.root+'/'+(state.opts['output'] || 'react-translate-output.json'),
                        JSON.stringify(strings, null, 2)
                    );
                },
            },
            Literal(path)
            {
                if (ru.exec(path.node.value))
                {
                    addString(path, path.node.value);
                    addImport(path);
                    const parent = path.findParent(() => true);
                    if (parent.isJSXAttribute())
                        path.replaceWith(t.jsxExpressionContainer(t.callExpression(t.identifier('L'), [ path.node ])));
                    else if (!arg0.has(path.node) && !path.findParent(parent => arg0.has(parent.node)))
                    {
                        // Stop the original string from being visited again
                        arg0.add(path.node);
                        path.replaceWith(t.callExpression(t.identifier('L'), [ path.node ]));
                    }
                }
            },
            CallExpression(path)
            {
                if (path.node.callee.type === 'Identifier' && path.node.callee.name === 'L')
                {
                    // Skip the first argument
                    arg0.add(path.node.arguments[0]);
                }
            },
            JSXText(path)
            {
                if (ru.exec(path.node.value))
                {
                    addImport(path);
                    const lwhite = /^\s+/.exec(path.node.value);
                    const rwhite = /\s+$/.exec(path.node.value);
                    const llen = lwhite ? lwhite[0].length : 0;
                    const text = path.node.value.substr(llen, path.node.value.length - llen - (rwhite ? rwhite[0].length : 0));
                    addString(path, text);
                    const repl = [];
                    if (lwhite)
                        repl.push(t.jsxText(lwhite[0]));
                    repl.push(t.jsxExpressionContainer(t.callExpression(t.identifier('L'), [ t.stringLiteral(text) ])));
                    if (rwhite)
                        repl.push(t.jsxText(rwhite[0]));
                    path.replaceWithMultiple(repl);
                }
            },
            TemplateLiteral(path)
            {
                if (path.node.quasis.find(q => ru.exec(q.value.cooked)))
                {
                    addImport(path);
                    let text = path.node.quasis[0].value.cooked;
                    for (let i = 1; i < path.node.quasis.length; i++)
                        text += '{'+i+'}'+path.node.quasis[i].value.cooked;
                    addString(path, text);
                    // Stop the string literal from being visited again
                    text = t.stringLiteral(text);
                    arg0.add(text);
                    path.replaceWith(t.callExpression(t.identifier('L'), [ text, ...path.node.expressions ]));
                }
            },
        },
    };
}
