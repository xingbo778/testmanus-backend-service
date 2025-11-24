# Testmanus Backend Service

这是一个简单的后端服务，用于将前端聊天消息转发给 LLM（大语言模型）。

## 功能

- 接收前端发送的聊天消息
- 将消息转发给 OpenAI API
- 返回 AI 的回复给前端

## 技术栈

- **Flask**: Python Web 框架
- **Flask-CORS**: 处理跨域请求
- **OpenAI**: 调用 LLM API
- **Gunicorn**: 生产环境 WSGI 服务器

## API 端点

### POST /api/chat

接收聊天消息并返回 AI 回复。

**请求体**:
```json
{
  "message": "你好"
}
```

**响应**:
```json
{
  "reply": "你好！有什么可以帮助你的吗？",
  "status": "success"
}
```

### GET /api/health

健康检查端点。

**响应**:
```json
{
  "status": "healthy",
  "service": "testmanus-backend-service"
}
```

## 本地开发

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 设置环境变量

```bash
export OPENAI_API_KEY="your-api-key-here"
```

### 3. 运行服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动。

## 部署

### 使用 Gunicorn

```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### 环境变量

- `OPENAI_API_KEY`: OpenAI API 密钥（必需）
- `OPENAI_BASE_URL`: OpenAI API 基础 URL（可选，已在环境中预配置）
- `PORT`: 服务端口（默认: 5000）

## 部署建议

### 选项 1: Railway

1. 在 Railway 创建新项目
2. 连接此 GitHub 仓库
3. 添加环境变量 `OPENAI_API_KEY`
4. Railway 会自动检测并部署 Flask 应用

### 选项 2: Render

1. 在 Render 创建新 Web Service
2. 连接此 GitHub 仓库
3. 设置构建命令: `pip install -r requirements.txt`
4. 设置启动命令: `gunicorn app:app`
5. 添加环境变量 `OPENAI_API_KEY`

### 选项 3: Heroku

1. 创建 `Procfile` 文件（已包含）
2. 使用 Heroku CLI 部署
3. 设置环境变量

### 选项 4: Docker

```bash
docker build -t testmanus-backend .
docker run -p 5000:5000 -e OPENAI_API_KEY=your-key testmanus-backend
```

## 注意事项

- 确保设置了正确的 `OPENAI_API_KEY` 环境变量
- 生产环境建议使用 HTTPS
- 考虑添加速率限制以防止滥用
- 建议添加日志记录和监控

## 许可证

MIT
