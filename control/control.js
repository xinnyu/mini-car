import BluetoothManager, { log } from "../utils/BluetoothManager";
import DirectionUtil from "../utils/DirectionUtil";

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
    speedLevel: 'low',
    joystickReady: false,
    rightTouchStartAngle: 0,
    currentRotationAngle: 0,
    rotationDirection: 'none',
    rotationSpeed: 0,
    bluetoothDebugInfo: [{ isError : false, message : '连接成功!'}],
  },

  onLoad() {
    // 延迟执行以确保页面已经旋转到横屏模式
    setTimeout(() => {
      this.updateSystemInfo();
    }, 800); // 500毫秒的延迟，可以根据实际情况调整
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
    query.select('#joystickArea').boundingClientRect();
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
        const bluetoothCommand = DirectionUtil.convertToBluetoothCommand(0, 0, this.data.speedLevel);
        this.sendBluetoothCommand(bluetoothCommand);
      } else if (touch.identifier === this.data.rightTouchId) {
        this.handleRightAreaEnd();
        this.sendRotationCommand(this.data.currentRotationAngle, this.data.rotationDirection, this.data.rotationSpeed);
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
      joystickTouchId: touch.identifier
    });
    this.moveJoystick(touch);
  },

  handleJoystickMove(touch) {
    if (this.data.joystickActive) {
      this.moveJoystick(touch);
    }
  },

  handleJoystickEnd() {
    this.setData({
      joystickActive: false,
      joystickPosition: { x: 0, y: 0 },
      joystickTouchId: null,
      joystickDebug: "0, 0"
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
      const { direction, speed } = DirectionUtil.getDirectionAndSpeed(ratioX, ratioY);
      const bluetoothCommand = DirectionUtil.convertToBluetoothCommand(ratioX, ratioY, this.data.speedLevel);
      const speedRatio = DirectionUtil.getSpeedRatio(this.data.speedLevel);
      this.setData({
        joystickPosition: { x: deltaX, y: deltaY },
        joystickDebug: `${ratioX.toFixed(2)}, ${ratioY.toFixed(2)}, ${direction}, 速度：${Math.round(speed * speedRatio)}`
      });
      this.sendBluetoothCommand(bluetoothCommand);
    }
  },

  handleRightAreaStart(touch) {
    const rightAreaRect = this.getRightAreaRect();
    const centerX = rightAreaRect.left + rightAreaRect.width / 2;
    const centerY = rightAreaRect.top + rightAreaRect.height / 2;

    const startAngle = this.calculateAngle(centerX, centerY, touch.clientX, touch.clientY);

    this.setData({
      rightTouchPosition: { x: touch.clientX - rightAreaRect.left, y: touch.clientY - rightAreaRect.top },
      rightTouchId: touch.identifier,
      rightTouchStartAngle: startAngle,
    });
  },

  handleRightAreaMove(touch) {
    const rightAreaRect = this.getRightAreaRect();
    const centerX = rightAreaRect.left + rightAreaRect.width / 2;
    const centerY = rightAreaRect.top + rightAreaRect.height / 2;

    const currentAngle = this.calculateAngle(centerX, centerY, touch.clientX, touch.clientY);
    let deltaAngle = currentAngle - this.data.rightTouchStartAngle;

    // 调整deltaAngle的计算方式，确保向右滑动时角度增加
    if (deltaAngle > 180) {
      deltaAngle -= 360;
    } else if (deltaAngle < -180) {
      deltaAngle += 360;
    }

    // 反转deltaAngle，使得向右滑动时角度增加
    deltaAngle = -deltaAngle;

    const newRotationAngle = (this.data.currentRotationAngle + deltaAngle + 360) % 360;
    const rotationDirection = deltaAngle > 0 ? 'right' : (deltaAngle < 0 ? 'left' : 'none');

    // 计算速度：基于触摸点到中心的距离
    const touchRadius = Math.sqrt(
      Math.pow(touch.clientX - centerX, 2) + Math.pow(touch.clientY - centerY, 2)
    );
    const maxRadius = Math.min(rightAreaRect.width, rightAreaRect.height) / 2;
    const rotationSpeed = Math.min(Math.round((touchRadius / maxRadius) * 100), 100);

    this.setData({
      rightTouchPosition: { x: touch.clientX - rightAreaRect.left, y: touch.clientY - rightAreaRect.top },
      currentRotationAngle: newRotationAngle,
      rotationDirection: rotationDirection,
      rotationSpeed: rotationSpeed,
      rightTouchStartAngle: currentAngle,
    });
    this.updateRightRotationDebug();
    // 发送旋转命令到蓝牙设备
    this.sendRotationCommand(this.data.currentRotationAngle, this.data.rotationDirection, this.data.rotationSpeed);
  },

  handleRightAreaEnd() {
    this.setData({
      rightTouchPosition: null,
      rightTouchId: null,
      rotationDirection: 'none',
      rotationSpeed: 0,
    });
    this.updateRightRotationDebug();
  },

  updateRightRotationDebug() {
    const speedRatio = DirectionUtil.getSpeedRatio(this.data.speedLevel);
    this.setData({
      rightRotationDebug: `${this.data.currentRotationAngle.toFixed(2)}°, 方向: ${this.data.rotationDirection}, 速度: ${Math.round(this.data.rotationSpeed * speedRatio)}`
    });
  },

  isJoystickArea(touch) {
    const rect = this.data.joystickRect;
    if (rect) {
      return touch.clientX >= rect.left && touch.clientX <= rect.right &&
             touch.clientY >= rect.top && touch.clientY <= rect.bottom;
    }
    return false;
  },

  getRightAreaRect() {
    return {
      left: this.data.screenWidth * 0.3,
      top: 0,
      width: this.data.screenWidth * 0.7,
      height: this.data.screenHeight
    };
  },

  setSpeedLevel(e) {
    wx.vibrateShort({
      type: 'light'  // 使用轻度震动类型
    });
    const level = e.currentTarget.dataset.level;
    this.setData({ speedLevel: level });
    // Here you can add logic to actually change the speed of your car
    log(`Speed level set to: `, level);
  },

  goBack: function() {
    wx.vibrateShort({
      type: 'light'  // 使用轻度震动类型
    });
    BluetoothManager.closeBluetoothAdapter();
    wx.navigateBack({
      delta: 1
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

  // 新增方法：发送旋转命令到蓝牙设备
  sendRotationCommand(angle, direction, speed) {
    // 使用 DirectionUtil 的新方法生成蓝牙命令
    const command = DirectionUtil.convertToRotationCommand(direction, speed, this.data.speedLevel);
    this.sendBluetoothCommand(command);
  },

  sendBluetoothCommand(command) {
    wx.vibrateShort({
      type: 'light'  // 使用轻度震动类型
    });
    BluetoothManager.sendDataThrottled(command, (message, isError) => {
      this.updateBluetoothDebugInfo(message, isError);
    });
  },

  updateBluetoothDebugInfo(message, isError = false) {
    let newInfo = [{ message, isError }, ...this.data.bluetoothDebugInfo].slice(0, 3);
    this.setData({ bluetoothDebugInfo: newInfo });    
  },
});
