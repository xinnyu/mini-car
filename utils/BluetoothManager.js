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
          console.log("BLE connection success");
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
          if (res.services[i].isPrimary) {
            this.getBLEDeviceCharacteristics(deviceId, res.services[i].uuid);
            return;
          }
        }
      }
    });
  }

  getBLEDeviceCharacteristics(deviceId, serviceId) {
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
          if (item.properties.write) {
            this._deviceId = deviceId;
            this._serviceId = serviceId;
            this._characteristicId = item.uuid;
          }
          if (item.properties.notify || item.properties.indicate) {
            wx.notifyBLECharacteristicValueChange({
              deviceId,
              serviceId,
              characteristicId: item.uuid,
              state: true,
            });
          }
        }
      },
      fail(res) {
        console.error('getBLEDeviceCharacteristics', res);
      }
    });
    
    wx.onBLECharacteristicValueChange((characteristic) => {
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
    return this.writeBLECharacteristicValue(buffer);
  }

  sendExampleData() {
    BluetoothManager.sendData([0x01, 0x02, 0x03])
      .then(() => {
        console.log('Data sent successfully');
      })
      .catch((error) => {
        console.error('Failed to send data', error);
      });
  }
}

export default new BluetoothManager();
