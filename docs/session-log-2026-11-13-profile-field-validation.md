# 会话日志

> 生成时间：2026-11-13
> 项目：HiGo-Backend（Node.js / ES Module）
> 主题：用户资料修改接口字段校验补强（nickname 长度与字符白名单、birthday 日期上限与真实性校验）

---

## 一、会话概览

本次会话针对 `POST /api/v1/user/profile` 的字段校验缺口做补强，共三件事：

1. **nickname 补齐校验**：此前仅有「trim 后非空」一条规则，任意长度、任意字符都能入库；现补充长度 1-50 与字符白名单。
2. **birthday 增加上限**：生日必须严格早于「今天」（不含今天），避免用户填未来日期。
3. **birthday 增加真实性校验**：拦截 `2025-02-31`、`2023-02-29` 这类格式合法但日历上不存在的日期，避免落到 MySQL `DATE` 列时才报错。

校验规则与错误提示同步更新到接口文档 `docs/用户资料修改接口.md`。

---

## 二、修改文件

| 文件 | 说明 |
| --- | --- |
| `src/services/user-service.js` | 新增 nickname 校验常量、`todayDateString()`、`isRealDate()`，改造 nickname / birthday 校验分支，更新 JSDoc |
| `docs/用户资料修改接口.md` | 第 3.1 节校验规则表同步 nickname 与 birthday 的新规则 |

---

## 三、nickname 校验

### 1. 规则

| 校验项 | 规则 | 失败提示 |
| --- | --- | --- |
| 非空 | trim 后不能为空 | 400 `昵称不能为空` |
| 长度 | 1-50 个字符 | 400 `昵称长度需为 1-50 个字符` |
| 字符集 | 仅允许中文、大小写字母、数字、下划线 `_`、连字符 `-` | 400 `昵称只能包含中文、字母、数字、下划线和连字符` |

正则（与密码字符集保持一致）：

```js
const NICKNAME_PATTERN = /^[\u4e00-\u9fa5A-Za-z0-9_-]+$/;
const NICKNAME_MIN_LENGTH = 1;
const NICKNAME_MAX_LENGTH = 50;
```

### 2. 实现位置

在 `updateProfile` 的 `PROFILE_FIELDS` 循环中，`nickname` 走文本分支，校验顺序为：非空 → 长度 → 字符白名单，全部通过后才拼入 `SET` 子句。

### 3. 影响

- 空格、Emoji 及其他标点现在会被拒绝，前端如有输入限制需同步（例如昵称输入框 `maxlength=50` 并提示字符集）。
- 仅影响更新接口，历史已存数据不受影响。

---

## 四、birthday 校验

### 1. 规则

| 校验项 | 规则 | 失败提示 |
| --- | --- | --- |
| 格式 | 非空时须匹配 `^\d{4}-\d{2}-\d{2}$`（YYYY-MM-DD） | 400 `生日格式应为 YYYY-MM-DD` |
| 真实性 | 必须是真实存在的日历日期 | 400 `生日不是有效日期` |
| 上限 | 必须严格早于今天（不含今天） | 400 `生日必须早于今天` |
| 空值 | 允许空串，写入 `NULL` | — |

### 2. 「今天」的时区口径

`todayDateString()` 固定按 **Asia/Shanghai** 时区取当天日期（`YYYY-MM-DD`）：

```js
new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
```

这样即使服务器运行在 UTC 时区，也不会在跨日 8 小时窗口内把「昨天」当成「今天」。

### 3. 真实日期校验实现

```js
function isRealDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(2000, month - 1, day));
  date.setUTCFullYear(year);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
```

- 先用 `Date.UTC` 构造，再用 `setUTCFullYear` 回填年份，规避 `Date.UTC` 对 0-99 年自动加 1900 的问题。
- 溢出日期（如 2 月 31 日）会被 JS 顺延到 3 月，回读年月日与输入不一致即判定非法。

### 4. 校验顺序

格式 → 真实性 → 早于今天。三步全部通过才进入写库阶段。

---

## 五、验证

- `node --check src/services/user-service.js` 通过。
- `isRealDate` 用例验证：

| 输入 | 期望 | 结果 |
| --- | --- | --- |
| `1995-06-15` | 合法 | 通过 |
| `2024-02-29` | 合法（闰年） | 通过 |
| `2025-02-31` | 非法 | 拦截 |
| `2023-02-29` | 非法（平年） | 拦截 |
| `1995-13-01` | 非法（月份越界） | 拦截 |
| `1995-00-10` | 非法（月份为 0） | 拦截 |
| `1995-04-31` | 非法（4 月无 31 日） | 拦截 |

- `todayDateString()` 实测输出 `2026-11-13`，格式与生日字符串可直接做字典序比较。
- 本地 MySQL 未启动（`127.0.0.1:3306` 连接被拒），本次未做接口级联调；校验逻辑为纯函数 + 语法校验覆盖。

---

## 六、注意事项与后续

- **写库原子性**：新增校验仍位于 `updateProfile` 的第一阶段（只校验、不写库），部分更新不会出现前几个字段已落库、后续字段报错的情况。
- **前端同步**：前端生日选择器需限制最大可选日期为「昨天」，昵称输入需限制 50 字并过滤非法字符，避免提交后才报 400。
- **历史数据**：已存在的昵称/生日不做回刷；如后续需要收敛历史数据，需单独做数据巡检。
- **可选加固**：如需支持外籍用户或特殊昵称（含空格、Emoji），需调整 `NICKNAME_PATTERN` 并同步前端提示文案。
