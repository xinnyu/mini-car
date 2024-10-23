class DirectionUtil {

  static getDirection(x, y) {
    // 定义方向常量
    const FORWARD = '前';
    const BACKWARD = '后';
    const LEFT = '左';
    const RIGHT = '右';
    const NEUTRAL = '原点';

    // 设置阈值，用于判断是否足够偏离中心点
    const threshold = 0.3;

    // 判断方向
    if (Math.abs(x) < threshold && Math.abs(y) < threshold) {
      return NEUTRAL;
    } else if (Math.abs(x) > Math.abs(y)) {
      return x > 0 ? RIGHT : LEFT;
    } else {
      return y > 0 ? FORWARD : BACKWARD;
    }
  }

  static getSpeed(x, y) {
    // 计算向量长度
    const length = Math.sqrt(x * x + y * y);
    // 注意：这里假设输入的 x 和 y 已经标准化到 -1 到 1 的范围
    const speed = Math.min(Math.round(length * 100), 100);
    return speed;
  }

  static getDirectionAndSpeed(x, y) {
    return {
      direction: this.getDirection(x, y),
      speed: this.getSpeed(x, y)
    };
  }
  
  static convertToBluetoothCommand(x, y, speedLevel) {
    const { direction, speed } = this.getDirectionAndSpeed(x, y);
    
    // 义命令数组
    const command = new Uint8Array(8);
    
    // 设置包头
    command[0] = 0xA5;
    command[1] = 0xA5;
    
    // 设置 cmd
    command[2] = 0x01;
    
    // 设置方向
    switch (direction) {
      case '前':
        command[3] = 0x01;
        break;
      case '后':
        command[3] = 0x02;
        break;
      case '左':
        command[3] = 0x03;
        break;
      case '右':
        command[3] = 0x04;
        break;
      default:
        command[3] = 0x00; // 停止
    }
    
    // 获取速度比率并调整速度
    const speedRatio = this.getSpeedRatio(speedLevel);
    const adjustedSpeed = Math.round(speed * speedRatio);
    command[4] = adjustedSpeed;
    
    // 设置固定值
    command[5] = 0xFF;
    command[6] = 0x00;
    command[7] = 0x00;
    
    return command;
  }

  static getSpeedRatio(speedLevel) {
    switch (speedLevel) {
      case 'low':
        return 0.3;
      case 'medium':
        return 0.6;
      case 'high':
        return 1.0;
      default:
        return 1.0;
    }
  }

  static convertToRotationCommand(direction, speed, speedLevel) {
    // 定义命令数组
    const command = new Uint8Array(8);
    
    // 设置包头
    command[0] = 0xA5;
    command[1] = 0xA5;
    
    // 设置 cmd
    command[2] = 0x01;
    
    // 设置固定值
    command[3] = 0xFF;
    
    // 获取速度比率并调整速度
    const speedRatio = this.getSpeedRatio(speedLevel);
    const adjustedSpeed = Math.round(speed * speedRatio);
    command[4] = adjustedSpeed;
    
    // 设置旋转方向
    switch (direction) {
      case '逆时针':
        command[5] = 0x01;
        break;
      case '顺时针':
        command[5] = 0x02;
        break;
      case 'none':
        command[5] = 0x00;
        break;
      default:
        command[5] = 0xFF; // 无控制
    }
    
    // 设置固定值
    command[6] = 0x00;
    command[7] = 0x00;
    
    return command;
  }
}

export default DirectionUtil;
