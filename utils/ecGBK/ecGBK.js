const ecGBKToUnicode = require('./ecGBKToUnicode.js')
const ecUnicodeToGBK = require('./ecUnicodeToGBK.js')

const ecGBKBytesToStr = gbkBytes => {
    let gbkStr = ''
    for (let i = 0; i < gbkBytes.length; i++) {
        if (gbkBytes[i] <= 0x7f) {
            gbkStr += String.fromCharCode(gbkBytes[i])
        } else {
            if (i === (gbkBytes.length - 1)) {

            } else {
                let code = ecGBKToUnicode.table[gbkBytes[i] * 256 + gbkBytes[i + 1]]
                gbkStr += String.fromCharCode(code)
                i++
            }
        }
    }
    return gbkStr
}

const ecStrToGBKBytes = str => {
    let bytes = []
    for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i)
        if (code <= 0x7f) {
            bytes.push(code)
        } else {
            let gbkHexStr = ecUnicodeToGBK.table[code]
            if (gbkHexStr) {
                bytes.push(parseInt(gbkHexStr.substr(0, 2), 16))
                bytes.push(parseInt(gbkHexStr.substr(2, 2), 16))
            }
        }
    }
    return bytes;
}

module.exports = {
    ecGBKBytesToStr,
    ecStrToGBKBytes,
}
