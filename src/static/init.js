function generateRandomString(length) {
   const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
   let result = ""
   for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length))
   }
   return result
}

function generateSecureRandomString(length) {
   const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
   const array = new Uint8Array(length)
   crypto.getRandomValues(array)
   return Array.from(array, (byte) => characters[byte % characters.length]).join("")
}

const getLocalUserId = () => {
   return localStorage.getItem("ipvcns-user-id") || ""
}

const setLocalUserId = (userId) => {
   localStorage.setItem("ipvcns-user-id", userId)
}

const initLocalUserId = () => {
   const userId = getLocalUserId()
   if (userId && userId.length > 0) return
   const userIdLen = 24
   if (crypto && crypto.getRandomValues) {
      setLocalUserId(generateSecureRandomString(userIdLen))
   } else {
      setLocalUserId(generateRandomString(userIdLen))
   }
}
initLocalUserId()
