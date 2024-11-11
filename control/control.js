import DirectionUtil, { log, logError } from "../utils/DirectionUtil";
const ecUI = require("../utils/ecUI.js");
const ecBLE = require("../utils/ecBLE.js");

Page({
  data: {
    joystickPosition: { x: 0, y: 0 },
    joystickActive: false,
    rightTouchPosition: null,
    safeArea: {},
    screenWidth: 0,
    screenHeight: 0,
    joystickRect: null,
    joystickTouchId: null,
    rightTouchId: null,
    rightTouchStartPosition: null,
    joystickDebug: "0, 0",
    rightRotationDebug: "0°",
    speedLevel: "high",
    joystickReady: false,
    rightTouchStartAngle: 0,
    currentRotationAngle: 0,
    rotationDirection: "none",
    rotationSpeed: 0,
    bluetoothDebugInfo: [{ isError: false, message: "连接成功!" }],
    textRevData: "",
    commandQueue: [],
    isProcessingQueue: false,
  },

  onLoad() {
    // 延迟执行以确保页面已经旋转到横屏模式
    setTimeout(() => {
      this.updateSystemInfo();
    }, 800); // 800毫秒的延迟，可以根据实际情况调整
    // on disconnect
    ecBLE.onBLEConnectionStateChange(() => {
      ecUI.showModal("提示", "设备断开连接");
      this.updateBluetoothDebugInfo("设备断开连接", true);
    });
    // receive data
    ecBLE.onBLECharacteristicValueChange((str, strHex) => {
      let data =
        this.data.textRevData +
        this.dateFormat("[hh:mm:ss,S]:", new Date()) +
        (true ? strHex.replace(/[0-9a-fA-F]{2}/g, " $&") : str) +
        "\r\n";
      log("receive data", data);
      this.updateBluetoothDebugInfo(data, false);
      this.setData({ textRevData: data });
    });
  },

  onUnload() {
    ecBLE.onBLEConnectionStateChange(() => {});
    ecBLE.onBLECharacteristicValueChange(() => {});
    ecBLE.closeBLEConnection();
  },
  onShow() {
    // 每次页面显示时更新系统信息，以处理可能的屏幕旋转
    setTimeout(() => {
      this.updateSystemInfo();
    }, 800); // 500毫秒的延迟，可以根据实际情况调整
  },

  updateSystemInfo() {
    wx.getSystemInfo({
      success: (res) => {
        // 确保获取到的是横屏模式的尺寸
        const screenWidth = Math.max(res.screenWidth, res.screenHeight);
        const screenHeight = Math.min(res.screenWidth, res.screenHeight);
        this.setData({
          safeArea: res.safeArea,
          screenWidth: screenWidth,
          screenHeight: screenHeight,
          joystickReady: true, // 添加这行
        });
        this.initJoystickRect();
      },
    });
  },

  initJoystickRect() {
    const query = wx.createSelectorQuery();
    query.select("#joystickArea").boundingClientRect();
    query.exec((res) => {
      if (res[0]) {
        this.setData({ joystickRect: res[0] });
      }
    });
  },

  onTouchStart(e) {
    for (let touch of e.touches) {
      if (this.isJoystickArea(touch) && this.data.joystickTouchId === null) {
        this.handleJoystickStart(touch);
      } else if (!this.isJoystickArea(touch)) {
        // 允许新的右侧触摸开始，使 rightTouchId 不为 null
        this.handleRightAreaStart(touch);
      }
    }
  },

  onTouchMove(e) {
    for (let touch of e.changedTouches) {
      if (touch.identifier === this.data.joystickTouchId) {
        this.handleJoystickMove(touch);
      } else if (touch.identifier === this.data.rightTouchId) {
        this.handleRightAreaMove(touch);
      }
    }
  },

  onTouchEnd(e) {
    for (let touch of e.changedTouches) {
      if (touch.identifier === this.data.joystickTouchId) {
        this.handleJoystickEnd();
        const bluetoothCommand = DirectionUtil.convertToBluetoothCommand(
          0,
          0,
          this.data.speedLevel
        );
        this.sendBluetoothCommand(bluetoothCommand);
      } else if (touch.identifier === this.data.rightTouchId) {
        this.handleRightAreaEnd();
        this.sendRotationCommand(
          this.data.currentRotationAngle,
          this.data.rotationDirection,
          this.data.rotationSpeed
        );
      }
    }
    // 检查是否所有触摸都已结束
    if (e.touches.length === 0) {
      this.resetAllTouches();
    }
  },

  onTouchCancel(e) {
    this.onTouchEnd(e);
  },

  resetAllTouches() {
    this.handleJoystickEnd();
    this.resetRightTouch();
  },

  resetRightTouch() {
    this.setData({
      rightTouchPosition: null,
      rightTouchId: null,
      rightTouchStartPosition: null,
    });
  },

  handleJoystickStart(touch) {
    this.setData({
      joystickActive: true,
      joystickTouchId: touch.identifier,
    });
    this.moveJoystick(touch);
  },

  handleJoystickMove(touch) {
    if (this.data.joystickActive) {
      this.moveJoystick(touch);
    }
  },
  dateFormat(fmt, date) {
    let o = {
      "M+": date.getMonth() + 1, //月份
      "d+": date.getDate(), //日
      "h+": date.getHours(), //小时
      "m+": date.getMinutes(), //分
      "s+": date.getSeconds(), //秒
      "q+": Math.floor((date.getMonth() + 3) / 3), //季度
      S: date.getMilliseconds(), //毫秒
    };
    if (/(y+)/.test(fmt))
      fmt = fmt.replace(
        RegExp.$1,
        (date.getFullYear() + "").substr(4 - RegExp.$1.length)
      );
    for (var k in o)
      if (new RegExp("(" + k + ")").test(fmt)) {
        // console.log(RegExp.$1.length)
        // console.log(o[k])
        fmt = fmt.replace(
          RegExp.$1,
          RegExp.$1.length == 1
            ? (o[k] + "").padStart(3, "0")
            : ("00" + o[k]).substr(("" + o[k]).length)
        );
      }
    return fmt;
  },
  handleJoystickEnd() {
    this.setData({
      joystickActive: false,
      joystickPosition: { x: 0, y: 0 },
      joystickTouchId: null,
      joystickDebug: "0, 0",
    });
  },

  moveJoystick(touch) {
    const rect = this.data.joystickRect;

    if (rect) {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const maxRadius = rect.width / 2;

      let deltaX = touch.clientX - centerX;
      let deltaY = touch.clientY - centerY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance > maxRadius) {
        deltaX = (deltaX / distance) * maxRadius;
        deltaY = (deltaY / distance) * maxRadius;
      }

      const ratioX = deltaX / maxRadius;
      const ratioY = -deltaY / maxRadius;
      const { direction, speed } = DirectionUtil.getDirectionAndSpeed(
        ratioX,
        ratioY
      );
      const bluetoothCommand = DirectionUtil.convertToBluetoothCommand(
        ratioX,
        ratioY,
        this.data.speedLevel
      );
      const speedRatio = DirectionUtil.getSpeedRatio(this.data.speedLevel);
      this.setData({
        joystickPosition: { x: deltaX, y: deltaY },
        joystickDebug: `${ratioX.toFixed(2)}, ${ratioY.toFixed(
          2
        )}, ${direction}, 速度：${Math.round(speed * speedRatio)}`,
      });
      this.sendBluetoothCommand(bluetoothCommand);
    }
  },

  handleRightAreaStart(touch) {
    this.setData({
      rightTouchId: touch.identifier,
      previousTouchPosition: { x: touch.clientX, y: touch.clientY },
    });
  },

  handleRightAreaMove(touch) {
    const deltaX = touch.clientX - this.data.previousTouchPosition.x;

    let rotationDirection = "none";
    let rotationSpeed = 0;

    if (deltaX !== 0) {
      rotationDirection = deltaX > 0 ? "right" : "left";
      rotationSpeed = Math.min(Math.abs(deltaX * 6), 100); // 放大 deltaX 以增大速度变化
    }

    this.setData({
      rotationDirection: rotationDirection,
      rotationSpeed: rotationSpeed,
      previousTouchPosition: { x: touch.clientX, y: touch.clientY },
    });

    this.updateRightRotationDebug();
    this.sendRotationCommand(0, rotationDirection, rotationSpeed);
  },

  handleRightAreaEnd() {
    this.setData({
      rightTouchId: null,
      rotationDirection: "none",
      rotationSpeed: 0,
      previousTouchPosition: null,
    });
    this.updateRightRotationDebug();
  },

  updateRightRotationDebug() {
    const speedRatio = DirectionUtil.getSpeedRatio(this.data.speedLevel);
    this.setData({
      rightRotationDebug: `方向: ${
        this.data.rotationDirection
      }, 速度: ${Math.round(this.data.rotationSpeed * speedRatio)}`,
    });
  },

  isJoystickArea(touch) {
    const rect = this.data.joystickRect;
    if (rect) {
      return (
        touch.clientX >= rect.left &&
        touch.clientX <= rect.right &&
        touch.clientY >= rect.top &&
        touch.clientY <= rect.bottom
      );
    }
    return false;
  },

  getRightAreaRect() {
    return {
      left: this.data.screenWidth * 0.3,
      top: 0,
      width: this.data.screenWidth * 0.7,
      height: this.data.screenHeight,
    };
  },

  setSpeedLevel(e) {
    wx.vibrateShort({
      type: "light", // 使用轻度震动类型
    });
    const level = e.currentTarget.dataset.level;
    this.setData({ speedLevel: level });
    // Here you can add logic to actually change the speed of your car
    log(`Speed level set to: `, level);
  },

  goBack: function () {
    wx.vibrateShort({
      type: "light", // 使用轻度震动类型
    });
    ecBLE.closeBLEConnection();
    wx.navigateBack({
      delta: 1,
    });
  },

  calculateAngle(centerX, centerY, touchX, touchY) {
    const dx = touchX - centerX;
    const dy = touchY - centerY;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle < 0) {
      angle += 360;
    }
    return angle;
  },

  // 发送旋转命令到蓝牙设备
  sendRotationCommand(angle, direction, speed) {
    // 使用 DirectionUtil 的新方法生成蓝牙命令
    const command = DirectionUtil.convertToRotationCommand(
      direction,
      speed,
      this.data.speedLevel
    );
    this.sendBluetoothCommand(command);
  },

  sendBluetoothCommand(command) {
    wx.vibrateShort({
      type: "light",
    });

    // 将新命令添加到队列
    this.data.commandQueue.push(command);

    // 如果队列没有在处理中，开始处理
    if (!this.data.isProcessingQueue) {
      this.processCommandQueue();
    }
  },

  processCommandQueue() {
    if (this.data.commandQueue.length === 0) {
      this.setData({ isProcessingQueue: false });
      return;
    }

    this.setData({ isProcessingQueue: true });

    // 获取队列中的最后一个命令（最新的命令）
    const latestCommand =
      this.data.commandQueue[this.data.commandQueue.length - 1];

    // 清空队列
    this.data.commandQueue = [];

    ecBLE
      .writeBLECharacteristicHexValue(latestCommand)
      .then((res) => {
        if (res.ok) {
          this.updateBluetoothDebugInfo(`发送成功: ${latestCommand}`);
        } else {
          this.updateBluetoothDebugInfo(
            `发送失败: ${res.errMsg} code: ${res.errCode}`,
            true
          );
        }
      })
      .catch((error) => {
        console.error(`Failed to send command ${latestCommand}`, error);
        this.updateBluetoothDebugInfo(
          `发送失败: ${latestCommand} code: ${error.errCode}`,
          true
        );
      })
      .finally(() => {
        // 200ms 后处理下一个命令
        setTimeout(() => {
          this.processCommandQueue();
        }, 200);
      });
  },

  updateBluetoothDebugInfo(message, isError = false) {
    let newInfo = [{ message, isError }, ...this.data.bluetoothDebugInfo].slice(
      0,
      3
    );
    this.setData({ bluetoothDebugInfo: newInfo });
  },
});
