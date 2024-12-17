from datetime import datetime
from configs import MESSAGE_FILE_PATH


def write_message_mode_w(fileServerMsg, file=None):
    # Mở (hoặc tạo mới nếu không tồn tại) file và ghi dữ liệu vào
    current_time = datetime.now()
    formatted_time = current_time.strftime("%d/%m/%Y %H:%M:%S")
    formatted_content = f"""
    ### File Server:
        - Time: {formatted_time}, IP: {formatted_time}, Message: "{fileServerMsg}".
    """
    final_content = formatted_content.strip()
    if file:
        file.write(final_content)
    else:
        try:
            with open(MESSAGE_FILE_PATH, "a", encoding="utf-8") as file:
                file.write(final_content)
        except PermissionError:
            print(">>> Bạn không có quyền truy cập file!")
