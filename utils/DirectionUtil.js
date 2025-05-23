const __DEV__ = true;

function log(message, data = null) {
  if (__DEV__) {  // 只在开发环境下输出日志
    console.log(`[${new Date().toISOString()}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
}

function logError(message, error = null) {
  if (__DEV__) {  // 只在开发环境下输出日志
    console.error(
      `[${new Date().toISOString()}] ${message}`, 
      error ? (error.stack || error.message || JSON.stringify(error)) : ''
    );
  }
}

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
        return 0.5;
      case 'medium':
        return 0.7;
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
      case 'left':
        command[5] = 0x01;
        break;
      case 'right':
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

  static calculateAngle(x, y) {
    if (x === 0 && y === 0) {
      return 0; // 停止/无控制
    } else {
      let angle = Math.atan2(-x, y) * (180 / Math.PI);
      if (angle < 0) {
        angle += 360;
      }
      angle = Math.round(angle);
      if (angle === 0) {
        angle = 360;
      }
      return angle; // 角度在 1-360 之间的整数
    }
  }

  static convertToCombinedCommand(x, y, rotation, rotationSpeed, speedLevel) {
    const command = new Uint8Array(8);

    // 设置包头
    command[0] = 0xA5;
    command[1] = 0xA5;

    // 设置 cmd
    command[2] = 0x03;

    // 计算角度
    const angle = this.calculateAngle(x, y);

    // 设置角度
    if (angle === 0) {
      // 角度为 0 时，第四位和第五位为 0x00 0x00
      command[3] = 0x00; // 高字节
      command[4] = 0x00; // 低字节
    } else {
      // 角度在 1-360，转换为高字节和低字节
      command[3] = (angle >> 8) & 0xFF; // 高字节
      command[4] = angle & 0xFF;        // 低字节
    }

    // 计算速度
    const speed = this.getSpeed(x, y);
    const speedRatio = this.getSpeedRatio(speedLevel);
    const adjustedSpeed = Math.round(speed * speedRatio);
    command[5] = adjustedSpeed;

    // 设置旋转方向
    switch (rotation) {
      case 'left':
        command[6] = 0x01;
        break;
      case 'right':
        command[6] = 0x02;
        break;
      default:
        command[6] = 0x00; // 停止/无控制
    }

    // 计算旋转角度，将 0-100 映射为 0-90°
    const rotationAngle = Math.round(rotationSpeed * 0.9);
    command[7] = rotationAngle;

    // 如果速度为 0，但是有旋转控制，则将速度设置为最大
    if (command[6] !== 0 && command[7] !== 0 && speed === 0) {
      command[5] = Math.round(speedRatio * 100);
    }

    return command;
  }
}

export default DirectionUtil;
export { log, logError };
