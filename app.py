from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# OpenAI API 配置
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_API_BASE = os.environ.get("OPENAI_API_BASE", "https://api.openai.com/v1")

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
        
        # 直接使用 requests 调用 OpenAI API
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "gpt-4.1-mini",
            "messages": [
                {"role": "system", "content": "你是一个友好的 AI 助手，用中文回答问题。"},
                {"role": "user", "content": user_message}
            ],
            "temperature": 0.7,
            "max_tokens": 1000
        }
        
        response = requests.post(
            f"{OPENAI_API_BASE}/chat/completions",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            reply = result['choices'][0]['message']['content']
            
            return jsonify({
                'reply': reply,
                'status': 'success'
            })
        else:
            return jsonify({
                'error': f'API 请求失败: {response.status_code}',
                'status': 'error'
            }), 500
    
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
