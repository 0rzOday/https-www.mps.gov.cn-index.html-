const fs = require("fs");
(function (global) {
    function watch(obj, name = 'obj', depth = 0) {
        const indent = '  '.repeat(depth);
        const seen = new WeakSet(); // 防止循环引用死循环

        function wrap(value, key) {
            if (value && typeof value === 'object' && !seen.has(value)) {
                seen.add(value);
                return watch(value, `${name}.${key}`, depth + 1);
            }
            if (typeof value === 'function') {
                return function (...args) {
                    const r = value.apply(this, args);
                    console.log(`${indent}▶ ${name}.${key}(${args.map(a => JSON.stringify(a)).join(', ')}) →`, JSON.stringify(r));
                    return r;
                };
            }
            return value;
        }
        const handler = {
            get(t, prop) {
                const v = t[prop];
                console.log(`${indent}📖 读 ${name}.${String(prop)} =`, typeof v === 'function' ? '<function>' : JSON.stringify(v));
                return wrap(v, prop);
            },
            set(t, prop, value) {
                console.log(`${indent}✍️ 写 ${name}.${String(prop)} =`, JSON.stringify(value));
                t[prop] = value;
                return true;
            },
            has(t, prop) {
                console.log(`${indent}❓ in ${name}.${String(prop)}`);
                return prop in t;
            },
        };
        return new Proxy(obj, handler);
    }

    // ===== 三个独立模拟对象，互不套娃 =====
    // window：塞一个像浏览器的 userAgent，骗过脚本的环境检测
    var window = watch({
        navigator:{
            "userAgent":'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36'
        }
    },'window');

    // document：独立对象，别用 watch(window)！
    var document = watch({  }, 'document');

    // location：之前漏了，必须补上
    var location = watch({
        "pathname":'/index.html',
        "search":''
    }, 'location');

    // alert：脚本破解失败时会调，补一个防止崩
    //global.alert = function (msg) { console.log('⚠ alert:', msg); };

    const js_code = fs.readFileSync("./challenge2_raw.js", "utf-8");
    console.log('========== 开始执行第二段验证脚本 ==========');
    eval(js_code);

    // 脚本最后 setTimeout(1500ms) 才写 cookie，等它写完再打印结果
    setTimeout(() => {
        console.log('========== 最终结果 ==========');
        console.log('document.cookie :=', document.cookie);
        process.exit(0);
    }, 2200);
}(global))