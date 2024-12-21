const uploadBtn = document.getElementById("upload-btn")
const fileInput = document.getElementById("file-upload")
const spinner = uploadBtn.querySelector(".spinner")
const buttonText = uploadBtn.querySelector(".button-text")
const exitFullscreenBtn = document.querySelector("#chat-options .exit-fullscreen")
const chatMessagesEle = document.getElementById("chat-messages")

// upload section
const notice = (msg, success) => {
   const statusMessage = document.getElementById("status-message")
   statusMessage.classList.remove("success")
   if (success) {
      statusMessage.classList.add("success")
   }
   const statusMessageContent = statusMessage.querySelector(".content")
   if (msg && msg.length > 0) {
      statusMessage.hidden = false
      statusMessageContent.textContent = msg.length > 200 ? `${msg.slice(0, 200)} ...` : msg
   } else {
      statusMessage.hidden = true
   }
}

const initListeners = () => {
   uploadBtn.addEventListener("click", async (e) => {
      e.preventDefault()

      if (!fileInput.files.length) {
         notice("Please select a file to upload.", false)
         return
      }

      const file = fileInput.files[0]
      const formData = new FormData()
      formData.append("file", file)

      // Hiển thị spinner
      spinner.hidden = false
      buttonText.hidden = true

      try {
         const response = await fetch("/upload", {
            method: "POST",
            body: formData,
         })

         if (response.ok) {
            notice("File uploaded successfully!", true)

            // Thêm file mới vào danh sách
            const fileList = document.getElementById("files-list")
            const newFile = document.createElement("li")
            newFile.innerHTML = `<a href="/download/${file.name}">${file.name}</a>`
            fileList.appendChild(newFile)
         } else {
            const errorText = await response.text()
            notice(`Upload failed: ${errorText}`, false)
         }
      } catch (error) {
         notice("An error occurred during the upload.", false)
      } finally {
         // Ẩn spinner
         spinner.hidden = true
         buttonText.hidden = false
      }
   })

   document.addEventListener("fullscreenchange", () => {
      if (document.fullscreenElement) {
         exitFullscreenBtn.hidden = false
      } else {
         exitFullscreenBtn.hidden = true
      }
   })
}
initListeners()

const attachImages = (img_url) => {
   const imgWrapper = document.createElement("div")
   imgWrapper.classList.add("img-message-wrapper")
   const imgEle = document.createElement("img")
   imgEle.classList.add("img-message")
   imgEle.src = img_url
   imgEle.alt = "Image Message"

   imgWrapper.appendChild(imgEle)
   chatMessagesEle.appendChild(imgWrapper)
}

// chatting section
class ChatSocket {
   #socket = null

   constructor(namespace) {
      this.#socket = io(namespace)
      this.#registerListeners()
   }

   sendMessage(message, callback) {
      this.#socket.emit(
         "send_message",
         { sender_id: getLocalUserId(), content: message },
         (res) => {
            if (callback) {
               callback(res)
            }
         }
      )
   }

   sendMedia(files, callback) {
      this.#socket.emit("send_media", { sender_id: getLocalUserId(), media_list: files }, (res) => {
         if (callback) {
            callback(res)
         }
      })
   }

   #registerListeners() {
      // Hiển thị tất cả tin nhắn khi client tải lại trang
      this.#socket.on("load_messages", (messages) => {
         chatMessagesEle.innerHTML = "" // Xóa danh sách hiện tại
         const userId = getLocalUserId()
         for (const message of messages) {
            chatMessagesEle.appendChild(
               createMessageTextBar(
                  userId,
                  message.content,
                  message.sender_id,
                  dayjs(message.timestamp).format("HH:mm")
               )
            )
         }
         scrollToBottomMessage()
      })

      // Xử lý sự kiện message từ namespace /chat
      this.#socket.on("message", (data) => {
         chatMessagesEle.appendChild(
            createMessageTextBar(
               data.sender_id,
               data.content,
               getLocalUserId(),
               dayjs(data.timestamp).format("HH:mm")
            )
         )
         scrollToBottomMessage()
      })

      // Cập nhật trạng thái các client trong mạng
      this.#socket.on("clients_update", (data) => {
         const { total_clients, file_URLs } = data
         if (total_clients) {
            document.getElementById("clients-state").textContent = `Total connected clients: ${
               total_clients || 0
            }`
         }
         if (file_URLs) {
            for (const file_URL of file_URLs) {
               attachImages(file_URL)
            }
         }
      })
   }
}

const chatSocket = new ChatSocket("/chatting")

const scrollToBottomMessage = () => {
   const messagesList = document.getElementById("chat-messages-wrapper")
   messagesList.scrollTop = messagesList.scrollHeight
}

const createMessageTextBar = (userId, messageContent, senderId, timestamp) => {
   const msgTimestampEle = document.createElement("span")
   msgTimestampEle.className = "msg-timestamp"
   msgTimestampEle.textContent = timestamp
   const newMessage = document.createElement("li")
   newMessage.className = "message-text-bar"
   if (userId === senderId) {
      newMessage.classList.add("self")
   }
   newMessage.innerHTML = `<span class="content">${messageContent}</span>`
   newMessage.appendChild(msgTimestampEle)
   return newMessage
}

const pickMediaInChatting = (target) => {
   const files = target.files
   if (files && files.length > 0) {
      const fileList = []
      // Đọc từng file và mã hóa nội dung thành Base64
      Promise.all(
         Array.from(files).map((file) => {
            return new Promise((resolve, reject) => {
               const reader = new FileReader()
               reader.onload = () => {
                  fileList.push({
                     file_name: file.name,
                     file_content: reader.result.split(",")[1], // Lấy nội dung base64
                  })
                  resolve()
               }
               reader.onerror = reject
               reader.readAsDataURL(file)
            })
         })
      )
         .then(() => {
            chatSocket.sendMedia(fileList)
         })
         .catch((err) => {
            alert("Lỗi khi đọc file")
         })
   }
}

// Gửi tin nhắn tới namespace /chat
const sendMessageHandler = (target) => {
   const input = target
      .closest(".message-input-container")
      .querySelector("textarea[name='message']")
   const message = input.value
   if (message) {
      if (message.trim().length > 0) {
         chatSocket.sendMessage(message)
      }
      input.value = ""
   }
}

const showNotepadModalHandler = () => {
   const modalEle = document.getElementById("notepad-modal")
   const showModal = modalEle.getAttribute("data-show-modal") === "true"
   modalEle.hidden = showModal
   modalEle.setAttribute("data-show-modal", `${!showModal}`)
   if (!showModal) {
      document.body.style.overflow = "hidden"
   } else {
      document.body.style.overflow = "auto"
   }
}

const switchRoutes = (route) => {
   const coinsEle = document.querySelector("#switch-btns .coins")
   coinsEle.classList.toggle("flipped")
   const routesEle = document.querySelectorAll("main .route")
   for (const routeEle of routesEle) {
      routeEle.hidden = true
   }
   document.querySelector("main .route." + route).hidden = false
}

const handleFullscreenChatBox = () => {
   const chatBox = document.getElementById("chat-box")
   if (document.fullscreenElement) {
      // Thoát khỏi chế độ toàn màn hình
      exitFullscreenBtn.hidden = true
      document.exitFullscreen()
   } else {
      // Kích hoạt chế độ toàn màn hình
      chatBox
         .requestFullscreen()
         .then(() => {
            exitFullscreenBtn.hidden = false
         })
         .catch((err) => {
            alert(`Lỗi: Không thể chuyển sang toàn màn hình! ${err.message}`)
         })
   }
}

const showMoreOptionsList = () => {
   const moreOptionsList = document.getElementById("more-options-list")
   moreOptionsList.classList.toggle("active")
}

const catchEnter = (e) => {
   const key = e.key
   if (key === "Enter") {
      e.preventDefault()
      sendMessageHandler(e.target)
   }
}
