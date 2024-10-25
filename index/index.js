const ecUI = require('../utils/ecUI.js')
const ecBLE = require('../utils/ecBLE.js')
let ctx

Page({
  data: {
    devices: [],
    connected: false,
    isSearching: false,
  },

  onLoad() {
    ctx = this;
  },

  onShow() {
    ctx.setData({ devices: [] })
    setTimeout(() => {
      this.openBluetoothAdapterReal();
    }, 100)
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
    ecBLE.stopBluetoothDevicesDiscovery();
  },

  openBluetoothAdapterReal() {
    this.openBluetoothAdapter();
  },

  createBLEConnection(e) {
    wx.vibrateShort({
      type: 'light'
    });
    ecUI.showLoading('设备连接中')
    ecBLE.onBLEConnectionStateChange(res => {
        ecUI.hideLoading()
        if (res.ok) {
            ctx.stopSearch();
            wx.navigateTo({ url: '/control/control' })
        } else {
            ecUI.showModal(
                '提示',
                '连接失败,errCode=' + res.errCode + ',errMsg=' + res.errMsg
            )  
        }    
    })  
    const device = e.currentTarget.dataset;
    console.log('createBLEConnection', device);
    ecBLE.createBLEConnection(device.deviceId);
  },
  openBluetoothAdapter() {
    ecBLE.onBluetoothAdapterStateChange(res => {
        if (res.ok || res.errCode === 30000) {
          console.log('Bluetooth adapter ok')
          this.setData({ isSearching: true, devices: [] });
          ctx.startBluetoothDevicesDiscovery()
        } else {
          ecUI.showModal(
            '提示',
            `Bluetooth adapter error | ${res.errCode} | ${res.errMsg}`,
            () => {
                if (res.errCode === 30001) {
                    wx.openSystemBluetoothSetting()
                }
                if (res.errCode === 30003) {
                    wx.openAppAuthorizeSetting()
                }
                if (res.errCode === 30004) {
                    //跳转到小程序设置界面
                    wx.openSetting()
                }
            }
          )
        }
    })
    ecBLE.openBluetoothAdapter()
  },
  startBluetoothDevicesDiscovery() {
      console.log('start search');
      this.setData({
        isSearching: true,
        devices: []
      });
      ecBLE.onBluetoothDeviceFound(res => {
        if (res.name.startsWith('未知')) {
          return;
        }
        // console.log(`id:${res.id},name:${res.name},rssi:${res.rssi}`)
        const devices = this.data.devices;
        const idx = devices.findIndex(d => d.id === res.id);
        if (idx === -1) {
          devices.push(res);
        } else {
          devices[idx] = res;
        }
        this.setData({ devices });
      });
      wx.stopBluetoothDevicesDiscovery({
        complete(res) {
            ecBLE.startBluetoothDevicesDiscovery()
        },
      });
  },
});
