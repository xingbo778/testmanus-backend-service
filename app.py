from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
import os

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 初始化 OpenAI 客户端 - 显式指定参数避免兼容性问题
client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY")
)

@app.route('/api/chat', methods=['POST'])
def chat():
    """
    处理聊天请求，将消息转发给 LLM
    """
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        
        if not user_message:
            return jsonify({'error': '消息不能为空'}), 400
        
        # 调用 OpenAI API
        response = client.chat.completions.create(
            model="gpt-4.1-mini",  # 使用可用的模型
            messages=[
                {"role": "system", "content": "你是一个友好的 AI 助手，用中文回答问题。"},
                {"role": "user", "content": user_message}
            ],
            temperature=0.7,
            max_tokens=1000
        )
        
        # 提取回复内容
        reply = response.choices[0].message.content
        
        return jsonify({
            'reply': reply,
            'status': 'success'
        })
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({
            'error': f'处理请求时出错: {str(e)}',
            'status': 'error'
        }), 500

@app.route('/api/health', methods=['GET'])
def health():
    """
    健康检查端点
    """
    return jsonify({
        'status': 'healthy',
        'service': 'testmanus-backend-service'
    })

@app.route('/', methods=['GET'])
def index():
    """
    根路径
    """
    return jsonify({
        'service': 'testmanus-backend-service',
        'version': '1.0.0',
        'endpoints': {
            'chat': '/api/chat (POST)',
            'health': '/api/health (GET)'
        }
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
