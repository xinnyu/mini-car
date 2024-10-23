function inArray(arr, key, val) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i][key] === val) {
      return i;
    }
  }
  return -1;
}

function ab2hex(buffer) {
  var hexArr = Array.prototype.map.call(
    new Uint8Array(buffer),
    function (bit) {
      return ('00' + bit.toString(16)).slice(-2)
    }
  )
  return hexArr.join('');
}

const DEVICE_NAME = 'BT_ECB1B603EBAB';
const SERVICE_UUID = '0000FFF0-0000-1000-8000-00805F9B34FB';
const CHARACTERISTIC_UUID = '0000FFF2-0000-1000-8000-00805F9B34FB';

class BluetoothManager {

  constructor() {
    this._discoveryStarted = false;
    this._deviceId = '';
    this._serviceId = '';
    this._characteristicId = '';
    this.onDeviceFoundCallback = null;
    this.onConnectedCallback = null;
    this.onDisconnectedCallback = null;
    this.onCharacteristicValueChangeCallback = null;
    this.lastSendTime = 0;
    this.throttleInterval = 200; // 200ms throttle interval
    this.pendingData = null;
    this.throttleTimer = null;
    this.DEVICE_NAME = DEVICE_NAME;
    this.SERVICE_UUID = SERVICE_UUID;
    this.CHARACTERISTIC_UUID = CHARACTERISTIC_UUID;
  }

  openBluetoothAdapter() {
    this.closeBluetoothAdapter();
    return new Promise((resolve, reject) => {
      wx.openBluetoothAdapter({
        success: (res) => {
          console.log('openBluetoothAdapter success', res);
          this.startBluetoothDevicesDiscovery();
          resolve(res);
        },
        fail: (res) => {
          console.log('openBluetoothAdapter fail', res);
          if (res.errCode === 10001) {
            wx.onBluetoothAdapterStateChange((res) => {
              console.log('onBluetoothAdapterStateChange', res);
              if (res.available) {
                this.startBluetoothDevicesDiscovery();
              }
            });
          }
          reject(res);
        }
      });
    });
  }

  getBluetoothAdapterState() {
    return new Promise((resolve, reject) => {
      wx.getBluetoothAdapterState({
        success: (res) => {
          console.log('getBluetoothAdapterState', res);
          if (res.discovering) {
            this.onBluetoothDeviceFound();
          } else if (res.available) {
            this.startBluetoothDevicesDiscovery();
          }
          resolve(res);
        },
        fail: reject
      });
    });
  }

  startBluetoothDevicesDiscovery() {
    if (this._discoveryStarted) {
      return;
    }
    this._discoveryStarted = true;
    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: true,
      success: (res) => {
        console.log('startBluetoothDevicesDiscovery success', res);
        this.onBluetoothDeviceFound();
      },
    });
  }

  stopBluetoothDevicesDiscovery() {
    wx.stopBluetoothDevicesDiscovery();
  }

  onBluetoothDeviceFound() {
    wx.onBluetoothDeviceFound((res) => {
      res.devices.forEach(device => {
        if (!device.name && !device.localName) {
          return;
        }
        if (this.onDeviceFoundCallback) {
          this.onDeviceFoundCallback(device);
        }
      });
    });
  }

  createBLEConnection(deviceId, name) {
    return new Promise((resolve, reject) => {
      wx.createBLEConnection({
        deviceId,
        success: (res) => {
          console.log("BLE connection success id: ", deviceId);
          this._deviceId = deviceId;
          this.getBLEDeviceServices(deviceId);
          if (this.onConnectedCallback) {
            this.onConnectedCallback(deviceId, name);
          }
          resolve(res);
        },
        fail: (err) => {
          console.error("BLE connection failed", err);
          reject(err);
        }
      });
      this.stopBluetoothDevicesDiscovery();
    });
  }

  closeBLEConnection() {
    return new Promise((resolve, reject) => {
      wx.closeBLEConnection({
        deviceId: this._deviceId,
        success: (res) => {
          this._deviceId = '';
          this._serviceId = '';
          this._characteristicId = '';
          if (this.onDisconnectedCallback) {
            this.onDisconnectedCallback();
          }
          resolve(res);
        },
        fail: reject
      });
    });
  }

  getBLEDeviceServices(deviceId) {
    wx.getBLEDeviceServices({
      deviceId,
      success: (res) => {
        for (let i = 0; i < res.services.length; i++) {
          // if (res.services[i].isPrimary) {
          //   this.getBLEDeviceCharacteristics(deviceId, res.services[i].uuid);
          //   return;
          // }
          console.log(`getBLEDeviceServices: ${res.services[i].uuid}`);
          // if (res.services[i].uuid === '00001111-0000-1000-8000-00805F9B34FB') {
          //   this.getBLEDeviceCharacteristics(deviceId, res.services[i].uuid);
          //   return;
          // }
          if (res.services[i].uuid === SERVICE_UUID) {
            this.getBLEDeviceCharacteristics(deviceId, res.services[i].uuid);
            return;
          }
        }
      }
    });
  }

  getBLEDeviceCharacteristics(deviceId, serviceId) {
    console.log(`getBLEDeviceCharacteristics deviceId ${deviceId} serviceId ${serviceId}`);
    wx.getBLEDeviceCharacteristics({
      deviceId,
      serviceId,
      success: (res) => {
        console.log('getBLEDeviceCharacteristics success', res.characteristics);
        for (let i = 0; i < res.characteristics.length; i++) {
          let item = res.characteristics[i];
          if (item.properties.read) {
            wx.readBLECharacteristicValue({
              deviceId,
              serviceId,
              characteristicId: item.uuid,
            });
          }
          if (item.properties.notify || item.properties.indicate) {
            wx.notifyBLECharacteristicValueChange({
              deviceId,
              serviceId,
              characteristicId: item.uuid,
              state: true,
            });
          } else if (item.properties.write) {
            this._deviceId = deviceId;
            this._serviceId = serviceId;
            this._characteristicId = item.uuid;
            console.log('getBLEDeviceCharacteristics write', item);
          }
        }
      },
      fail(res) {
        console.error('getBLEDeviceCharacteristics', res);
      }
    });
    
    wx.onBLECharacteristicValueChange((characteristic) => {
      console.log('onBLECharacteristicValueChange', characteristic);
      if (this.onCharacteristicValueChangeCallback) {
        this.onCharacteristicValueChangeCallback(characteristic);
      }
    });
  }

  writeBLECharacteristicValue(buffer) {
    return new Promise((resolve, reject) => {
      wx.writeBLECharacteristicValue({
        deviceId: this._deviceId,
        serviceId: this._serviceId,
        characteristicId: this._characteristicId,
        value: buffer,
        writeType: 'write',
        success: resolve,
        fail: reject
      });
    });
  }

  closeBluetoothAdapter() {
    this.stopBluetoothDevicesDiscovery();
    wx.closeBluetoothAdapter();
    this._discoveryStarted = false;
  }

  sendData(data) {
    const buffer = new ArrayBuffer(data.length);
    const dataView = new DataView(buffer);
    for (let i = 0; i < data.length; i++) {
      dataView.setUint8(i, data[i]);
    }
    console.log(`Sending data: ${data}, to characteristic: ${this._characteristicId} deviceId: ${this._deviceId} serviceId: ${this._serviceId}`);
    return this.writeBLECharacteristicValue(buffer);
  }

  sendDataThrottled(data) {
    const currentTime = Date.now();
    if (currentTime - this.lastSendTime >= this.throttleInterval) {
      // 如果距离上次发送已经过了足够的时间，立即发送
      this.lastSendTime = currentTime;
      return this.sendData(data);
    } else {
      // 否则，更新待发送的数据，并确保只有一个定时器在运行
      this.pendingData = data;
      if (!this.throttleTimer) {
        this.throttleTimer = setTimeout(() => {
          if (this.pendingData) {
            this.sendData(this.pendingData)
              .then(() => {
                console.log('Throttled data sent successfully');
              })
              .catch((error) => {
                console.error('Failed to send throttled data', error);
              });
            this.pendingData = null;
            this.lastSendTime = Date.now();
          }
          this.throttleTimer = null;
        }, this.throttleInterval - (currentTime - this.lastSendTime));
      }
      return Promise.resolve(); // 立即解析 promise，不阻塞主线程
    }
  }
}

export default new BluetoothManager();
export { DEVICE_NAME, SERVICE_UUID, CHARACTERISTIC_UUID };