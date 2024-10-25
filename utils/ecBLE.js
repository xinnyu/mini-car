const regeneratorRuntime = require('./regenerator/runtime.js')
const ecGBK = require('./ecGBK/ecGBK.js')

const logEnable = true

let isAndroid = false

const ECBLEChineseTypeUTF8 = "utf8"
const ECBLEChineseTypeGBK = "gbk"
let ecBLEChineseType = ECBLEChineseTypeGBK
const setChineseType = (typeStr)=>{
    if(typeStr===ECBLEChineseTypeGBK){
        ecBLEChineseType = ECBLEChineseTypeGBK
    }else{
        ecBLEChineseType = ECBLEChineseTypeUTF8
    }
}

let ecBluetoothAdapterStateChangeCallback = () => { }
let ecBLEConnectionStateChangeCallback = () => { }

let ecDeviceId = ''

let ecGattServerUUID = ''
const ecGattServerUUIDOption1 = '0000FFF0-0000-1000-8000-00805F9B34FB'
const ecGattServerUUIDOption2 = 'FFF0'
let ecGattCharacteristicWriteUUID = ''
const ecGattCharacteristicWriteUUIDOption1 = '0000FFF2-0000-1000-8000-00805F9B34FB'
const ecGattCharacteristicWriteUUIDOption2 = 'FFF2'

const log = data => {
    if (logEnable) {
        console.log('[eciot]:' + JSON.stringify(data))
    }
}

const onBluetoothAdapterStateChange = cb => {
    ecBluetoothAdapterStateChangeCallback = cb
}
const getSetting = () => {
    return new Promise(function (resolve, reject) {
        wx.getSetting({
            success(res) {
                log(res)
                if (res.authSetting && res.authSetting['scope.bluetooth']) {
                    resolve({ ok: true, errCode: 0, errMsg: '' })
                } else {
                    resolve({
                        ok: false,
                        errCode: 30001,
                        errMsg: 'getSetting fail',
                    })
                }
            },
            fail(res) {
                log(res)
                resolve({
                    ok: false,
                    errCode: res.errCode ? res.errCode : 30000,
                    errMsg: res.errMsg ? res.errMsg : 'getSetting fail',
                })
            },
        })
    })
}
const authorize = () => {
    return new Promise(function (resolve, reject) {
        wx.authorize({
            scope: 'scope.bluetooth',
            success(res) {
                log(res)
                resolve({ ok: true, errCode: 0, errMsg: '' })
            },
            fail(res) {
                log(res)
                // {"errMsg":"authorize:fail:auth deny"}
                resolve({ ok: false, errCode: 30000, errMsg: res.errMsg })
            },
        })
    })
}
const _openBluetoothAdapter = () => {
    return new Promise(function (resolve, reject) {
        wx.openBluetoothAdapter({
            success(res) {
                log(res)
                // {errno: 0, errMsg: "openBluetoothAdapter:ok"}
                resolve({ ok: true, errCode: 0, errMsg: '' })
            },
            fail(res) {
                log(res)
                resolve({
                    ok: false,
                    errCode: res.errCode ? res.errCode : 30000,
                    errMsg: res.errMsg,
                })
            },
        })
    })
}
const openBluetoothAdapter = async () => {
    await _openBluetoothAdapter()
    const systemInfo = wx.getSystemInfoSync()
    log(systemInfo)
    if (systemInfo.platform.toLowerCase() === 'android') {
        isAndroid = true
    }
    if (!systemInfo.bluetoothEnabled) {
        ecBluetoothAdapterStateChangeCallback({
            ok: false,
            errCode: 30001,
            errMsg: '请打开系统蓝牙开关',
        })
        return
    }
    if (isAndroid && !systemInfo.locationEnabled) {
        ecBluetoothAdapterStateChangeCallback({
            ok: false,
            errCode: 30002,
            errMsg: '请打开系统定位开关',
        })
        return
    }
    if (isAndroid && !systemInfo.locationAuthorized) {
        ecBluetoothAdapterStateChangeCallback({
            ok: false,
            errCode: 30003,
            errMsg: '请打开微信定位权限，允许微信使用您的位置信息',
        })
        return
    }
    const setting = await getSetting() //小程序蓝牙权限
    if (!setting.ok) {
        const authRes = await authorize()
        if (!authRes.ok) {
            ecBluetoothAdapterStateChangeCallback({
                ok: false,
                errCode: 30004,
                errMsg: '请打开小程序蓝牙开关，点击右上角三个点，然后点击设置',
            })
            return
        }
    }
    wx.offBluetoothAdapterStateChange()
    wx.onBluetoothAdapterStateChange(res => {
        log(res) // {available: true, discovering: true}
        if (!res.available) {
            ecBluetoothAdapterStateChangeCallback({
                ok: false,
                errCode: 30005,
                errMsg: '蓝牙适配器不可用',
            })
        }
    })
    const openRes = await _openBluetoothAdapter()
    ecBluetoothAdapterStateChangeCallback(openRes)
}

const onBluetoothDeviceFound = cb => {
    wx.offBluetoothDeviceFound()
    wx.onBluetoothDeviceFound(res => {
        // log(res)
        const device = res.devices[0]
        const name = device.name ? device.name : device.localName
        if (!name) {
            return
        }
        let isCar = false;
        if (name.length === 15 && name.startsWith('BT_')) {
          isCar = true;
        }
        let id = device.deviceId
        let rssi = device.RSSI
        cb({ id, name, rssi, isCar })
    })
}

const startBluetoothDevicesDiscovery = () => {
  wx.startBluetoothDevicesDiscovery({
    //services: [ecServerId],
    allowDuplicatesKey: true,
    powerLevel: 'high',
    complete(res) {
        log(res)
    },
  })
}
const stopBluetoothDevicesDiscovery = () => {
  wx.stopBluetoothDevicesDiscovery({
    complete(res) {
        // {errno: 0, errMsg: "stopBluetoothDevicesDiscovery:ok", isDiscovering: false}
        log(res)
    },
  })
}

const onBLEConnectionStateChange = cb => {
    ecBLEConnectionStateChangeCallback = cb
}
const _createBLEConnection = () => {
    return new Promise(function (resolve, reject) {
        wx.createBLEConnection({
            deviceId: ecDeviceId,
            success(res) {
                log(res)
                // {"errno":0,"errCode":0,"errMsg":"createBLEConnection:ok"}
                resolve({ ok: true, errCode: 0, errMsg: '' })
            },
            fail(res) {
                log(res)
                // {"errno":1001,"errMsg":"createBLEConnection:fail parameter error: parameter.deviceId should be String instead of Undefined;"}
                resolve({
                    ok: false,
                    errCode: res.errCode ? res.errCode : res.errno,
                    errMsg: res.errMsg,
                })
            },
        })
    })
}
const getBLEDeviceServices = () => {
    return new Promise(function (resolve, reject) {
        wx.getBLEDeviceServices({
            deviceId: ecDeviceId,
            success(res) {
                log(res)
                //{"services":[{"uuid":"0000FFF0-0000-1000-8000-00805F9B34FB","isPrimary":true}],"errCode":0,"errno":0,"errMsg":"getBLEDeviceServices:ok"}
                // {"errno":0,"deviceId":"7C7E20F2-CB75-6DA8-F8DF-FFF702B0D63F","services":[{"isPrimary":true,"uuid":"0000FFF0-0000-1000-8000-00805F9B34FB"}],"errMsg":"getBLEDeviceServices:ok","errCode":0}
                resolve({
                    ok: true,
                    errCode: 0,
                    errMsg: '',
                    services: res.services,
                })
            },
            fail(res) {
                log(res)
                resolve({ ok: false, errCode: res.errCode, errMsg: res.errMsg })
            },
        })
    })
}
const getBLEDeviceCharacteristics = serviceId => {
    return new Promise(function (resolve, reject) {
        wx.getBLEDeviceCharacteristics({
            deviceId: ecDeviceId,
            serviceId,
            success(res) {
                log(res)
                // {"characteristics":[{"uuid":"0000FFF2-0000-1000-8000-00805F9B34FB","handle":3,"properties":{"read":false,"write":true,"notify":false,"indicate":false,"writeNoResponse":true,"writeDefault":true}},{"uuid":"0000FFF1-0000-1000-8000-00805F9B34FB","handle":5,"properties":{"read":true,"write":true,"notify":true,"indicate":false,"writeNoResponse":true,"writeDefault":true}}],"errCode":0,"errno":0,"errMsg":"getBLEDeviceCharacteristics:ok"}
                // {"characteristics":[{"properties":{"writeDefault":true,"notify":false,"write":true,"indicate":false,"read":false,"writeNoResponse":true},"uuid":"0000FFF2-0000-1000-8000-00805F9B34FB"},{"properties":{"writeDefault":true,"notify":true,"write":true,"indicate":false,"read":true,"writeNoResponse":true},"uuid":"0000FFF1-0000-1000-8000-00805F9B34FB"}],"deviceId":"7C7E20F2-CB75-6DA8-F8DF-FFF702B0D63F","serviceId":"0000FFF0-0000-1000-8000-00805F9B34FB","errno":0,"errMsg":"getBLEDeviceCharacteristics:ok","errCode":0}
                resolve({
                    ok: true,
                    errCode: 0,
                    errMsg: '',
                    characteristics: res.characteristics,
                })
            },
            fail(res) {
                log(res)
                resolve({ ok: false, errCode: res.errCode, errMsg: res.errMsg })
            },
        })
    })
}
const notifyBLECharacteristicValueChange = (serviceId, characteristicId) => {
    return new Promise(function (resolve, reject) {
        wx.notifyBLECharacteristicValueChange({
            state: true,
            deviceId: ecDeviceId,
            serviceId,
            characteristicId,
            success(res) {
                log(res)
                // {"errCode":0,"errno":0,"errMsg":"notifyBLECharacteristicValueChange:ok"}
                resolve({ ok: true, errCode: 0, errMsg: '' })
            },
            fail(res) {
                log(res)
                resolve({ ok: false, errCode: res.errCode, errMsg: res.errMsg })
            },
        })
    })
}
const setBLEMTU = mtu => {
    return new Promise(function (resolve, reject) {
        wx.setBLEMTU({
            deviceId: ecDeviceId,
            mtu,
            success(res) {
                log(res)
                // {"errMsg":"setBLEMTU:ok","errno":0,"errCode":0,"mtu":50}
                resolve({ ok: true, errCode: 0, errMsg: '' })
            },
            fail(res) {
                log(res)
                // {"errCode":-1,"errno":1500104,"errMsg":"setBLEMTU:fail:internal error"}
                resolve({ ok: false, errCode: res.errCode, errMsg: res.errMsg })
            },
        })
    })
}
//和设备建立连接
const createBLEConnection = async id => {
    ecDeviceId = id
    wx.offBLEConnectionStateChange()
    wx.onBLEConnectionStateChange(async res => {
        log(res)
        // {"deviceId":"EC:22:05:13:78:49","connected":true}
        if (res.connected) {
            const servicesResult = await getBLEDeviceServices()
            if (!servicesResult.ok) {
                ecBLEConnectionStateChangeCallback(servicesResult)
                closeBLEConnection()
                return
            }
            for (const service of servicesResult.services) {
                if ((service.uuid.toUpperCase() === ecGattServerUUIDOption1) ||
                    (service.uuid.toUpperCase() === ecGattServerUUIDOption2)) {
                    ecGattServerUUID = service.uuid
                }
                const characteristicsResult = await getBLEDeviceCharacteristics(
                    service.uuid
                )
                if (!characteristicsResult.ok) {
                    ecBLEConnectionStateChangeCallback(characteristicsResult)
                    closeBLEConnection()
                    return
                }
                for (const characteristic of characteristicsResult.characteristics) {
                    if (
                        characteristic.properties &&
                        characteristic.properties.notify
                    ) {
                        const notifyResult =
                            await notifyBLECharacteristicValueChange(
                                service.uuid,
                                characteristic.uuid
                            )
                        if (!notifyResult.ok) {
                            ecBLEConnectionStateChangeCallback({
                                ok: false,
                                errCode: 30000,
                                errMsg: 'notify error',
                            })
                            closeBLEConnection()
                            return
                        }
                    }

                    if ((characteristic.uuid.toUpperCase() === ecGattCharacteristicWriteUUIDOption1) ||
                        (characteristic.uuid.toUpperCase() === ecGattCharacteristicWriteUUIDOption2)) {
                        ecGattCharacteristicWriteUUID = characteristic.uuid
                    }
                }
            }
            if (isAndroid) {
                await setBLEMTU(247)
            }
            ecBLEConnectionStateChangeCallback({
                ok: true,
                errCode: 0,
                errMsg: '',
            })
        } else {
            ecBLEConnectionStateChangeCallback({
                ok: false,
                errCode: 0,
                errMsg: 'disconnect',
            })
        }
    })
    const res = await _createBLEConnection()
    if (!res.ok) {
        ecBLEConnectionStateChangeCallback(res)
    }
}
//关闭当前连接
const closeBLEConnection = () => {
    wx.closeBLEConnection({
        deviceId: ecDeviceId,
        complete(res) {
            log(res)
        },
    })
}

const onBLECharacteristicValueChange = cb => {
    wx.offBLECharacteristicValueChange()
    wx.onBLECharacteristicValueChange(res => {
        log(res)
        let x = new Uint8Array(res.value)
        log(x)
        let str
        if(ecBLEChineseType === ECBLEChineseTypeGBK){
            str = ecGBK.ecGBKBytesToStr(x)
        }else{
            str = utf8BytesToStr(x)
        }
        let strHex = bytesToHexStr(x)
        log(str)
        log(strHex)
        cb(str, strHex)
    })
}

const _writeBLECharacteristicValue = buffer => {
    return new Promise(function (resolve, reject) {
      log({
        data: buffer,
        characteristicId: ecGattServerUUID,
        deviceId: ecDeviceId,
        serviceId: ecGattServerUUID
      });
      if (!ecGattServerUUID || ecGattServerUUID === '' || !ecGattCharacteristicWriteUUID || ecGattCharacteristicWriteUUID === '') {
        resolve({ ok: false, errCode: 30000, errMsg: '设备不对！' });
        return;
      }
      wx.writeBLECharacteristicValue({
          deviceId: ecDeviceId,
          serviceId: ecGattServerUUID,
          characteristicId: ecGattCharacteristicWriteUUID,
          value: buffer,
          writeType: 'writeNoResponse',
          success(res) {
              // console.log('success', res);
              // {"errno":0,"errCode":0,"errMsg":"writeBLECharacteristicValue:ok"}
              resolve({ ok: true, errCode: 0, errMsg: '' })
          },
          fail(res) {
              // console.log('fail', res);
              resolve({ ok: false, errCode: res.errCode, errMsg: res.errMsg })
          },
      })
    })
}
const writeBLECharacteristicValue = async (str, isHex) => {
    if (str.length === 0)
        return { ok: false, errCode: 30000, errMsg: 'data is null' }
    let buffer
    if (isHex) {
        buffer = new Uint8Array(hexStrToBytes(str)).buffer
    } else {
        if(ecBLEChineseType === ECBLEChineseTypeGBK){
            buffer = new Uint8Array(ecGBK.ecStrToGBKBytes(str)).buffer
        }else{
            buffer = new Uint8Array(strToUTF8Bytes(str)).buffer
        }
    }
    return await _writeBLECharacteristicValue(buffer)
}

const writeBLECharacteristicHexValue = async (data) => {
  if (data.length === 0)
      return { ok: false, errCode: 30000, errMsg: 'data is null' }
  const buffer = data.buffer;
  return await _writeBLECharacteristicValue(buffer)
}

const bytesToHexStr = bytes => {
    let strHex = ''
    for (let i = 0; i < bytes.length; i++) {
        strHex = strHex + bytes[i].toString(16).padStart(2, '0').toUpperCase()
    }
    return strHex
}
const hexStrToBytes = hexStr => {
    let bytes = []
    for (let i = 0; i < (hexStr.length / 2); i++) {
        bytes.push(parseInt(hexStr.substr(2 * i, 2), 16))
    }
    return bytes
}
const utf8BytesToStr = utf8Bytes => {
    let unicodeStr = ''
    for (let pos = 0; pos < utf8Bytes.length;) {
        let flag = utf8Bytes[pos]
        let unicode = 0
        if (flag >>> 7 === 0) {
            unicodeStr += String.fromCharCode(utf8Bytes[pos])
            pos += 1
        }
        // else if ((flag & 0xFC) === 0xFC) {
        //     unicode = (utf8Bytes[pos] & 0x3) << 30
        //     unicode |= (utf8Bytes[pos + 1] & 0x3F) << 24
        //     unicode |= (utf8Bytes[pos + 2] & 0x3F) << 18
        //     unicode |= (utf8Bytes[pos + 3] & 0x3F) << 12
        //     unicode |= (utf8Bytes[pos + 4] & 0x3F) << 6
        //     unicode |= (utf8Bytes[pos + 5] & 0x3F)
        //     unicodeStr += String.fromCharCode(unicode)
        //     pos += 6
        // }
        // else if ((flag & 0xF8) === 0xF8) {
        //     unicode = (utf8Bytes[pos] & 0x7) << 24
        //     unicode |= (utf8Bytes[pos + 1] & 0x3F) << 18
        //     unicode |= (utf8Bytes[pos + 2] & 0x3F) << 12
        //     unicode |= (utf8Bytes[pos + 3] & 0x3F) << 6
        //     unicode |= (utf8Bytes[pos + 4] & 0x3F)
        //     unicodeStr += String.fromCharCode(unicode)
        //     pos += 5
        // }
        else if ((flag & 0xf0) === 0xf0) {
            unicode = (utf8Bytes[pos] & 0xf) << 18
            unicode |= (utf8Bytes[pos + 1] & 0x3f) << 12
            unicode |= (utf8Bytes[pos + 2] & 0x3f) << 6
            unicode |= utf8Bytes[pos + 3] & 0x3f
            unicodeStr += String.fromCharCode(unicode)
            pos += 4
        } else if ((flag & 0xe0) === 0xe0) {
            unicode = (utf8Bytes[pos] & 0x1f) << 12
            unicode |= (utf8Bytes[pos + 1] & 0x3f) << 6
            unicode |= utf8Bytes[pos + 2] & 0x3f
            unicodeStr += String.fromCharCode(unicode)
            pos += 3
        } else if ((flag & 0xc0) === 0xc0) {
            //110
            unicode = (utf8Bytes[pos] & 0x3f) << 6
            unicode |= utf8Bytes[pos + 1] & 0x3f
            unicodeStr += String.fromCharCode(unicode)
            pos += 2
        } else {
            unicodeStr += String.fromCharCode(utf8Bytes[pos])
            pos += 1
        }
    }
    return unicodeStr
}
const strToUTF8Bytes = str => {
    let bytes = []
    for (let i = 0; i < str.length; ++i) {
        let code = str.charCodeAt(i)
        if (code >= 0x10000 && code <= 0x10ffff) {
            bytes.push((code >> 18) | 0xf0) // 第一个字节
            bytes.push(((code >> 12) & 0x3f) | 0x80)
            bytes.push(((code >> 6) & 0x3f) | 0x80)
            bytes.push((code & 0x3f) | 0x80)
        } else if (code >= 0x800 && code <= 0xffff) {
            bytes.push((code >> 12) | 0xe0)
            bytes.push(((code >> 6) & 0x3f) | 0x80)
            bytes.push((code & 0x3f) | 0x80)
        } else if (code >= 0x80 && code <= 0x7ff) {
            bytes.push((code >> 6) | 0xc0)
            bytes.push((code & 0x3f) | 0x80)
        } else {
            bytes.push(code)
        }
    }
    return bytes
}

module.exports = {
    ECBLEChineseTypeUTF8,
    ECBLEChineseTypeGBK,
    setChineseType,
    onBluetoothAdapterStateChange,
    openBluetoothAdapter,
    onBluetoothDeviceFound,
    startBluetoothDevicesDiscovery,
    stopBluetoothDevicesDiscovery,
    onBLEConnectionStateChange,
    createBLEConnection,
    closeBLEConnection,
    onBLECharacteristicValueChange,
    writeBLECharacteristicValue,
    writeBLECharacteristicHexValue,
}
