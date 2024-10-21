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
}

export default DirectionUtil;
