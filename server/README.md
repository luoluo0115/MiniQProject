# 小Q学习服务（MVP）

这一服务先把最关键的闭环落地：本地绘本/音频/动画入库、自动生成每日计划、记录学习事件、按艾宾浩斯节奏复习单词，以及打印/下载单词表。数据目前使用 SQLite，表结构保持常规关系模型，正式上线可迁移到 PostgreSQL。

## 快速启动

要求 Node.js 22.5+（使用内置 `node:sqlite`，不需要安装第三方依赖）。

```bash
cd englishLearn/server
cp .env.example .env
npm run init
npm run seed
npm start
```

服务默认运行在 `http://localhost:8787`，打开根地址会看到服务导航页，也可以通过 `/prototype` 查看高保真原型。体验账号 `userId=1`。启动脚本会读取本目录 `.env`（文件不存在时使用默认值）。

## 内容管理后台（第二阶段）

打开 `http://localhost:8787/admin`。本地初始管理口令是 `.env` 中的 `ADMIN_TOKEN`，示例值为 `miniq-local-admin`。后台现已支持：

- 同一内容批次上传绘本、配套音频、动画和封面；
- SHA-256 校验、类型/Level 初步分类和媒体自动归组；
- 上传批次、处理进度、错误原因和失败重试；
- 内容信息编辑、媒体预览、版权确认、审核发布或驳回；
- 未确认版权的内容禁止发布，未发布内容不会进入孩子的每日计划。

当前浏览器上传为了保持零依赖，使用 Base64 JSON，单文件限制 25MB。正式生产应改为对象存储直传和分片上传；SQLite 保存结构化数据，媒体文件应迁移到 S3、R2 或云存储。`ADMIN_TOKEN` 只是本地 MVP 保护，公网部署前必须换成正式管理员账号、密码哈希、会话和权限系统。

## RAZ / 牛津树整套书库导入（第三阶段）

在管理后台选择“整套书库导入”，可以直接选择包含所有子目录的本地文件夹，不需要按一本书重新整理。浏览器会保留每个文件的相对路径，并通过文件流逐个上传，默认单文件上限由 `MAX_LIBRARY_FILE_MB` 控制（本地默认 2048MB）。

自动分析目前支持：

- 识别 RAZ / Reading A-Z 与 Oxford Reading Tree；
- 从路径识别 RAZ AA–Z2、Oxford Stage/Level，并映射到小Q内部 Level；
- 标准化文件名，去除 audio、video、cover、narration 等资源后缀；
- 将同一本书的 PDF/EPUB、音频、动画和图片自动归组；
- 标记缺文档、低置信度和重复文件，输出导入报告；
- 高置信度绘本一键批量审核发布，异常项逐本修改后发布；
- 媒体按校验和去重，共享文件仍通过关系表挂载到正确内容。

推荐直接保留你已有的目录。例如：

```text
RAZ-H/
  All About Spiders/
    All About Spiders.pdf
    All About Spiders Audio.mp3
    All About Spiders Video.mp4
  Amazing Ants/
    Amazing Ants.pdf
    Amazing Ants.mp3
```

如果同一本书的 PDF、音频和视频分散在 `PDF/Audio/Video` 目录，只要文件名主体一致也会自动归组。当前浏览器端会逐文件上传，刷新或关闭页面会中止尚未上传的文件；已经完成的文件会保留。生产环境的大型远程部署仍建议升级为对象存储分片直传和断点续传。

## 本地内容自动入库

每套内容放在 `content-library` 的一个一级子目录中，绘本、配套音频、视频和封面放在同一目录。可以复制 `manifest.example.json` 为该目录内的 `manifest.json`。没有清单时，系统会根据目录名、扩展名和路径中的 Level 自动生成基础分类。

```text
content-library/
  Level-A-Hello-Animals/
    manifest.json
    book.pdf
    narration.mp3
    animation.mp4
    cover.jpg
```

执行 `npm run sync` 或调用 `POST /api/content/sync`；需要持续自动同步时运行 `npm run watch`，目录变化会合并防抖后入库。文件按 SHA-256 去重并复制到托管目录。没有明确标注版权及审核状态的内容只会进入 `pending`，不会进入孩子的自动学习计划。

## 核心接口

- `GET /api/plans/today?userId=1`：生成或读取当天计划（幂等）。
- `GET /api/words/due?userId=1`：读取到期单词。
- `POST /api/words/:wordId/review`：提交 `reviewUuid/userId/grade(1-4)`，重复提交不会重复计算。
- `POST /api/events`：记录统一学习事件，可携带 `metadata.taskProgress/taskCompleted`。
- `POST /api/sessions/start`、`POST /api/sessions/:id/finish`：记录一次学习会话和有效时长，并更新内容/计划进度。
- `GET /api/dashboard/summary?userId=1&date=2026-08-13`：读取当天聚合指标。
- `GET /api/words/export.csv?userId=1`：下载 Excel 可打开的 UTF-8 CSV。
- `GET /api/words/print?userId=1`：打开 A4 排版页，打印或另存为 PDF。
- `POST /api/realtime/session`：后端用孩子、场景和安全规则换取 Realtime WebRTC SDP；密钥不下发客户端。

管理接口需要请求头 `X-Admin-Token`：

- `POST /api/admin/batches`：创建上传批次；
- `POST /api/admin/batches/:id/files`：逐个上传文件；
- `POST /api/admin/batches/:id/finalize`：完成上传并创建解析任务；
- `GET /api/admin/jobs`、`POST /api/admin/jobs/:id/retry`：查询和重试任务；
- `PATCH /api/admin/content/:id`：修改自动分类结果；
- `POST /api/admin/content/:id/review`：`approve/reject/unpublish` 审核操作。
- `POST /api/admin/libraries`：创建整套书库导入；
- `POST /api/admin/libraries/:id/files/raw`：保留相对路径的流式文件上传；
- `POST /api/admin/libraries/:id/analyze`：自动识别系列、拆书与配套匹配；
- `GET /api/admin/libraries/:id`：读取导入报告和单本匹配结果；
- `POST /api/admin/libraries/:id/approve`：批量或按书审核发布。

## Realtime 接入边界

客户端创建 WebRTC offer 后，将 `{ userId, sceneId, sdp }` 发送给本服务。本服务调用 OpenAI Realtime API 并将 answer SDP 返回。生产环境还需补齐家长同意、儿童隐私与数据保留策略、内容过滤、敏感事件告警、用量和时长上限；面向 13 岁以下儿童处理个人数据前需要完成 OpenAI 的相关合规流程。

## 下一阶段

当前处理任务已经具备异步状态、进度、失败恢复和重启续跑，但分类器暂时只处理可靠的文件与清单元数据。下一迭代可把 OCR、语音转写、绘本页/时间轴对齐、词汇抽取接入同一任务流水线，并保持人工审核后发布。每日计划当前为可解释规则引擎 `rules-v1`，积累学习数据后再升级为个性化排序模型。
