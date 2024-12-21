from flask import (
    Flask,
    render_template,
    request,
    Response,
    jsonify,
)
import os
from configs import STORAGE_FOLDER, UI_PAGE
from utils import write_message_mode_w
from flask_socketio import SocketIO, emit, send, Namespace
from datetime import datetime
import base64
from werkzeug.utils import secure_filename


app = Flask(__name__)
app.config["SECRET_KEY"] = "yuukdGtne040oe5QwxhWnF0Y"
socketio = SocketIO(app, max_http_buffer_size=50 * 1024 * 1024)  # 50 MB


@app.route("/")
def index():
    files = os.listdir(STORAGE_FOLDER)
    write_message_mode_w("Ready!")
    return render_template(UI_PAGE, files=files)


@app.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return "No file part", 400
    file = request.files["file"]
    filename = file.filename
    if filename == "":
        return "No selected file", 400
    file.save(os.path.join(STORAGE_FOLDER, filename))
    write_message_mode_w(f"Just upload! File: {filename}")
    return jsonify({"success": True}), 200


@app.route("/download/<filename>")
def download_file(filename):
    file_path = os.path.join(STORAGE_FOLDER, filename)
    if not os.path.exists(file_path):
        return "File not found", 404

    def generate():
        with open(file_path, "rb") as file:
            while chunk := file.read(4096):  # Đọc tệp từng khối 4KB
                yield chunk

    # Trả về tệp dưới dạng luồng dữ liệu
    write_message_mode_w(f"Just download! File: {filename}")
    return Response(
        generate(),
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "application/octet-stream",
        },
    )


# Chatting section
class ChatMessage:
    def __init__(self, sender_id, content, img_url):
        self.sender_id = sender_id  # Người gửi tin nhắn
        self.content = content  # Nội dung tin nhắn
        self.timestamp = datetime.now()  # Thời gian gửi tin nhắn
        self.img = img_url

    def to_dict(self):
        return {
            "sender_id": self.sender_id,
            "content": self.content,
            "timestamp": self.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "img": self.img,
        }


class ConnectedClient:
    def __init__(self, socket_id, client_ip):
        self.socket_id = socket_id
        self.client_ip = client_ip

    def to_dict(self):
        return {
            "socket_id": self.socket_id,
            "client_ip": self.client_ip,
        }


# Biến lưu trữ tất cả tin nhắn
chat_messages = []
chat_clients = []


# Namespace cho "chat"
class ChatNamespace(Namespace):
    def on_connect(self):
        # Đưa socket mới vào danh sách kết nối
        socket_id = request.sid
        exists = False
        if socket_id:
            for client in chat_clients:
                if client.socket_id == socket_id:
                    exists = True
        if not exists:
            client_ip = request.remote_addr
            chat_clients.append(ConnectedClient(socket_id, client_ip))
        # Gửi tất cả tin nhắn đã lưu tới client khi họ kết nối
        emit("load_messages", [message.to_dict() for message in chat_messages])
        emit("clients_update", {"total_clients": len(chat_clients)}, broadcast=True)

    def on_disconnect(self):
        socket_id = request.sid
        if socket_id:
            for client in chat_clients:
                if client.socket_id == socket_id:
                    chat_clients.remove(client)
        emit("clients_update", {"total_clients": len(chat_clients)}, broadcast=True)

    def on_send_message(self, data):
        # Lưu tin nhắn mới
        sender_id = data.get("sender_id", "Anonymous")
        content = data.get("content", None)
        mediaList = data.get("media_list", None)
        if not content or not mediaList:
            emit("warning", "Tin nhắn không có nội dung!")
        if mediaList:
            mediaListLen = len(mediaList)
            if mediaListLen and mediaListLen > 0:
                file_paths = []
                for media in mediaList:
                    filename = media.get("file_name", "unknown")
                    file_content = media.get("file_content", None)

                    if not file_content:
                        continue  # Bỏ qua file nếu không có nội dung

                    # Lưu file vào thư mục uploads
                    safe_filename = secure_filename(filename)
                    file_path = os.path.join(STORAGE_FOLDER, safe_filename)

                    # Ghi nội dung file vào file trên server
                    with open(file_path, "wb") as f:
                        f.write(base64.b64decode(file_content))
                        chat_messages.append(ChatMessage(sender_id, content, file_path))
                        file_paths.append(file_path)

                emit("clients_update", {"file_URLs": file_paths}, broadcast=True)
        else:
            new_message = ChatMessage(sender_id, content, None)
            chat_messages.append(new_message)
        # Gửi tin nhắn mới tới tất cả client
        send(new_message.to_dict(), broadcast=True)

    def on_send_media(self, data):
        mediaList = data.get("media_list", None)
        if mediaList:
            mediaListLen = len(mediaList)
            if mediaListLen and mediaListLen > 0:
                file_paths = []
                for media in mediaList:
                    filename = media.get("file_name", "unknown")
                    file_content = media.get("file_content", None)

                    if not file_content:
                        continue  # Bỏ qua file nếu không có nội dung

                    # Lưu file vào thư mục uploads
                    safe_filename = secure_filename(filename)
                    file_path = os.path.join(STORAGE_FOLDER, safe_filename)

                    # Ghi nội dung file vào file trên server
                    with open(file_path, "wb") as f:
                        f.write(base64.b64decode(file_content))
                        file_paths.append(file_path)

                emit("clients_update", {"file_URLs": file_paths}, broadcast=True)


socketio.on_namespace(ChatNamespace("/chatting"))


# Xử lý lỗi 404
@app.errorhandler(404)
def not_found_error(error):
    return render_template("404.html"), 404


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)
