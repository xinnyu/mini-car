import BluetoothManager, { log, logError } from '../utils/BluetoothManager';

Page({
  data: {
    devices: [],
    connected: false,
    chs: [],
    isSearching: false,
  },

  onLoad() {
    BluetoothManager.onDeviceFoundCallback = this.onDeviceFound.bind(this);
    BluetoothManager.onConnectedCallback = this.onConnected.bind(this);
    BluetoothManager.onDisconnectedCallback = this.onDisconnected.bind(this);
    BluetoothManager.onCharacteristicValueChangeCallback = this.onCharacteristicValueChange.bind(this);
  },

  onShow() {
    this.openBluetoothAdapterReal();
  },

  toggleSearch() {
    wx.vibrateShort({
      type: 'light'
    });
    if (this.data.isSearching) {
      this.stopSearch();
    } else {
      this.startSearch();
    }
  },

  startSearch() {
    this.setData({
      isSearching: true,
      devices: []
    });
    this.openBluetoothAdapterReal();
  },

  stopSearch() {
    this.setData({
      isSearching: false
    });
    BluetoothManager.stopBluetoothDevicesDiscovery();
  },

  openBluetoothAdapterReal() {
    BluetoothManager.openBluetoothAdapter()
      .then(() => {
        log('Bluetooth adapter opened successfully');
        this.setData({ isSearching: true });
      })
      .catch((error) => {
        logError('Failed to open Bluetooth adapter', error);
        this.setData({ isSearching: false });
      });
  },

  getBluetoothAdapterState() {
    BluetoothManager.getBluetoothAdapterState()
      .then((res) => {
        log('Bluetooth adapter state:', res);
      })
      .catch((error) => {
        logError('Failed to get Bluetooth adapter state', error);
      });
  },

  onDeviceFound(device) {
    if (device.name === BluetoothManager.DEVICE_NAME || device.localName === BluetoothManager.DEVICE_NAME || true) {
      log('onDeviceFound deviceId', { deviceId: device.deviceId });
      const devices = this.data.devices;
      const idx = devices.findIndex(d => d.deviceId === device.deviceId);
      if (idx === -1) {
        devices.push(device);
      } else {
        devices[idx] = device;
      }
      this.setData({ devices });
    }
  },

  createBLEConnection(e) {
    wx.vibrateShort({
      type: 'light'
    });
    const { deviceId, name } = e.currentTarget.dataset;
    log('createBLEConnection deviceId', { deviceId });
    BluetoothManager.createBLEConnection(deviceId, name)
      .then(() => {
        wx.navigateTo({
          url: `/control/control?deviceId=${deviceId}&name=${name}`,
        });
      })
      .catch((error) => {
        logError('Failed to create BLE connection', error);
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
        log('BLE connection closed successfully');
      })
      .catch((error) => {
        logError('Failed to close BLE connection', error);
      });
  },

  onConnected(deviceId, name) {
    this.setData({
      connected: true,
      deviceId,
      name,
    });
    log('Device connected', { deviceId, name });
  },

  onDisconnected() {
    this.setData({
      connected: false,
      deviceId: '',
      name: '',
      chs: [],
    });
    log('Device disconnected');
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
    log('onCharacteristicValueChange', data);
    this.setData(data);
  },

  closeBluetoothAdapter() {
    BluetoothManager.closeBluetoothAdapter();
    log('Bluetooth adapter closed');
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
