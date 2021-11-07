const fs = require('fs');
const babel = require('@babel/core');
const jsx = require('@babel/plugin-transform-react-jsx');
const plugin = require('../');

var example = '\
var name = "John";\
var foo = "Ё-Mobile";\
foo = "Меня зовут "+name+"!  ";\
foo = `  Меня зовут ${name}!`;\
foo = <span>Привет!</span>;\
foo = L("У меня много {1}: ", L("братьев"));\
var age = { "Братья": { "Иван": "Горький", "Mikhail": "Золотухин" }, ["Сёстры"+getnum()]: {}, Родители };\
';

it('works', () =>
{
    const { code } = babel.transform(example, { filename: 'test', plugins: [ jsx, plugin ] });
    expect(code).toMatchSnapshot();
    expect(JSON.parse(fs.readFileSync('react-translate-output.json'))).toEqual({
        test: [
            "Ё-Mobile",
            "Меня зовут {1}!",
            "Привет!",
            "У меня много {1}: ",
            "братьев",
            "Братья",
            "Иван",
            "Горький",
            "Золотухин",
            "Сёстры{1}"
        ]
    });
});
