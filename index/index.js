import BluetoothManager from '../utils/BluetoothManager';

Page({
  data: {
    devices: [],
    connected: false,
    chs: [],
    miniArmDevice: null,
  },

  onLoad() {
    BluetoothManager.onDeviceFoundCallback = this.onDeviceFound.bind(this);
    BluetoothManager.onConnectedCallback = this.onConnected.bind(this);
    BluetoothManager.onDisconnectedCallback = this.onDisconnected.bind(this);
    BluetoothManager.onCharacteristicValueChangeCallback = this.onCharacteristicValueChange.bind(this);
  },

  onShow() {
    this.openBluetoothAdapter();
  },

  openBluetoothAdapter() {
    this.setData({
      miniArmDevice: null
    });
    BluetoothManager.openBluetoothAdapter()
      .then(() => {
        console.log('Bluetooth adapter opened successfully');
      })
      .catch((error) => {
        console.error('Failed to open Bluetooth adapter', error);
      });
  },

  getBluetoothAdapterState() {
    BluetoothManager.getBluetoothAdapterState()
      .then((res) => {
        console.log('Bluetooth adapter state:', res);
      })
      .catch((error) => {
        console.error('Failed to get Bluetooth adapter state', error);
      });
  },

  onDeviceFound(device) {
    if (device.name === "Mini-Arm" || device.localName === "Mini-Arm") {
      this.setData({
        miniArmDevice: device
      });
    }
  },

  createBLEConnection(e) {
    const { deviceId, name } = e.currentTarget.dataset;
    BluetoothManager.createBLEConnection(deviceId, name)
      .then(() => {
        wx.navigateTo({
          url: `/control/control?deviceId=${deviceId}&name=${name}`,
        });
      })
      .catch((error) => {
        wx.showToast({
          title: '连接失败，请重试',
          icon: 'none',
          duration: 2000
        });
      });
  },

  closeBLEConnection() {
    BluetoothManager.closeBLEConnection()
      .then(() => {
        console.log('BLE connection closed successfully');
      })
      .catch((error) => {
        console.error('Failed to close BLE connection', error);
      });
  },

  onConnected(deviceId, name) {
    this.setData({
      connected: true,
      deviceId,
      name,
    });
  },

  onDisconnected() {
    this.setData({
      connected: false,
      deviceId: '',
      name: '',
      chs: [],
    });
  },

  onCharacteristicValueChange(characteristic) {
    const idx = inArray(this.data.chs, 'uuid', characteristic.characteristicId);
    const data = {};
    if (idx === -1) {
      data[`chs[${this.data.chs.length}]`] = {
        uuid: characteristic.characteristicId,
        value: ab2hex(characteristic.value)
      };
    } else {
      data[`chs[${idx}]`] = {
        uuid: characteristic.characteristicId,
        value: ab2hex(characteristic.value)
      };
    }
    this.setData(data);
  },

  closeBluetoothAdapter() {
    BluetoothManager.closeBluetoothAdapter();
  }
});

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
