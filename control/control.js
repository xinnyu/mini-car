import BluetoothManager from "../utils/BluetoothManager";
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
    rightRotationDebug: "0 rad",
    speedLevel: 'low',
    joystickReady: false,
  },

  onLoad() {
    // 延迟执行以确保页面已经旋转到横屏模式
    setTimeout(() => {
      this.updateSystemInfo();
    }, 500); // 500毫秒的延迟，可以根据实际情况调整
  },

  onShow() {
    // 每次页面显示时更新系统信息，以处理可能的屏幕旋转
    setTimeout(() => {
      this.updateSystemInfo();
    }, 500); // 500毫秒的延迟，可以根据实际情况调整
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
      } else if (touch.identifier === this.data.rightTouchId) {
        this.handleRightAreaEnd();
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
      rightRotationDebug: "0 rad"
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
      this.setData({
        joystickPosition: { x: deltaX, y: deltaY },
        joystickDebug: `${ratioX.toFixed(2)}, ${ratioY.toFixed(2)}, ${direction}, 速度：${speed}`
      });
    }
  },

  handleRightAreaStart(touch) {
    const rightAreaRect = this.getRightAreaRect();

    const relativeX = touch.clientX - rightAreaRect.left;
    const relativeY = touch.clientY - rightAreaRect.top;

    this.setData({
      rightTouchPosition: { x: relativeX, y: relativeY },
      rightTouchId: touch.identifier,
      rightTouchStartPosition: { x: touch.clientX, y: touch.clientY }
    });
  },

  handleRightAreaMove(touch) {
    const startPos = this.data.rightTouchStartPosition;
    const rightAreaRect = this.getRightAreaRect();

    if (startPos) {
      const deltaX = touch.clientX - startPos.x;
      const deltaY = touch.clientY - startPos.y;
      const angle = Math.atan2(deltaY, deltaX);
      const normalizedAngle = (angle + 2 * Math.PI) % (2 * Math.PI);
      
      const relativeX = touch.clientX - rightAreaRect.left;
      const relativeY = touch.clientY - rightAreaRect.top;

      this.setData({
        rightTouchPosition: { x: relativeX, y: relativeY },
        rightRotationDebug: `${normalizedAngle.toFixed(2)} rad`
      });
    }
  },

  handleRightAreaEnd() {
    this.resetRightTouch();
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
    const level = e.currentTarget.dataset.level;
    this.setData({ speedLevel: level });
    // Here you can add logic to actually change the speed of your car
    console.log(`Speed level set to: ${level}`);
  },

  goBack: function() {
    BluetoothManager.closeBluetoothAdapter();
    wx.navigateBack({
      delta: 1
    });
  },
});
