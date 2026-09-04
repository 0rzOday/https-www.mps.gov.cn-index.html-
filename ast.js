const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const type = require('@babel/types');
const fs = require("fs");

const ob_code = fs.readFileSync("./ob.js", "utf-8");
const ast = parser.parse(ob_code);
const parts = { array: '', shuffle: '', decode: '' };
let DecodingCodeName = '';

traverse(ast, {
    VariableDeclaration(path) {
        const init = path.node.declarations[0].init;
        if (type.isArrayExpression(init)) {
            if (init.elements.length > 50) {
                parts.array = generate(path.node).code;
            }
        } else if (type.isFunctionExpression(init) && init.body.body.length === 6) {
            DecodingCodeName = path.node.declarations[0].id.name;
            parts.decode = generate(path.node).code;
        }
    }
});

traverse(ast, {
    ExpressionStatement(path) {
        const callee = path.node.expression && path.node.expression.callee;
        if (type.isFunctionExpression(callee) && callee.body.body.length === 2) {
            parts.shuffle = generate(path.node).code;
        }
    }
});

const code = [parts.array, parts.shuffle, parts.decode, "module.exports = " + DecodingCodeName + ";"].join('\n');
fs.writeFileSync("./decode_env.js", code, "utf-8");
console.log("解码保存完毕");

delete require.cache[require.resolve("./decode_env.js")]; 
const get_value = require("./decode_env.js");

traverse(ast, {
    CallExpression(path) {
        const node = path.node;
        if (node.callee.name === DecodingCodeName && node.arguments.length === 2) {
            const argument1_node = node.arguments[0];
            const argument2_node = node.arguments[1];
            if (type.isStringLiteral(argument1_node) && type.isStringLiteral(argument2_node)) {
                const value = get_value(argument1_node.value, argument2_node.value);
                path.replaceWith(type.stringLiteral(value));
            }
        }
    }
});

// 替换简单的二元运算
traverse(ast, {
    BinaryExpression(path) {
        const node = path.node;
        if (type.isStringLiteral(node.left) && type.isStringLiteral(node.right)) {
            if (node.operator === "+") {
                path.replaceWith(type.stringLiteral(node.left.value + node.right.value));
            }
        }
    }
});

fs.writeFileSync("结果.js", generate(ast).code, "utf-8");
console.log("结果已写入 结果.js");