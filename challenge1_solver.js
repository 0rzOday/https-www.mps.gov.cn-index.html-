const fs = require('fs');
const src = fs.readFileSync('./challenge1_raw.js', 'utf-8');
global.document = { cookie: '' };
global.location = { pathname: '/index.html', search: '' };

eval(src);

console.log('cookie := ' + document.cookie);

// 5. 提取 __jsl_clearance_s 的值
const m = document.cookie.match(/__jsl_clearance_s=([^;]+)/);
function get_first_cookie() {
    if (m) {
        return m[1];
    } else {
        return null;
    }
}

module.exports = get_first_cookie;