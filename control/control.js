import DirectionUtil, { log, logError } from "../utils/DirectionUtil";
const ecUI = require("../utils/ecUI.js");
const ecBLE = require("../utils/ecBLE.js");

Page({
  data: {
    joystickPosition: { x: 0, y: 0 },
    joystickRatio: { x: 0, y: 0 },
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
    sendCommandInterval: null,
    touchStartPosition: null, // 记录手指起始位置
    lastVibrateTime: 0, // 用于记录上次振动时间
    vibrateInterval: 15, // 设置振动间隔时间（毫秒）
    hideSwipeIndicator: true,
    hasShowSwipeIndicator: false,
    lastCommand: null, // 添加这行来记录最后一次发送的命令
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
    this.startSendingCommand();
    // receive data
    ecBLE.onBLECharacteristicValueChange((str, strHex) => {
      let data =
        this.data.textRevData +
        this.dateFormat("[hh:mm:ss,S]:", new Date()) +
        (true ? strHex.replace(/[0-9a-fA-F]{2}/g, " $&") : str) +
        "\r\n";
      log("receive data", data);
      // this.updateBluetoothDebugInfo(data, false);
      this.setData({ textRevData: data });
    });

    // 5秒后自动隐藏指示器
    // setTimeout(() => {
    //   this.setData({ hideSwipeIndicator: true });
    // }, 5000);
  },

  onUnload() {
    ecBLE.onBLEConnectionStateChange(() => {});
    ecBLE.onBLECharacteristicValueChange(() => {});
    ecBLE.closeBLEConnection();
    // 停止发送命令
    this.stopSendingCommand();
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
          joystickReady: true,
        });
        this.initJoystickRect();
        if (!this.data.hasShowSwipeIndicator) {
          this.setData({
            hideSwipeIndicator: false,
            hasShowSwipeIndicator: true
          });
        }
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
      } else if (this.isRightArea(touch)) {
        this.handleRightAreaStart(touch);
      }
    }
  },

  onTouchMove(e) {
    for (let touch of e.changedTouches) {
      if (touch.identifier === this.data.joystickTouchId) {
        this.handleJoystickMove(touch);
        wx.vibrateShort({
          type: "light",
        });
      } else if (touch.identifier === this.data.rightTouchId) {
        this.handleRightAreaMove(touch);
        wx.vibrateShort({
          type: "light",
        });
      } else {
        // if (this.isRightArea(touch)) {
        //   this.handleRightAreaStart(touch);
        //   this.handleRightAreaMove(touch);
        //   wx.vibrateShort({
        //     type: "light",
        //   });
        // }
      }
    }
    // this.vibrateWithThrottle();
  },

  onTouchEnd(e) {
    for (let touch of e.changedTouches) {
      if (touch.identifier === this.data.joystickTouchId) {
        this.handleJoystickEnd();
        // this.sendMoveCommand();
      } else if (touch.identifier === this.data.rightTouchId) {
        this.handleRightAreaEnd();
        // this.sendRotationCommand();
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
    this.handleRightAreaEnd();
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
      joystickRatio: { x: 0, y: 0 },
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
      const angle = DirectionUtil.calculateAngle(ratioX, ratioY);
      const speedRatio = DirectionUtil.getSpeedRatio(this.data.speedLevel);
      this.setData({
        joystickPosition: { x: deltaX, y: deltaY },
        joystickRatio: { x: ratioX, y: ratioY },
        joystickDebug: `角度: ${angle}, 速度: ${Math.round(speed * speedRatio)}`,
      });
      // this.sendMoveCommand();
    }
  },

  handleRightAreaStart(touch) {
    this.setData({
      rightTouchId: touch.identifier,
      touchStartPosition: { x: touch.clientX, y: touch.clientY }, // 记录起始位置
      hideSwipeIndicator: true, // 一旦用户触摸右侧区域，就隐藏指示器
    });
  },

  handleRightAreaMove(touch) {
    const deltaX = touch.clientX - this.data.touchStartPosition.x; // 与起始位置的水平位移
    let rotationDirection = "none";
    let rotationSpeed = 0;

    if (deltaX !== 0) {
      const newDirection = deltaX > 0 ? "right" : "left";
      // 当方向与上一次不同时触发振动
      // if (newDirection !== this.data.rotationDirection && this.data.rotationDirection !== "none") {
      //   wx.vibrateShort({
      //     type: "heavy",
      //   });
      // }
      rotationDirection = newDirection;
      const maxDelta = 100; // 水平位移最大值
      const limitedDeltaX = Math.min(Math.abs(deltaX), maxDelta);
      rotationSpeed = Math.round((limitedDeltaX / maxDelta) * 100); // 映射为 0-100
    }

    this.setData({
      rotationDirection: rotationDirection,
      rotationSpeed: rotationSpeed,
    });

    this.updateRightRotationDebug();
    // this.sendRotationCommand();
  },

  handleRightAreaEnd() {
    this.setData({
      rightTouchId: null,
      rotationDirection: "none",
      rotationSpeed: 0,
      touchStartPosition: null, // 重置起始位置
    });
    this.updateRightRotationDebug();
  },

  updateRightRotationDebug() {
    const speedRatio = DirectionUtil.getSpeedRatio(this.data.speedLevel);
    this.setData({
      rightRotationDebug: `方向: ${
        this.data.rotationDirection
      }, 角度: ${Math.round(this.data.rotationSpeed * 0.9)}`,
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

  isRightArea(touch) {
    const rect = this.data.joystickRect;
    if (rect) {
      // 只有在手柄区域右边界以右的区域才返回true
      return (
        touch.clientX > rect.right + 40 && // 在手柄区域右侧
        touch.clientX <= this.data.screenWidth && // 不超过屏幕右边界
        touch.clientY >= 0 && // 在屏幕垂直范围内
        touch.clientY <= this.data.screenHeight
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
      type: "light",
    });
    const level = e.currentTarget.dataset.level;
    this.setData({ speedLevel: level });
    // Here you can add logic to actually change the speed of your car
    log(`Speed level set to: `, level);
  },

  goBack: function () {
    wx.vibrateShort({
      type: "light",
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
  sendRotationCommand() {
    // 使用 DirectionUtil 的新方法生成蓝牙命令
    const command = DirectionUtil.convertToRotationCommand(
      this.data.rotationDirection,
      this.data.rotationSpeed,
      this.data.speedLevel
    );
    this.sendBluetoothCommand(command);
  },

  sendMoveCommand() {
    // 使用 DirectionUtil 的新方法生成蓝牙命令
    const bluetoothCommand = DirectionUtil.convertToBluetoothCommand(
      this.data.joystickRatio.x,
      this.data.joystickRatio.y,
      this.data.speedLevel
    );
    this.sendBluetoothCommand(bluetoothCommand);
  },

  sendCombinedCommand() {
    const command = DirectionUtil.convertToCombinedCommand(
      this.data.joystickRatio.x,
      this.data.joystickRatio.y,
      this.data.rotationDirection,
      this.data.rotationSpeed,
      this.data.speedLevel
    );
    this.sendBluetoothCommand(command);
  },

  sendBluetoothCommand(command) {
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

  startSendingCommand() {
    // 如果已有定时器，先清除
    if (this.data.sendCommandInterval) {
      clearInterval(this.data.sendCommandInterval);
    }
    // 每隔 200ms 调用一次 sendCombinedCommand
    this.data.sendCommandInterval = setInterval(() => {
      this.sendCombinedCommand();
    }, 100);
  },

  stopSendingCommand() {
    if (this.data.sendCommandInterval) {
      clearInterval(this.data.sendCommandInterval);
      this.setData({ sendCommandInterval: null });
    }
  },

  updateBluetoothDebugInfo(message, isError = false) {
    // 如果消息包含命令信息
    if (message.includes('发送成功:')) {
      const commandMatch = message.match(/发送成功: (\d+,\d+,\d+,\d+,\d+,\d+,\d+,\d+)/);
      if (commandMatch) {
        const currentCommand = commandMatch[1];
        
        // 检查是否是停止命令(后5位都是0)
        const isStopCommand = currentCommand.split(',').slice(3).every(num => num === '0');
        
        // 如果是停止命令且与上一次命令相同，则不更新日志
        if (isStopCommand && currentCommand === this.data.lastCommand) {
          return;
        }
        // 更新最后发送的命令
        this.setData({ lastCommand: currentCommand });
      }
    }

    let newInfo = [{ message, isError }, ...this.data.bluetoothDebugInfo].slice(0, 3);
    this.setData({ bluetoothDebugInfo: newInfo });
  },

  // 添加振动控制方法
  vibrateWithThrottle(type = "light") {
    const now = Date.now();
    if (now - this.data.lastVibrateTime >= this.data.vibrateInterval) {
      wx.vibrateShort({
        type: type,
      });
      this.setData({ lastVibrateTime: now });
    }
  },
});
