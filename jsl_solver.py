import re
import subprocess

import execjs
import requests
from bs4 import BeautifulSoup

HEADER = {
    "Host": "www.mps.gov.cn",
    "Connection": "keep-alive",
    "sec-ch-ua": '"Chromium";v="152", "Not?A_Brand";v="24", "Google Chrome";v="152"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-User": "?1",
    "Sec-Fetch-Dest": "document",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language": "zh-CN,zh;q=0.9,ms;q=0.9",
}

URL = "https://www.mps.gov.cn/index.html"
session = requests.session()
session.headers.update(HEADER)


def get_scripts(text):
    """返回页面里所有 <script> 文本"""
    return [s.text for s in BeautifulSoup(text, "html.parser").find_all("script")]


def is_challenge_page(resp):
    """判断是否还是加速乐验证页：非 200 状态码，或正文里含验证脚本特征"""
    if resp.status_code != 200:
        return True
    head = resp.text[:5000]
    return "document.cookie" in head or "function hash" in head


# ========== ① 第一次请求：抓 __jsluid_s + 第一段脚本 ==========
response = session.get(URL)
print("①第一次请求:", response.status_code, "| set-cookie:", session.cookies.get_dict())

jsuid = session.cookies.get("__jsluid_s")   # ← 服务器下发的 uid，后面全流程都要带
scripts = get_scripts(response.text)
if not scripts:
    raise SystemExit("第一次响应里没有脚本，页面可能不是验证页：" + response.text[:200])
with open("challenge1_raw.js", "w", encoding="utf-8") as f:
    f.write(scripts[0])

# ========== ② 第一段：execjs 算出 |-1| clearance ==========
with open("challenge1_solver.js", "r", encoding="utf-8") as f:
    ctx = execjs.compile(f.read())
clearance1 = ctx.call("get_first_cookie")
print("②第一段 clearance:", clearance1)
session.cookies.set("__jsl_clearance_s", clearance1, domain="www.mps.gov.cn", path="/")

# ========== ③ 带 jsuid+clearance1 请求：拿第二段脚本 ==========
response2 = session.get(URL)
print("③第二次请求:", response2.status_code)

if not is_challenge_page(response2):
    print("[OK] 第二段就放行了，正文已存 result.html")
    with open("result.html", "w", encoding="utf-8") as f:
        f.write(response2.text)
    raise SystemExit(0)

scripts2 = get_scripts(response2.text)
if not scripts2:
    raise SystemExit("第二次响应是验证页但没抓到 <script>：" + response2.text[:200])
with open("challenge2_raw.js", "w", encoding="utf-8") as f:
    f.write(scripts2[0])
print("③ 第二段脚本已存 challenge2_raw.js, 长度:", len(scripts2[0]))

# ========== ④ 用 node 跑 challenge2_solver.js，破解出最终 |0| clearance ==========
result = subprocess.run(["node", "challenge2_solver.js"], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30)
m = re.search(r"__jsl_clearance_s=([^;\s]+)", result.stdout)
if not m:
    print("[WARN] challenge2_solver.js 没输出最终 cookie，完整输出如下：")
    print(result.stdout)
    raise SystemExit(1)
clearance_final = m.group(1)
print("④最终 clearance:", clearance_final)

# ========== ⑤ 带 jsuid + 最终 clearance 请求验证 ==========
session.cookies.set("__jsl_clearance_s", clearance_final, domain="www.mps.gov.cn", path="/")
response3 = session.get(URL)
ok = not is_challenge_page(response3)
print("⑤第三次请求:", response3.status_code, "| 放行:", ok, "| 长度:", len(response3.text))
if ok:
    with open("result.html", "w", encoding="utf-8") as f:
        f.write(response3.text)
    print("[OK] 正文已存 result.html")
else:
    print("[WARN] 仍未放行，响应前300字:", response3.text[:300])