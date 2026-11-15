# Task Sprite website

正式路径：https://tbtparent.me/task-sprite/

连续滚动的静态官网，保留现有像素角色和交互演示。浏览器端无运行时第三方依赖，读取`releases/latest.json`提供实际可用平台的版本、文件大小、SHA-256和OSS下载链接。某平台没有已验证安装包时不会显示占位下载链接。页脚保留品牌与服务/隐私链接。

```sh
npm ci
npm test
npm run check
npm run build
npm run dev
```

构建输出`dist/`；本机预览http://127.0.0.1:4173。演示仅使用页面内存中的示例任务，不读取本机真实任务。

## 发布版本

私有环境参考`.env.example`，不要提交真实密钥。发布输入JSON包含`version`、固定的`publishedAt`、`notes`及`assets`（platform、arch、filename）。本地安装包必须已经完成对应系统验证；脚本计算大小和SHA-256，上传不可覆盖的固定版本对象，逐个读取校验，最后才更新最新版本清单。

```sh
node scripts/publish-release.mjs /private/path/release-input.json /private/path/packages /private/path/oss.env
node scripts/publish-release.mjs --rollback=0.2.0 /private/path/packages /private/path/oss.env
```

仅用于公开下载的安装包和版本JSON具有公开读取权限，不改变现有业务对象权限。回退先验证历史版本安装包，再切换最新版本指针。不要把访问密钥写入网页或版本JSON。

服务器将`/task-sprite/`映射到本项目静态构建，将`/task-sprite/releases/latest.json`代理到OSS清单；`/task-sprite/api/`由独立API路由处理。更新时保留旧静态版本和Nginx配置，以便回退。
