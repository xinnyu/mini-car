const app = getApp();

function inArray(arr, key, val) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i][key] === val) {
      return i;
    }
  }
  return -1;
}

function ab2hex(buffer) {
  var hexArr = Array.prototype.map.call(new Uint8Array(buffer), function (bit) {
    return ("00" + bit.toString(16)).slice(-2);
  });
  return hexArr.join("");
}

Page({
  data: {
    deviceId: "",
    name: "",
    connected: true,
    chs: [],
    canWrite: false,
  },
  onLoad(options) {
    this.setData({
      deviceId: options.deviceId,
      name: options.name,
    });
    this.getBLEDeviceServices(options.deviceId);
  },
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
      },
    });
  },
  getBLEDeviceCharacteristics(deviceId, serviceId) {
    wx.getBLEDeviceCharacteristics({
      deviceId,
      serviceId,
      success: (res) => {
        console.log("getBLEDeviceCharacteristics success", res.characteristics);
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
            this.setData({
              canWrite: true,
            });
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
        console.error("getBLEDeviceCharacteristics", res);
      },
    });
    wx.onBLECharacteristicValueChange((characteristic) => {
      const idx = inArray(
        this.data.chs,
        "uuid",
        characteristic.characteristicId,
      );
      const data = {};
      if (idx === -1) {
        data[`chs[${this.data.chs.length}]`] = {
          uuid: characteristic.characteristicId,
          value: ab2hex(characteristic.value),
        };
      } else {
        data[`chs[${idx}]`] = {
          uuid: characteristic.characteristicId,
          value: ab2hex(characteristic.value),
        };
      }
      this.setData(data);
    });
  },
  writeBLECharacteristicValue() {
    let buffer = new ArrayBuffer(1);
    let dataView = new DataView(buffer);
    dataView.setUint8(0, (Math.random() * 255) | 0);
    wx.writeBLECharacteristicValue({
      deviceId: this._deviceId,
      serviceId: this._serviceId,
      characteristicId: this._characteristicId,
      value: buffer,
    });
  },
  closeBLEConnection() {
    wx.closeBLEConnection({
      deviceId: this.data.deviceId,
    });
    wx.navigateBack();
  },
});
